import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';
import {
  AppSettings, ContentType, ContentCategory,
  TextCase, OutlineType, TextAlign, HeaderType,
  DEFAULT_HIGHLIGHT_COLORS, CardStyleSettings, SettingsContextType, Emotions
} from '../../types.ts';

const APP_SETTINGS_KEY = 'aiContentCardGeneratorSettings_v6';

// This is the base style configuration for any new card.
const INITIAL_CARD_STYLES: CardStyleSettings = {
  headlineFontFamily: 'Khand, sans-serif',
  headlineFontWeight: 'bold',
  headlineTextSize: 22,
  headlineTextAlign: 'center',
  headlineTextWidth: 100,
  headlineLetterSpacing: 0,
  headlineLineHeight: 1.2,
  headlineHighlightColors: ['#00FF00', '#FFFF00'],
  headerType: HeaderType.Gradient,
  selectedHeaderColor: '#000000',
  headerGradientDirection: 'to right',
  headerGradientColor1: '#000000',
  headerGradientColor2: '#ff0000',
  textCase: TextCase.Default,
  showSummary: true,
  summaryFontSizeKey: 'medium',
  summaryBackgroundColor: '#F9FAFB', // Default is bg-gray-50
  summaryTextColor: '#1F2937', // Default is text-gray-800
  showSources: true,
  outlineEnabled: false,
  outlineColor: '#C2FF00',
  outlineType: OutlineType.Solid,
  outlineWidth: 2,
  outlineRoundedCorners: 0,
  outlineOffset: 0,
  overlayVisible: false,
  overlayPosition: 'bottom',
  overlayIsSolid: true,
  overlayBackgroundColor: '#000000',
  overlayHeight: 30,
  overlayOneSideBorderEnabled: false,
  overlayBorderColor: '#FF0000',
  overlayBorderWidth: 2,
  overlayBorderPosition: 'top',
};

// This combines content settings and default style settings into one object.
const INITIAL_APP_SETTINGS: AppSettings = {
  postCount: 10,
  selectedContentType: ContentType.Facts,
  selectedContentCategory: ContentCategory.ANIMALS,
  selectedLanguage: 'hi',
  selectedCountryCode: 'WW',
  selectedEmotion: 'Trust',
  ...INITIAL_CARD_STYLES
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(INITIAL_APP_SETTINGS);

  // Load settings from localStorage on initial render
  useEffect(() => {
    const savedSettingsRaw = localStorage.getItem(APP_SETTINGS_KEY);
    if (savedSettingsRaw) {
      try {
        const savedSettings = JSON.parse(savedSettingsRaw) as Partial<AppSettings>;
        // Merge with initial settings to ensure all keys are present
        setSettings(prev => ({ ...prev, ...savedSettings }));
      } catch (e) {
        console.error("Failed to parse saved app settings:", e);
        localStorage.removeItem(APP_SETTINGS_KEY);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const value = useMemo(() => ({ settings, updateSetting }), [settings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};