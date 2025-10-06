import React, { useState, useEffect } from 'react';
import { useTheme } from '../src/contexts/ThemeContext.tsx';
import { CloseIcon, PaletteIcon, SunIcon, MoonIcon, FacebookIcon } from './IconComponents.tsx';
import CustomColorPicker from './CustomColorPicker.tsx';
import { AppThemeSettings, GlobalFontOptions, SelectedGlobalFontFamily, GradientDirection, GradientDirectionOptions, DEFAULT_THEME_SETTINGS, darkenColor, getContrastingTextColor, isValidHexColor } from '../types.ts';
import { useFacebookPage } from '../src/contexts/FacebookPageContext.tsx';
import Spinner from './Spinner.tsx';

// --- THEME SETTINGS COMPONENT ---
const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-12 gap-2 items-center mb-3">
        <label className="col-span-4 text-sm font-medium">{label}</label>
        <div className="col-span-8">{children}</div>
    </div>
);

const ThemeSettings: React.FC = () => {
    const [themeSettings, setThemeSettings] = useState<AppThemeSettings>(() => {
        const saved = localStorage.getItem('aiContentCardThemeSettings_v1');
        return saved ? JSON.parse(saved) : DEFAULT_THEME_SETTINGS;
    });
    const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

    const handleThemeSettingChange = <K extends keyof AppThemeSettings>(key: K, value: AppThemeSettings[K]) => {
        setThemeSettings(prev => ({ ...prev, [key]: value }));
    };
    
    const getSafeColor = (color: string, defaultColor: string): string => isValidHexColor(color) ? color : defaultColor;

    useEffect(() => {
        const { globalFontFamily, primaryColor, backgroundType, backgroundSolidColor, backgroundGradientStart, backgroundGradientEnd, backgroundGradientDirection } = themeSettings;
        const safePrimaryColor = getSafeColor(primaryColor, DEFAULT_THEME_SETTINGS.primaryColor);
        document.documentElement.style.setProperty('--app-font-family', globalFontFamily);
        document.documentElement.style.setProperty('--app-primary-color', safePrimaryColor);
        document.documentElement.style.setProperty('--app-primary-color-hover', darkenColor(safePrimaryColor, 10));
        document.documentElement.style.setProperty('--app-primary-color-text', getContrastingTextColor(safePrimaryColor));
        document.body.style.background = backgroundType === 'solid'
            ? getSafeColor(backgroundSolidColor, DEFAULT_THEME_SETTINGS.backgroundSolidColor)
            : `linear-gradient(${backgroundGradientDirection}, ${getSafeColor(backgroundGradientStart, DEFAULT_THEME_SETTINGS.backgroundGradientStart)}, ${getSafeColor(backgroundGradientEnd, DEFAULT_THEME_SETTINGS.backgroundGradientEnd)})`;
        localStorage.setItem('aiContentCardThemeSettings_v1', JSON.stringify(themeSettings));
    }, [themeSettings]);

    return (
        <div className="p-4 space-y-4">
            <FormRow label="Primary Color"><CustomColorPicker label="Primary theme color" value={themeSettings.primaryColor} onChange={(c) => handleThemeSettingChange('primaryColor', c)} isOpen={activeColorPicker === 'themePrimary'} onToggle={() => setActiveColorPicker(p => p === 'themePrimary' ? null : 'themePrimary')} /></FormRow>
            <FormRow label="Global Font"><select value={themeSettings.globalFontFamily} onChange={e => handleThemeSettingChange('globalFontFamily', e.target.value as SelectedGlobalFontFamily)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">{Object.entries(GlobalFontOptions).map(([val, name]) => <option key={val} value={val}>{name}</option>)}</select></FormRow>
        </div>
    );
};

// --- FACEBOOK SETTINGS COMPONENT ---
const FacebookSettings: React.FC = () => {
    const { isAuthenticated, activePage, login, logout, isLoading, loginError } = useFacebookPage();
    const [token, setToken] = useState('');

    const handleLogin = () => {
        if (token.trim()) {
            login(token).then(() => {
                // Clear token from input after successful login attempt
                setToken('');
            });
        }
    };

    return (
        <div className="p-4 space-y-4">
            {isAuthenticated && activePage ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-800 dark:text-green-200">
                    <p className="font-semibold">Connected</p>
                    <p className="text-sm">Active Page: <strong>{activePage.name}</strong></p>
                </div>
            ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200">
                    <p className="font-semibold">Not Connected</p>
                    <p className="text-sm">Connect your Facebook account to use page-related features.</p>
                </div>
            )}
            
            <div className="space-y-2">
                <label className="block text-sm font-medium">Facebook User Access Token</label>
                <input 
                    type="password" 
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your token here"
                    className="w-full mt-1 p-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600"
                />
                 <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary/80 hover:text-primary hover:underline mt-1 block">
                    How to get a User Access Token?
                </a>
                {loginError && <p className="text-xs text-red-500 mt-1">{loginError}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-4">
                {isAuthenticated && (
                    <button onClick={logout} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700">
                        Logout
                    </button>
                )}
                <button 
                    onClick={handleLogin} 
                    disabled={isLoading || !token.trim()}
                    className="px-4 py-2 text-sm rounded-md bg-primary text-primary-text hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50"
                >
                    {isLoading ? <Spinner size="sm" /> : (isAuthenticated ? 'Reconnect' : 'Connect')}
                </button>
            </div>
        </div>
    );
};


// --- MAIN SETTINGS MODAL ---
interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}
type Tab = 'appearance' | 'facebook';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<Tab>('appearance');

    if (!isOpen) return null;

    const TabButton: React.FC<{ tabId: Tab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button onClick={() => setActiveTab(tabId)} className={`flex-1 p-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tabId ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"><CloseIcon /></button>
                </div>
                
                <div className="flex border-b dark:border-gray-700 flex-shrink-0">
                    <TabButton tabId="appearance"><PaletteIcon className="w-5 h-5 inline-block mr-2" />Appearance</TabButton>
                    <TabButton tabId="facebook"><FacebookIcon className="w-5 h-5 inline-block mr-2" />Facebook</TabButton>
                </div>

                <div className="flex-grow overflow-y-auto scrollbar-thin">
                    {activeTab === 'appearance' && <ThemeSettings />}
                    {activeTab === 'facebook' && <FacebookSettings />}
                </div>

                <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Manage your application settings.</span>
                    <button onClick={toggleTheme} className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600" aria-label="Toggle theme">
                        {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
