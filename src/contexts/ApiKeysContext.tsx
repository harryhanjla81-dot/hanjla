import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { ApiKey } from '../../types.ts';

const API_KEYS_STORAGE_KEY = 'hanjlaHarryApiKeys_v1';

interface ApiKeysContextType {
  apiKeys: ApiKey[];
  isModalOpen: boolean;
  addApiKey: (key: Omit<ApiKey, 'id' | 'isActive'>) => void;
  updateApiKey: (id: string, updates: Partial<ApiKey>) => void;
  removeApiKey: (id: string) => void;
  getActiveKeys: (provider?: 'gemini' | 'chatgpt') => ApiKey[];
  toggleModal: () => void;
}

const ApiKeysContext = createContext<ApiKeysContextType | undefined>(undefined);

export const useApiKeys = (): ApiKeysContextType => {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider');
  }
  return context;
};

export const ApiKeysProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    try {
      const savedKeys = localStorage.getItem(API_KEYS_STORAGE_KEY);
      if (savedKeys) {
        setApiKeys(JSON.parse(savedKeys));
      }
    } catch (error) {
      console.error('Failed to load API keys from storage', error);
      setApiKeys([]);
    }
  }, []);

  const saveKeysToStorage = (keys: ApiKey[]) => {
    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to save API keys to storage', error);
    }
  };

  const addApiKey = (key: Omit<ApiKey, 'id' | 'isActive'>) => {
    setApiKeys(prev => {
      const newKey = { ...key, id: `${Date.now()}`, isActive: true };
      const newKeys = [...prev, newKey];
      saveKeysToStorage(newKeys);
      return newKeys;
    });
  };

  const updateApiKey = (id: string, updates: Partial<ApiKey>) => {
    setApiKeys(prev => {
      const newKeys = prev.map(k => k.id === id ? { ...k, ...updates } : k);
      saveKeysToStorage(newKeys);
      return newKeys;
    });
  };

  const removeApiKey = (id: string) => {
    setApiKeys(prev => {
      const newKeys = prev.filter(k => k.id !== id);
      saveKeysToStorage(newKeys);
      return newKeys;
    });
  };

  const getActiveKeys = useCallback((provider?: 'gemini' | 'chatgpt') => {
    return apiKeys.filter(k => k.isActive && (!provider || k.provider === provider));
  }, [apiKeys]);

  const toggleModal = () => setIsModalOpen(prev => !prev);

  const value = { apiKeys, isModalOpen, addApiKey, updateApiKey, removeApiKey, getActiveKeys, toggleModal };

  return (
    <ApiKeysContext.Provider value={value}>
      {children}
    </ApiKeysContext.Provider>
  );
};
