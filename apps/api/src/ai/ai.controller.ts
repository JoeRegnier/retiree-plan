import { Controller, Get, Post, Delete, Body, Query, UseGuards, Req, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService, ChatMessage } from './ai.service';

@Controller('ai')
@UseGuards(AuthGuard('jwt'))
export class AiController {
  constructor(private ai: AiService) {}

  /**
   * Send a message to the AI assistant.
   * Returns the assistant's reply as `{ reply: string }`.
   */
  @Post('chat')
  async chat(
    @Req() req: any,
    @Body()
    body: {
      message: string;
      history?: ChatMessage[];
      adapter?: 'ollama' | 'copilot'; // copilot requires COPILOT_GITHUB_TOKEN env var
    },
  ) {
    const reply = await this.ai.chat(req.user.id, {
      message: body.message,
      history: body.history,
      adapter: body.adapter,
    });
    return { reply };
  }

  /** Retrieve conversation history for the authenticated user. */
  @Get('history')
  async getHistory(@Req() req: any, @Query('limit') limit?: string) {
    const messages = await this.ai.getHistory(req.user.id, limit ? parseInt(limit, 10) : 50);
    return { messages };
  }

  /** Clear the conversation history. */
  @Delete('history')
  @HttpCode(204)
  async clearHistory(@Req() req: any) {
    await this.ai.clearHistory(req.user.id);
  }
}
