import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

// --- SIDEBAR CONTEXT ---
interface SidebarContextType {
  sidebarControls: ReactNode | null;
  setSidebarControls: (controls: ReactNode | null) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [sidebarControls, setSidebarControlsState] = useState<ReactNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const setSidebarControls = useCallback((controls: ReactNode | null) => {
    setSidebarControlsState(controls);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarControls, setSidebarControls, isSidebarOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};


// --- PAGE ACTION CONTEXT (for header controls) ---
interface PageActionContextType {
    headerActions: ReactNode | null;
    setHeaderActions: (actions: ReactNode | null) => void;
}

const PageActionContext = createContext<PageActionContextType | undefined>(undefined);

export const usePageActions = (): PageActionContextType => {
    const context = useContext(PageActionContext);
    if (!context) {
        throw new Error('usePageActions must be used within a PageActionProvider');
    }
    return context;
};

export const PageActionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);

    const value = {
        headerActions,
        setHeaderActions,
    };

    return (
        <PageActionContext.Provider value={value}>
            {children}
        </PageActionContext.Provider>
    );
};
