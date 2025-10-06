import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSidebar, usePageActions } from './src/contexts/SidebarContext.tsx';
import { useContentManager } from './src/hooks/useContentManager.ts';

import ActionToolbar from './src/components/main/ActionToolbar.tsx';
import CardGrid from './src/components/main/CardGrid.tsx';
import SettingsSidebar from './src/components/main/SettingsSidebar.tsx';
import ViralPostModal from './src/components/main/ViralPostModal.tsx';
import RecreateViralPostModal from './src/components/main/RecreateViralPostModal.tsx';
import ImageCropperModal from './components/ImageCropperModal.tsx';
import { 
    CardStyleSettings, ContentType, ContentCategory, LanguageOptions, CountryOptions, Emotions, 
    HeadlineFontOptions, FontWeightOptions, TextCase, OutlineType, TextAlign, HeaderType, 
    GradientDirectionOptions, FontSizeOptions, OverlayPosition, OverlayBorderPosition,
    MAX_HIGHLIGHT_COLORS, MIN_HIGHLIGHT_COLORS, SelectedHeadlineFontFamily, SelectedFontWeight,
    ContentCategoryValue, SelectedLanguageCode, SelectedCountryCode, FontSizeKey, GradientDirection,
    SelectedEmotion, AppSettings
} from './types.ts';
import { 
    ChevronDownIcon, LanguageIcon, MapPinIcon, TagIcon, SparklesIcon, HashtagIcon, NewsIcon, 
    GenerateIcon, DocumentTextIcon, ClipboardListIcon, FrameIcon, CollageIcon, 
    ChevronLeftIcon, ChevronRightIcon, CloseIcon, ChevronUpIcon, TrashIcon
} from './components/IconComponents.tsx';
import CustomColorPicker from './components/CustomColorPicker.tsx';
import { OverlayTopIcon, OverlayBottomIcon, OverlayLeftIcon, OverlayRightIcon } from './components/IconComponents.tsx';
import { useSettings } from './src/contexts/SettingsContext.tsx';
import Spinner from './components/Spinner.tsx';

// --- MOBILE UI HELPER COMPONENTS ---

type ActiveSheet = 'language' | 'country' | 'contentType' | 'category' | 'emotion' | 'postCount' | 'headerAndHeadline' | 'highlight' | 'summary' | 'outline' | 'overlay' | null;

const SettingsBottomSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; }> = ({ title, onClose, children }) => {
    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} style={{ animation: 'fade-in 0.3s ease-out' }}></div>
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/70 backdrop-blur-xl rounded-t-2xl shadow-2xl z-50 md:hidden max-h-[80vh] flex flex-col" style={{ transformOrigin: 'bottom center', animation: 'unfurl 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="font-bold text-lg">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><CloseIcon /></button>
                </div>
                <div className="overflow-y-auto p-4 scrollbar-thin">
                    {children}
                </div>
            </div>
        </>
    );
};

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-12 gap-2 items-center mb-4">
        <label className="col-span-5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="col-span-7">{children}</div>
    </div>
);

const Slider: React.FC<{ value: number; onChange: (v: number) => void; min: number; max: number; step?: number }> = ({ value, onChange, min, max, step = 1 }) => (
    <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
        <span className="text-xs w-8 text-right font-mono">{value}</span>
    </div>
);

const AlignButtonGroup: React.FC<{ value: TextAlign, onChange: (v: TextAlign) => void }> = ({ value, onChange }) => (
    <div className="flex rounded-md shadow-sm w-full">
        {(['left', 'center', 'right'] as TextAlign[]).map((align, idx) => (
            <button key={align} onClick={() => onChange(align)} className={`px-3 py-1.5 text-xs font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-primary w-full ${value === align ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'} ${idx === 0 ? 'rounded-l-md' : ''} ${idx === 2 ? 'rounded-r-md' : 'border-l-0'} border border-gray-300 dark:border-gray-600`}>
                {align.charAt(0).toUpperCase() + align.slice(1)}
            </button>
        ))}
    </div>
);

