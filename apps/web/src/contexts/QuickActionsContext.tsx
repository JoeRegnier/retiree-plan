import { createContext, useContext, useState, useCallback } from 'react';

interface QuickActionsContextValue {
  /** CSV export function registered by the current page (null when not available). */
  csvExport: (() => void) | null;
  /** Pages call this on mount to register their CSV handler; call with null on unmount. */
  setCsvExport: (fn: (() => void) | null) => void;
  /** Label shown for the CSV export button. */
  csvLabel: string;
  setCsvLabel: (label: string) => void;
}

const QuickActionsContext = createContext<QuickActionsContextValue>({
  csvExport: null,
  setCsvExport: () => {},
  csvLabel: 'Export CSV',
  setCsvLabel: () => {},
});

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [csvExport, setCsvExportRaw] = useState<(() => void) | null>(null);
  const [csvLabel, setCsvLabel] = useState('Export CSV');

  const setCsvExport = useCallback((fn: (() => void) | null) => {
    // useState setter with a function arg is treated as an updater — wrap in another fn to store it
    setCsvExportRaw(fn ? () => fn : null);
  }, []);

  return (
    <QuickActionsContext.Provider value={{ csvExport, setCsvExport, csvLabel, setCsvLabel }}>
      {children}
    </QuickActionsContext.Provider>
  );
}

export function useQuickActions() {
  return useContext(QuickActionsContext);
}
