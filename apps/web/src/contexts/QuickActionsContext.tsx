import { createContext, useContext, useState, useCallback } from 'react';

interface QuickActionsContextValue {
  /** CSV export function registered by the current page (null when not available). */
  csvExport: (() => void) | null;
  /** Pages call this on mount to register their CSV handler; call with null on unmount. */
  setCsvExport: (fn: (() => void) | null) => void;
  /** Label shown for the CSV export button. */
  csvLabel: string;
  setCsvLabel: (label: string) => void;
  /** What-If Calculator open callback registered by the current page (null when not available). */
  whatIfAction: (() => void) | null;
  setWhatIfAction: (fn: (() => void) | null) => void;
}

const QuickActionsContext = createContext<QuickActionsContextValue>({
  csvExport: null,
  setCsvExport: () => {},
  csvLabel: 'Export CSV',
  setCsvLabel: () => {},
  whatIfAction: null,
  setWhatIfAction: () => {},
});

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [csvExport, setCsvExportRaw] = useState<(() => void) | null>(null);
  const [csvLabel, setCsvLabel] = useState('Export CSV');
  const [whatIfAction, setWhatIfActionRaw] = useState<(() => void) | null>(null);

  const setCsvExport = useCallback((fn: (() => void) | null) => {
    // useState setter with a function arg is treated as an updater — wrap in another fn to store it
    setCsvExportRaw(fn ? () => fn : null);
  }, []);

  const setWhatIfAction = useCallback((fn: (() => void) | null) => {
    setWhatIfActionRaw(fn ? () => fn : null);
  }, []);

  return (
    <QuickActionsContext.Provider value={{ csvExport, setCsvExport, csvLabel, setCsvLabel, whatIfAction, setWhatIfAction }}>
      {children}
    </QuickActionsContext.Provider>
  );
}

export function useQuickActions() {
  return useContext(QuickActionsContext);
}