const OverlayPositionButtons: React.FC<{ value: OverlayPosition, onChange: (v: OverlayPosition) => void }> = ({ value, onChange }) => (
    <div className="flex justify-around">
        <button onClick={() => onChange('top')}><OverlayTopIcon isActive={value === 'top'} title="Top Overlay"/></button>
        <button onClick={() => onChange('bottom')}><OverlayBottomIcon isActive={value === 'bottom'} title="Bottom Overlay" /></button>
        <button onClick={() => onChange('left')}><OverlayLeftIcon isActive={value === 'left'} title="Left Overlay" /></button>
        <button onClick={() => onChange('right')}><OverlayRightIcon isActive={value === 'right'} title="Right Overlay" /></button>
    </div>
);


const MobileFooterToolbar: React.FC<{
    onGenerate: () => void;
    isLoading: boolean;
    onSheetToggle: (sheet: ActiveSheet) => void;
}> = ({ onGenerate, isLoading, onSheetToggle }) => {
    const { settings } = useSettings();
    const footerScrollRef = useRef<HTMLDivElement>(null);
    const [showScrollArrows, setShowScrollArrows] = useState({ left: false, right: false });

    const checkScroll = useCallback(() => {
        const el = footerScrollRef.current;
        if (el) {
            const hasOverflow = el.scrollWidth > el.clientWidth;
            const scrollEnd = Math.ceil(el.scrollLeft) >= el.scrollWidth - el.clientWidth;
            setShowScrollArrows({
                left: el.scrollLeft > 1,
                right: hasOverflow && !scrollEnd,
            });
        }
    }, []);

    useEffect(() => {
        const el = footerScrollRef.current;
        if (el) {
            checkScroll();
            const resizeObserver = new ResizeObserver(checkScroll);
            resizeObserver.observe(el);
            return () => resizeObserver.disconnect();
        }
    }, [checkScroll]);

    const FooterButton: React.FC<{ icon: React.ReactNode; label: string; value?: string; onClick: () => void }> = ({ icon, label, value, onClick }) => (
        <button onClick={onClick} className="flex flex-col items-center justify-center gap-1 flex-shrink-0 w-20 text-center p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors">
            <div className="text-white">{icon}</div>
            <span className="text-xs font-semibold text-white truncate w-full">{label}</span>
            {value && <span className="text-[10px] text-gray-400 truncate w-full">{value}</span>}
        </button>
    );

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-black/70 backdrop-blur-lg border-t border-white/10 z-30 md:hidden">
            <div className="flex items-center gap-1 p-1">
                <div className="relative flex-grow flex items-center overflow-hidden">
                    {showScrollArrows.left && <div className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pointer-events-none"><ChevronLeftIcon className="w-5 h-5 text-white/70" /></div>}
                    <div ref={footerScrollRef} onScroll={checkScroll} className="overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent">
                        <div className="flex items-center gap-1 px-2">
                             <FooterButton icon={<GenerateIcon className="w-5 h-5"/>} label="Generate" value={`${settings.postCount} Posts`} onClick={() => onSheetToggle('postCount')} />
                             <FooterButton icon={<NewsIcon className="w-5 h-5"/>} label="Type" value={settings.selectedContentType} onClick={() => onSheetToggle('contentType')} />
                             <FooterButton icon={<TagIcon className="w-5 h-5"/>} label="Category" value={settings.selectedContentCategory} onClick={() => onSheetToggle('category')} />
                             <FooterButton icon={<SparklesIcon className="w-5 h-5"/>} label="Emotion" value={Emotions[settings.selectedEmotion].split(' ')[1]} onClick={() => onSheetToggle('emotion')} />
                             <FooterButton icon={<LanguageIcon className="w-5 h-5"/>} label="Language" value={LanguageOptions[settings.selectedLanguage]} onClick={() => onSheetToggle('language')} />
                             <FooterButton icon={<MapPinIcon className="w-5 h-5"/>} label="Country" value={CountryOptions[settings.selectedCountryCode]} onClick={() => onSheetToggle('country')} />
                             <div className="w-px h-10 bg-white/20 mx-2"></div>
                             <FooterButton icon={<DocumentTextIcon className="w-5 h-5"/>} label="Header" onClick={() => onSheetToggle('headerAndHeadline')} />
                             <FooterButton icon={<SparklesIcon className="w-5 h-5"/>} label="Highlight" onClick={() => onSheetToggle('highlight')} />
                             <FooterButton icon={<ClipboardListIcon className="w-5 h-5"/>} label="Summary" onClick={() => onSheetToggle('summary')} />
                             <FooterButton icon={<FrameIcon className="w-5 h-5"/>} label="Outline" onClick={() => onSheetToggle('outline')} />
                             <FooterButton icon={<CollageIcon className="w-5 h-5"/>} label="Overlay" onClick={() => onSheetToggle('overlay')} />
                        </div>
                    </div>
                    {showScrollArrows.right && <div className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pointer-events-none"><ChevronRightIcon className="w-5 h-5 text-white/70" /></div>}
                </div>
                <div className="pl-1 pr-2 flex-shrink-0">
                    <button onClick={onGenerate} disabled={isLoading} className="w-20 h-20 bg-primary text-primary-text font-bold rounded-2xl disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform transition-all text-sm">
                        {isLoading ? <Spinner size="sm" /> : <GenerateIcon />}
                        <span>{isLoading ? '...' : 'Generate'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};


const MainAppPage: React.FC = () => {
    const { setSidebarControls } = useSidebar();
    const { setHeaderActions } = usePageActions();
    const { settings, updateSetting } = useSettings();

    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [isEditingAll, setIsEditingAll] = useState<boolean>(false);
    const [isViralPostModalOpen, setIsViralPostModalOpen] = useState<boolean>(false);
    const [isRecreateModalOpen, setIsRecreateModalOpen] = useState<boolean>(false);
    const [isToolbarVisible, setIsToolbarVisible] = useState(true);
    const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
    const [cropRequest, setCropRequest] = useState<{ file: File; articleId: string } | null>(null);
    const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
    
    const contentManager = useContentManager(setCropRequest);
    const { cards, setCards, uploadingCardId } = contentManager;


    useEffect(() => {
        setHeaderActions(
            <button
                onClick={() => setIsToolbarVisible(prev => !prev)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700/50 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600/50 transition-all duration-300 ease-in-out shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                title={isToolbarVisible ? "Hide Controls" : "Show Controls"}
                aria-expanded={isToolbarVisible}
            >
                <span>Controls</span>
                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isToolbarVisible ? 'rotate-180' : 'rotate-0'}`} />
            </button>
        );
        return () => setHeaderActions(null);
    }, [setHeaderActions, isToolbarVisible]);

    const editingCard = useMemo(() => {
        if (!editingCardId) return null;
        const card = cards.find(c => c.id === editingCardId);
        return card?.type === 'news' ? card : null;
    }, [editingCardId, cards]);
    
    const handleUpdateCardStyle = useCallback((articleId: string, newStyles: Partial<CardStyleSettings>) => {
        setCards(prev => prev.map(c =>
            (c.id === articleId && c.type === 'news')
                ? { ...c, style: { ...c.style, ...newStyles } }
                : c
        ));
    }, [setCards]);

    const handleUpdateAllCardStyles = useCallback((newStyles: Partial<CardStyleSettings>) => {
        setCards(prev => prev.map(c => 
            c.type === 'news' ? { ...c, style: { ...c.style, ...newStyles } } : c
        ));
    }, [setCards]);
    
    const toggleEditAll = useCallback(() => {
        const nextState = !isEditingAll;
        setIsEditingAll(nextState);
        if (nextState) setEditingCardId(null);
    }, [isEditingAll]);

    const handleSelectCardForEditing = useCallback((cardId: string) => {
        setIsEditingAll(false);
        setEditingCardId(prevId => (prevId === cardId ? null : cardId));
    }, []);

    useEffect(() => {
        setSidebarControls(
            <SettingsSidebar 
                editingCard={editingCard}
                isEditingAll={isEditingAll}
                onUpdateCardStyle={handleUpdateCardStyle}
                onUpdateAllCardStyles={handleUpdateAllCardStyles}
                onToggleEditAll={toggleEditAll}
                onFinishEditing={() => setEditingCardId(null)}
                onUpdateText={contentManager.handleUpdateTextAndRegenerate}
                onRegenerateAllHeadlines={contentManager.handleRegenerateAllHeadlines}
            />
        );
        return () => setSidebarControls(null);
    }, [editingCard, isEditingAll, setSidebarControls, handleUpdateCardStyle, handleUpdateAllCardStyles, toggleEditAll, contentManager.handleUpdateTextAndRegenerate, contentManager.handleRegenerateAllHeadlines]);

    const handleSheetToggle = (sheet: ActiveSheet) => setActiveSheet(prev => (prev === sheet ? null : sheet));

    const stylesForMobile = editingCard?.style ?? settings;

// FIX: Corrected function names and dependency array.
    const handleMobileStyleChange = useCallback(<K extends keyof CardStyleSettings>(key: K, value: CardStyleSettings[K]) => {
        if (editingCard) {
            handleUpdateCardStyle(editingCard.id, { [key]: value });
        } else {
            updateSetting(key, value as AppSettings[K]);
            handleUpdateAllCardStyles({ [key]: value });
        }
    }, [editingCard, handleUpdateCardStyle, handleUpdateAllCardStyles, updateSetting]);

    const renderSheetContent = () => {
        switch (activeSheet) {
            case 'language': return <ul className="space-y-1">{Object.entries(LanguageOptions).map(([value, label]) => <li key={value}><button onClick={() => { updateSetting('selectedLanguage', value as any); setActiveSheet(null); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{label}</button></li>)}</ul>;
            case 'country': return <ul className="space-y-1">{Object.entries(CountryOptions).map(([value, label]) => <li key={value}><button onClick={() => { updateSetting('selectedCountryCode', value as any); setActiveSheet(null); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{label}</button></li>)}</ul>;
            case 'contentType': return <ul className="space-y-1">{Object.values(ContentType).map(value => <li key={value}><button onClick={() => { updateSetting('selectedContentType', value); setActiveSheet(null); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{value.charAt(0).toUpperCase() + value.slice(1)}</button></li>)}</ul>;
            case 'category': return <ul className="max-h-96 overflow-y-auto space-y-1 scrollbar-thin">{Object.values(ContentCategory).map(value => <li key={value}><button onClick={() => { updateSetting('selectedContentCategory', value); setActiveSheet(null); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{value}</button></li>)}</ul>;
            case 'emotion': return <ul className="space-y-1">{Object.entries(Emotions).map(([value, label]) => <li key={value}><button onClick={() => { updateSetting('selectedEmotion', value as any); setActiveSheet(null); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{label}</button></li>)}</ul>;
            case 'postCount': return <ul className="space-y-1">{Array.from({ length: 10 }, (_, i) => i + 1).map(value => <li key={value}><button onClick={() => { updateSetting('postCount', value); setActiveSheet(null); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{value}</button></li>)}</ul>;
            case 'headerAndHeadline': return <div className="space-y-4">
                <FormRow label="Header Type">
                    <div className="flex rounded-md shadow-sm w-full">
                        <button onClick={() => handleMobileStyleChange('headerType', HeaderType.Solid)} className={`px-3 py-1.5 text-xs w-full rounded-l-md ${stylesForMobile.headerType === HeaderType.Solid ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Solid</button>
                        <button onClick={() => handleMobileStyleChange('headerType', HeaderType.Gradient)} className={`px-3 py-1.5 text-xs w-full rounded-r-md ${stylesForMobile.headerType === HeaderType.Gradient ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Gradient</button>
                    </div>
                </FormRow>
                {stylesForMobile.headerType === HeaderType.Solid ? (
                    <FormRow label="Color"><CustomColorPicker value={stylesForMobile.selectedHeaderColor} onChange={c => handleMobileStyleChange('selectedHeaderColor', c)} isOpen={activeColorPicker === 'headerSolid'} onToggle={() => setActiveColorPicker(p => p === 'headerSolid' ? null : 'headerSolid')} /></FormRow>
                ) : (
                    <>
                        <FormRow label="Direction"><select value={stylesForMobile.headerGradientDirection} onChange={e => handleMobileStyleChange('headerGradientDirection', e.target.value as GradientDirection)} className="w-full p-2 border rounded-md text-sm">{Object.entries(GradientDirectionOptions).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></FormRow>
                        <FormRow label="Color 1"><CustomColorPicker value={stylesForMobile.headerGradientColor1} onChange={c => handleMobileStyleChange('headerGradientColor1', c)} isOpen={activeColorPicker === 'headerGrad1'} onToggle={() => setActiveColorPicker(p => p === 'headerGrad1' ? null : 'headerGrad1')} /></FormRow>
                        <FormRow label="Color 2"><CustomColorPicker value={stylesForMobile.headerGradientColor2} onChange={c => handleMobileStyleChange('headerGradientColor2', c)} isOpen={activeColorPicker === 'headerGrad2'} onToggle={() => setActiveColorPicker(p => p === 'headerGrad2' ? null : 'headerGrad2')} /></FormRow>
                    </>
                )}
                <hr className="my-4 border-gray-300 dark:border-gray-600" />
                <FormRow label="Font Family"><select value={stylesForMobile.headlineFontFamily} onChange={e => handleMobileStyleChange('headlineFontFamily', e.target.value as SelectedHeadlineFontFamily)} className="w-full p-2 border rounded-md text-sm">{Object.entries(HeadlineFontOptions).map(([val, name]) => <option key={val} value={val}>{name}</option>)}</select></FormRow>
                <FormRow label="Font Weight"><select value={stylesForMobile.headlineFontWeight} onChange={e => handleMobileStyleChange('headlineFontWeight', e.target.value as SelectedFontWeight)} className="w-full p-2 border rounded-md text-sm">{Object.entries(FontWeightOptions).map(([val, name]) => <option key={val} value={val}>{name}</option>)}</select></FormRow>
                <FormRow label="Text Case">
                    <div className="flex rounded-md shadow-sm w-full"><button onClick={() => handleMobileStyleChange('textCase', TextCase.Default)} className={`px-3 py-1.5 text-xs w-full rounded-l-md ${stylesForMobile.textCase === TextCase.Default ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Default</button><button onClick={() => handleMobileStyleChange('textCase', TextCase.Uppercase)} className={`px-3 py-1.5 text-xs w-full rounded-r-md ${stylesForMobile.textCase === TextCase.Uppercase ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>UPPERCASE</button></div>
                </FormRow>
                <FormRow label="Alignment"><AlignButtonGroup value={stylesForMobile.headlineTextAlign} onChange={v => handleMobileStyleChange('headlineTextAlign', v)} /></FormRow>
                <FormRow label="Font Size"><Slider value={stylesForMobile.headlineTextSize} onChange={v => handleMobileStyleChange('headlineTextSize', v)} min={16} max={80} /></FormRow>
                <FormRow label="Width %"><Slider value={stylesForMobile.headlineTextWidth} onChange={v => handleMobileStyleChange('headlineTextWidth', v)} min={30} max={100} /></FormRow>
                <FormRow label="Spacing"><Slider value={stylesForMobile.headlineLetterSpacing} onChange={v => handleMobileStyleChange('headlineLetterSpacing', v)} min={-5} max={20} /></FormRow>
                <FormRow label="Line Height"><Slider value={stylesForMobile.headlineLineHeight} onChange={v => handleMobileStyleChange('headlineLineHeight', v)} min={0.8} max={2.5} step={0.1} /></FormRow>
            </div>;
            case 'highlight': return <ul className="space-y-2">{stylesForMobile.headlineHighlightColors.map((color, index) => (<li key={index} className="flex items-center gap-2"><div className="w-full"><CustomColorPicker label={`Highlight color ${index+1}`} value={color} onChange={c => handleMobileStyleChange('headlineHighlightColors', stylesForMobile.headlineHighlightColors.map((col, i) => i === index ? c : col))} isOpen={activeColorPicker === `hl-${index}`} onToggle={() => setActiveColorPicker(p => p === `hl-${index}` ? null : `hl-${index}`)} /></div><button onClick={() => handleMobileStyleChange('headlineHighlightColors', stylesForMobile.headlineHighlightColors.filter((_, i) => i !== index))} disabled={stylesForMobile.headlineHighlightColors.length <= MIN_HIGHLIGHT_COLORS} className="p-1 text-red-500 disabled:opacity-50"><TrashIcon className="w-4 h-4" /></button></li>))}<button onClick={() => handleMobileStyleChange('headlineHighlightColors', [...stylesForMobile.headlineHighlightColors, '#1EA7FD'])} disabled={stylesForMobile.headlineHighlightColors.length >= MAX_HIGHLIGHT_COLORS} className="w-full mt-2 text-sm py-1 px-2 rounded-md bg-gray-200 dark:bg-gray-700 disabled:opacity-50">+ Add Color</button></ul>;
            case 'summary': return <div className="space-y-4">
                <FormRow label="Show Summary"><input type="checkbox" checked={stylesForMobile.showSummary} onChange={e => handleMobileStyleChange('showSummary', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
                <FormRow label="Font Size"><div className="flex rounded-md shadow-sm w-full">{(Object.keys(FontSizeOptions) as FontSizeKey[]).map(key => (<button key={key} onClick={() => handleMobileStyleChange('summaryFontSizeKey', key)} className={`px-3 py-1.5 text-xs w-full ${stylesForMobile.summaryFontSizeKey === key ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>{key}</button>))}</div></FormRow>
                <FormRow label="Show Sources"><input type="checkbox" checked={stylesForMobile.showSources} onChange={e => handleMobileStyleChange('showSources', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
            </div>;
            case 'outline': return <div className="space-y-4">
                <FormRow label="Enable Outline"><input type="checkbox" checked={stylesForMobile.outlineEnabled} onChange={e => handleMobileStyleChange('outlineEnabled', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
                {stylesForMobile.outlineEnabled && (<><FormRow label="Type"><select value={stylesForMobile.outlineType} onChange={e => handleMobileStyleChange('outlineType', e.target.value as OutlineType)} className="w-full p-2 border rounded-md text-sm">{Object.values(OutlineType).map(t => <option key={t} value={t}>{t}</option>)}</select></FormRow><FormRow label="Color"><CustomColorPicker label="Outline color" value={stylesForMobile.outlineColor} onChange={c => handleMobileStyleChange('outlineColor', c)} isOpen={activeColorPicker === 'outline'} onToggle={() => setActiveColorPicker(p => p === 'outline' ? null : 'outline')} /></FormRow><FormRow label="Width"><Slider value={stylesForMobile.outlineWidth} onChange={v => handleMobileStyleChange('outlineWidth', v)} min={1} max={20} /></FormRow><FormRow label="Radius"><Slider value={stylesForMobile.outlineRoundedCorners} onChange={v => handleMobileStyleChange('outlineRoundedCorners', v)} min={0} max={50} /></FormRow><FormRow label="Offset"><Slider value={stylesForMobile.outlineOffset} onChange={v => handleMobileStyleChange('outlineOffset', v)} min={0} max={30} /></FormRow></>)}
            </div>;
            case 'overlay': return <div className="space-y-4">
                <FormRow label="Enable Overlay"><input type="checkbox" checked={stylesForMobile.overlayVisible} onChange={e => handleMobileStyleChange('overlayVisible', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
                {stylesForMobile.overlayVisible && (<><FormRow label="Position"><OverlayPositionButtons value={stylesForMobile.overlayPosition} onChange={v => handleMobileStyleChange('overlayPosition', v)} /></FormRow><FormRow label="Type"><div className="flex rounded-md shadow-sm w-full"><button onClick={() => handleMobileStyleChange('overlayIsSolid', true)} className={`px-3 py-1.5 text-xs w-full rounded-l-md ${stylesForMobile.overlayIsSolid ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Solid</button><button onClick={() => handleMobileStyleChange('overlayIsSolid', false)} className={`px-3 py-1.5 text-xs w-full rounded-r-md ${!stylesForMobile.overlayIsSolid ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Gradient</button></div></FormRow><FormRow label="Color"><CustomColorPicker label="Overlay color" value={stylesForMobile.overlayBackgroundColor} onChange={c => handleMobileStyleChange('overlayBackgroundColor', c)} isOpen={activeColorPicker === 'overlay'} onToggle={() => setActiveColorPicker(p => p === 'overlay' ? null : 'overlay')} /></FormRow><FormRow label="Size %"><Slider value={stylesForMobile.overlayHeight} onChange={v => handleMobileStyleChange('overlayHeight', v)} min={5} max={100} /></FormRow></>)}
            </div>;
            default: return null;
        }
    };

    return (
        <>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isToolbarVisible ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <ActionToolbar
                    contentManager={contentManager}
                    cardCount={cards.length}
                    isEditingAll={isEditingAll}
                    onToggleEditAll={toggleEditAll}
                    onOpenViralPostModal={() => setIsViralPostModalOpen(true)}
                    onOpenRecreateModal={() => setIsRecreateModalOpen(true)}
                />
            </div>
            
            <div className="pb-28 md:pb-0">
                <CardGrid
                    cards={cards}
                    isLoading={contentManager.isLoading}
                    editingCardId={editingCardId}
                    isEditingAll={isEditingAll}
                    uploadingCardId={uploadingCardId}
                    onDownloadCard={contentManager.handleDownloadCard}
                    onGenerateAiImage={contentManager.handleGenerateAiImageForCard}
                    onUploadImage={contentManager.handleLocalImageUpload}
                    onEditCard={handleSelectCardForEditing}
                    onDownloadViralPost={contentManager.handleDownloadViralPost}
                    onPostToFacebook={contentManager.handlePostCardToFacebook}
                />
            </div>
            
            <ViralPostModal isOpen={isViralPostModalOpen} onClose={() => setIsViralPostModalOpen(false)} onGenerate={contentManager.handleGenerateViralPost} />
            <RecreateViralPostModal isOpen={isRecreateModalOpen} onClose={() => setIsRecreateModalOpen(false)} onRecreate={contentManager.handleRecreateFromImage} />
            {cropRequest && <ImageCropperModal imageFile={cropRequest.file} onClose={() => setCropRequest(null)} onCrop={(croppedDataUrl) => { contentManager.handleCropConfirm(cropRequest.articleId, croppedDataUrl); setCropRequest(null); }} />}

            <MobileFooterToolbar
                onGenerate={() => contentManager.handleGenerateContent()}
                isLoading={contentManager.isLoading}
                onSheetToggle={handleSheetToggle}
            />
            {activeSheet && (
                <SettingsBottomSheet
                    title={activeSheet === 'headerAndHeadline' ? 'Header & Headline' : activeSheet.charAt(0).toUpperCase() + activeSheet.slice(1).replace(/([A-Z])/g, ' $1')}
                    onClose={() => setActiveSheet(null)}
                >
                    {renderSheetContent()}
                </SettingsBottomSheet>
            )}
        </>
    );
};


export default MainAppPage;