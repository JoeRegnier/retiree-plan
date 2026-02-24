import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiContextBuilderService } from './context-builder.service';

/** Supported backend adapters. */
export type AiAdapter = 'ollama' | 'copilot';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  /** Optionally provide prior conversation turns for context. */
  history?: ChatMessage[];
  /** Override the adapter for this request. */
  adapter?: AiAdapter;
}

// Minimal structural interface matching @github/copilot-sdk CopilotClient.
// We use a structural type (not a static import) because the SDK package is
// ESM-only and must be loaded via dynamic import() from this CommonJS module.
interface ICopilotSession {
  sendAndWait(opts: { prompt: string }, timeout?: number): Promise<unknown>;
  destroy(): Promise<void>;
}
interface ICopilotClient {
  start(): Promise<void>;
  stop(): Promise<unknown>;
  createSession(config: ICopilotSessionConfig): Promise<ICopilotSession>;
}
interface ICopilotSessionConfig {
  model?: string;
  systemMessage?: { mode?: 'append' | 'replace'; content: string };
}

@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private client: ICopilotClient | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private contextBuilder: AiContextBuilderService,
  ) {}

  // ── NestJS lifecycle ────────────────────────────────────────────────────────

  async onModuleInit() {
    if (this.defaultAdapter() === 'copilot') {
      await this.startClient();
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.stop();
      } catch (err) {
        this.logger.warn(`Error stopping Copilot client: ${err}`);
      }
      this.client = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async chat(userId: string, req: ChatRequest): Promise<string> {
    const planContext = await this.contextBuilder.buildContext(userId);
    const systemMsg = this.buildSystemMessage(planContext);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemMsg },
      ...(req.history ?? []).slice(-10), // keep last 10 turns for token budget
      { role: 'user', content: req.message },
    ];

    const adapter = req.adapter ?? this.defaultAdapter();
    let reply: string;

    if (adapter === 'copilot') {
      reply = await this.callCopilotSdk(planContext, req.history?.slice(-10) ?? [], req.message);
    } else {
      reply = await this.callOllama(messages);
    }

    // Persist both turns to DB
    await this.prisma.aiMessage.createMany({
      data: [
        { userId, role: 'user', content: req.message },
        { userId, role: 'assistant', content: reply },
      ],
    });

    return reply;
  }

  async getHistory(userId: string, limit = 50): Promise<ChatMessage[]> {
    const rows = await this.prisma.aiMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => ({ role: r.role as ChatMessage['role'], content: r.content }));
  }

  async clearHistory(userId: string): Promise<void> {
    await this.prisma.aiMessage.deleteMany({ where: { userId } });
  }

  // ── System prompt ──────────────────────────────────────────────────────────

  private buildSystemMessage(planContext: string): string {
    return [
      'You are a knowledgeable Canadian retirement planning assistant embedded in the RetireePlan application.',
      'You speak clearly, avoid jargon, and always clarify that your responses are informational only — not professional financial advice.',
      '',
      'Here is the user\'s current retirement plan data:',
      '---',
      planContext,
      '---',
      '',
      'Answer questions about this plan, suggest improvements, explain Canadian retirement concepts (CPP, OAS, RRSP, TFSA, GIS, cross-border taxation, expat strategies, etc.), and help the user explore scenarios.',
      'Be concise — 2–4 paragraphs maximum unless the user asks for detail.',
    ].join('\n');
  }

  // ── Ollama adapter ─────────────────────────────────────────────────────────

  private async callOllama(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
    const model = this.config.get<string>('OLLAMA_MODEL', 'llama3');

    const body = {
      model,
      messages,
      stream: false,
    };

    this.logger.debug(`Calling Ollama model ${model} at ${baseUrl}`);

    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error(`Ollama error ${resp.status}: ${text}`);
      throw new Error(`Ollama request failed (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as { message?: { content: string }; error?: string };
    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    return data.message?.content ?? '';
  }

  // ── GitHub Copilot SDK adapter ─────────────────────────────────────────────
  //
  // Communicates via JSON-RPC with the Copilot CLI running in server mode.
  // The CLI must be installed and available in PATH (or set COPILOT_CLI_PATH).
  //
  // Required env vars:
  //   COPILOT_GITHUB_TOKEN=ghp_xxxx   GitHub token with Copilot access
  //
  // Optional:
  //   COPILOT_MODEL=gpt-4o            Model name (default: gpt-4o)
  //   COPILOT_CLI_PATH=/path/copilot  Path to CLI binary (default: 'copilot' in PATH)

  private async startClient() {
    const githubToken = this.config.get<string>('COPILOT_GITHUB_TOKEN', '');
    const cliPath = this.config.get<string>('COPILOT_CLI_PATH') as string | undefined;

    // Dynamic import required: @github/copilot-sdk is an ESM-only package.
    const { CopilotClient } = await import('@github/copilot-sdk') as any;

    const instance = new CopilotClient({
      ...(githubToken ? { githubToken } : {}),
      ...(cliPath ? { cliPath } : {}),
    }) as ICopilotClient;

    try {
      await instance.start();
      this.client = instance;
      this.logger.log('GitHub Copilot SDK client started');
    } catch (err) {
      this.logger.error(`Failed to start Copilot client: ${err}`);
      this.client = null;
    }
  }

  private async callCopilotSdk(
    planContext: string,
    history: ChatMessage[],
    userMessage: string,
  ): Promise<string> {
    // Lazy start if something went wrong on module init
    if (!this.client) {
      await this.startClient();
    }
    if (!this.client) {
      this.logger.warn('Copilot client unavailable — falling back to Ollama');
      return this.callOllama([
        { role: 'system', content: this.buildSystemMessage(planContext) },
        ...history,
        { role: 'user', content: userMessage },
      ]);
    }

    const model = this.config.get<string>('COPILOT_MODEL', 'gpt-4o');

    // Build a context-rich system message that includes plan data and chat history.
    // We inject history here so each SDK session can be stateless (one turn per API call),
    // while our DB handles history persistence.
    const historyText =
      history.length > 0
        ? history
            .map((m) => `<${m.role}>${m.content}</${m.role}>`)
            .join('\n')
        : '(no prior conversation)';

    const fullSystemContent = [
      this.buildSystemMessage(planContext),
      '',
      '## Conversation History',
      historyText,
    ].join('\n');

    this.logger.debug(`Creating Copilot session (model=${model})`);

    const session = await this.client.createSession({
      model,
      systemMessage: {
        // 'replace' gives us full control over the system prompt.
        mode: 'replace',
        content: fullSystemContent,
      },
    });

    try {
      const result = await session.sendAndWait({ prompt: userMessage });
      return (result as any)?.data?.content ?? '';
    } finally {
      await session.destroy();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private defaultAdapter(): AiAdapter {
    const githubToken = this.config.get<string>('COPILOT_GITHUB_TOKEN', '');
    return githubToken ? 'copilot' : 'ollama';
  }
}
