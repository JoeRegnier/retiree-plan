import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Tooltip,
  Button,
  Divider,
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 1 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'text.secondary',
            animation: 'bounce 1.2s infinite',
            animationDelay: `${i * 0.2}s`,
            '@keyframes bounce': {
              '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
              '40%': { transform: 'scale(1)', opacity: 1 },
            },
          }}
        />
      ))}
    </Box>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 1.5,
        alignItems: 'flex-start',
        mb: 2,
      }}
    >
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isUser ? 'primary.main' : 'secondary.main',
          flexShrink: 0,
        }}
      >
        {isUser ? <PersonIcon sx={{ fontSize: 18 }} /> : <SmartToyIcon sx={{ fontSize: 18 }} />}
      </Avatar>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.25,
          maxWidth: '75%',
          bgcolor: isUser ? 'primary.main' : 'background.paper',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          border: isUser ? 'none' : '1px solid',
          borderColor: 'divider',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
        >
          {msg.content}
        </Typography>
      </Paper>
    </Box>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How much should I have saved by retirement?',
  'When should I start taking CPP?',
  'Explain the RRSP to RRIF conversion rules',
  'What is the OAS clawback and how can I minimise it?',
  'Should I prioritise TFSA or RRSP contributions?',
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AiChatPage({ inDrawer = false }: { inDrawer?: boolean }) {
  const { apiFetch } = useApi();
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');

  // Load conversation history
  const { data: historyData } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ['ai-history'],
    queryFn: () => apiFetch('/ai/history'),
  });

  // Sync server history to local state on first load
  useEffect(() => {
    if (historyData?.messages && localMessages.length === 0) {
      setLocalMessages(historyData.messages.filter((m) => m.role !== 'system'));
    }
  }, [historyData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages, isTyping]);

  // Clear history
  const clearMutation = useMutation({
    mutationFn: () => apiFetch('/ai/history', { method: 'DELETE' }),
    onSuccess: () => {
      setLocalMessages([]);
      qc.invalidateQueries({ queryKey: ['ai-history'] });
    },
  });

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    setLocalMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError('');
    setIsTyping(true);

    try {
      const result = await apiFetch<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: localMessages.slice(-10).filter((m) => m.role !== 'system'),
        }),
      });
      const assistantMsg: ChatMessage = { role: 'assistant', content: result.reply };
      setLocalMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message ?? 'Failed to get a response. Is the AI backend running?');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = localMessages.length === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: inDrawer ? '100%' : 'calc(100vh - 128px)' }}>
      {!inDrawer && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="h4" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon color="primary" /> AI Assistant
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ask questions about your retirement plan — powered by Ollama (local) or the GitHub Copilot SDK.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label="Context-aware"
                color="primary"
                variant="outlined"
                icon={<SmartToyIcon />}
              />
              {localMessages.length > 0 && (
                <Tooltip title="Clear conversation">
                  <IconButton
                    size="small"
                    onClick={() => clearMutation.mutate()}
                    disabled={clearMutation.isPending}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      {/* Message list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {isEmpty && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <SmartToyIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Your AI Retirement Assistant
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 4 }}>
              Ask anything about your plan, CPP, OAS, RRSP, TFSA, and more.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              justifyContent="center"
              useFlexGap
              sx={{ gap: 1 }}
            >
              {SUGGESTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  variant="outlined"
                  clickable
                  onClick={() => sendMessage(s)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {localMessages
          .filter((m) => m.role !== 'system')
          .map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

        {isTyping && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', flexShrink: 0 }}>
              <SmartToyIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.25,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '4px 16px 16px 16px',
              }}
            >
              <TypingIndicator />
            </Paper>
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <div ref={endRef} />
      </Box>

      {/* Input bar */}
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        sx={{
          display: 'flex',
          gap: 1,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Ask about your retirement plan… (Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
          InputProps={{ sx: { borderRadius: 3 } }}
        />
        <Tooltip title="Send (Enter)">
          <span>
            <IconButton
              type="submit"
              color="primary"
              disabled={!input.trim() || isTyping}
              sx={{ alignSelf: 'flex-end', mb: 0.5 }}
            >
              {isTyping ? <CircularProgress size={20} /> : <SendIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, textAlign: 'center' }}>
        AI responses are informational only and do not constitute professional financial advice.
      </Typography>
    </Box>
  );
}
