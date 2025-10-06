import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { FBPage } from '../../types.ts';
import { useNotification } from './NotificationContext.tsx';

const ACCESS_TOKEN_KEY = 'fbUploader_accessToken_v2';
const PAGES_KEY = 'fbUploader_pages_v2';
const ACTIVE_PAGE_ID_KEY = 'fbUploader_activePageId_v1'; // New key for persistence
const API_VERSION = 'v19.0';

interface FacebookPageContextType {
  isAuthenticated: boolean;
  pages: FBPage[];
  activePage: FBPage | null;
  isLoading: boolean;
  loginError: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  selectPage: (pageId: string) => void;
}

const FacebookPageContext = createContext<FacebookPageContextType | undefined>(undefined);

export const useFacebookPage = (): FacebookPageContextType => {
  const context = useContext(FacebookPageContext);
  if (!context) {
    throw new Error('useFacebookPage must be used within a FacebookPageProvider');
  }
  return context;
};

export const FacebookPageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addNotification } = useNotification();

  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [pages, setPages] = useState<FBPage[]>(() => {
    try {
      const savedPages = localStorage.getItem(PAGES_KEY);
      return savedPages ? JSON.parse(savedPages) : [];
    } catch { return []; }
  });
  const [activePage, setActivePage] = useState<FBPage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(PAGES_KEY);
    localStorage.removeItem(ACTIVE_PAGE_ID_KEY);
    setAccessToken(null);
    setPages([]);
    setActivePage(null);
    setLoginError(null);
    addNotification('You have been logged out.', 'info');
  }, [addNotification]);

  const login = useCallback(async (token: string) => {
    if (!token.trim()) {
        addNotification('Please enter a User Access Token.', 'error');
        return;
    }
    setIsLoading(true);
    setLoginError(null);
    try {
      const response = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${token}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const fetchedPages: FBPage[] = data.data || [];
      if (fetchedPages.length > 0) {
        setAccessToken(token);
        setPages(fetchedPages);
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        localStorage.setItem(PAGES_KEY, JSON.stringify(fetchedPages));
        
        // Try to re-select the last active page, or default to the first
        const lastActivePageId = localStorage.getItem(ACTIVE_PAGE_ID_KEY);
        const pageToSelect = fetchedPages.find(p => p.id === lastActivePageId) || fetchedPages[0];
        setActivePage(pageToSelect);
        localStorage.setItem(ACTIVE_PAGE_ID_KEY, pageToSelect.id);
        
        addNotification('Successfully connected to Facebook!', 'success');
      } else {
        setLoginError("No pages found for this access token.");
        addNotification("No pages found for this access token.", 'error');
      }
    } catch (e: any) {
      const message = (e.message || '').toLowerCase();
      if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
        setLoginError(`Facebook connection failed: ${e.message}. The token might be invalid or expired.`);
        logout();
      } else {
        setLoginError(`Failed to fetch pages: ${e.message}.`);
        addNotification(`Failed to fetch pages: ${e.message}.`, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, logout]);

  // Effect to initialize state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedPagesRaw = localStorage.getItem(PAGES_KEY);
    const storedActivePageId = localStorage.getItem(ACTIVE_PAGE_ID_KEY);

    if (storedToken && storedPagesRaw) {
      setAccessToken(storedToken);
      try {
        const storedPages = JSON.parse(storedPagesRaw);
        setPages(storedPages);
        if (storedActivePageId) {
          const page = storedPages.find((p: FBPage) => p.id === storedActivePageId);
          if (page) {
            setActivePage(page);
          } else if (storedPages.length > 0) {
            // If saved page ID is not found (e.g., page was removed), default to first
            setActivePage(storedPages[0]);
            localStorage.setItem(ACTIVE_PAGE_ID_KEY, storedPages[0].id);
          }
        } else if (storedPages.length > 0) {
            // If no active page was ever saved, default to first
            setActivePage(storedPages[0]);
            localStorage.setItem(ACTIVE_PAGE_ID_KEY, storedPages[0].id);
        }
      } catch (e) {
        console.error("Error parsing stored pages, logging out.", e);
        logout();
      }
    }
  }, [logout]);


  const selectPage = useCallback((pageId: string) => {
    const newPage = pages.find(p => p.id === pageId) || null;
    if (newPage) {
      setActivePage(newPage);
      localStorage.setItem(ACTIVE_PAGE_ID_KEY, newPage.id);
    }
  }, [pages]);

  const value = {
    isAuthenticated: !!accessToken && pages.length > 0,
    pages,
    activePage,
    isLoading,
    loginError,
    login,
    logout,
    selectPage,
  };

  return (
    <FacebookPageContext.Provider value={value}>
      {children}
    </FacebookPageContext.Provider>
  );
};
