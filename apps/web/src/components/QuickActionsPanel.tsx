import { useState } from 'react';
import {
  Box,
  Card,
  Tooltip,
  IconButton,
  Button,
  CircularProgress,
  Drawer,
  Typography,
  Divider,
  Stack,
  useTheme,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import { PdfDownloadButton } from './PdfReport';
import { usePlanExport } from '../hooks/usePlanExport';
import { useQuickActions } from '../contexts/QuickActionsContext';
import { AiChatPage } from '../pages/AiChatPage';

const DRAWER_WIDTH = 460;

export function QuickActionsPanel() {
  const theme = useTheme();
  const { planData, projectionsLoading } = usePlanExport();
  const { csvExport, csvLabel } = useQuickActions();
  const [aiOpen, setAiOpen] = useState(false);

  const hasPdf = !!planData && !projectionsLoading;

  return (
    <>
      {/* ── Floating panel ─────────────────────────────────────────────────── */}
      <Card
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1200,
          borderRadius: 3,
          overflow: 'visible',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          px: 0.5,
          py: 0.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.25}>
          {/* CSV — only shown when a page has registered an export */}
          {csvExport && (
            <>
              <Tooltip title={csvLabel} placement="top">
                <Button
                  size="small"
                  variant="text"
                  startIcon={<FileDownloadIcon fontSize="small" />}
                  onClick={csvExport}
                  sx={{ textTransform: 'none', fontSize: '0.8rem', px: 1.25, py: 0.75, minWidth: 0 }}
                >
                  CSV
                </Button>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
            </>
          )}

          {/* PDF export */}
          {projectionsLoading ? (
            <Tooltip title="Preparing PDF data…" placement="top">
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, gap: 0.75 }}>
                <CircularProgress size={14} sx={{ color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">PDF…</Typography>
              </Box>
            </Tooltip>
          ) : hasPdf ? (
            <PdfDownloadButton
              plan={planData!}
              label="PDF"
              filename={`${planData!.householdName.replace(/\s+/g, '-')}-plan.pdf`}
              compact
            />
          ) : null}

          {(csvExport || hasPdf || projectionsLoading) && (
            <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
          )}

          {/* AI Assistant */}
          <Tooltip title="AI Assistant" placement="top">
            <IconButton
              size="small"
              onClick={() => setAiOpen(true)}
              sx={{
                mx: 0.25,
                color: aiOpen ? 'primary.main' : 'text.secondary',
                '&:hover': { color: 'primary.main' },
              }}
            >
              <SmartToyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Card>

      {/* ── AI Chat Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            maxWidth: '95vw',
            bgcolor: 'background.default',
            borderLeft: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Drawer header */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <SmartToyIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>AI Assistant</Typography>
          </Stack>
          <IconButton size="small" onClick={() => setAiOpen(false)} aria-label="Close AI assistant">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Chat content */}
        <Box sx={{ flex: 1, overflow: 'hidden', px: 2, pt: 1, pb: 2 }}>
          <AiChatPage inDrawer />
        </Box>
      </Drawer>
    </>
  );
}
