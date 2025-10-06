import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import {
    ChevronUpIcon, ChevronDownIcon, TrashIcon
} from '../../../components/IconComponents.tsx';
import CustomColorPicker from '../../../components/CustomColorPicker.tsx';
import {
    NewsArticle, CardStyleSettings, ContentType, ContentCategory, LanguageOptions, CountryOptions,
    HeadlineFontOptions, FontWeightOptions, FontSizeOptions, TextCase, OutlineType, TextAlign,
    HeaderType, GradientDirectionOptions, SelectedHeadlineFontFamily, SelectedFontWeight,
    ContentCategoryValue, SelectedLanguageCode, SelectedCountryCode, FontSizeKey, GradientDirection as GradientDirectionType,
    OverlayPosition, OverlayBorderPosition, MAX_HIGHLIGHT_COLORS, MIN_HIGHLIGHT_COLORS, Emotions, SelectedEmotion, AppSettings
} from '../../../types.ts';
import { OverlayTopIcon, OverlayBottomIcon, OverlayLeftIcon, OverlayRightIcon } from '../../../components/IconComponents.tsx';

interface SettingsSidebarProps {
    editingCard: NewsArticle | null;
    isEditingAll: boolean;
    onUpdateCardStyle: (id: string, styles: Partial<CardStyleSettings>) => void;
    onUpdateAllCardStyles: (styles: Partial<CardStyleSettings>) => void;
    onToggleEditAll: () => void;
    onFinishEditing: () => void;
    onUpdateText: (articleId: string, updates: { headline: string; summary: string; wordCount?: number }) => void;
    onRegenerateAllHeadlines: (wordCount: number) => void;
}


// --- HELPER COMPONENTS (Scoped to this file for simplicity) ---

const AccordionSection: React.FC<{ title: string; isOpen: boolean; setIsOpen: (isOpen: boolean) => void; children: React.ReactNode }> = ({ title, isOpen, setIsOpen, children }) => (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 text-left font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span>{title}</span>
            {isOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>
        {isOpen && <div className="p-4 bg-gray-50 dark:bg-gray-800 space-y-4">{children}</div>}
    </div>
);

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-12 gap-2 items-center">
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


const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
    editingCard, isEditingAll, onUpdateCardStyle, onUpdateAllCardStyles, onToggleEditAll, onFinishEditing, onUpdateText, onRegenerateAllHeadlines
}) => {
    const { settings, updateSetting } = useSettings();
    const [openSections, setOpenSections] = useState({ general: true, textContent: true, headline: false, highlight: false, summary: false, outline: false, overlay: false });
    const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
    
    const [textEditState, setTextEditState] = useState({ headline: '', summary: '', wordCount: '' });
    const [bulkWordCount, setBulkWordCount] = useState('');

    useEffect(() => {
        if (editingCard) {
            setTextEditState({
                headline: editingCard.long_headline,
                summary: editingCard.summary,
                wordCount: '' // Reset word count on card change
            });
        }
    }, [editingCard]);

    const handleTextEditChange = (field: keyof typeof textEditState, value: string) => {
        setTextEditState(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveText = () => {
        if (!editingCard) return;
        const wordCountNum = parseInt(textEditState.wordCount, 10);
        onUpdateText(editingCard.id, {
            headline: textEditState.headline,
            summary: textEditState.summary,
            wordCount: isNaN(wordCountNum) ? undefined : wordCountNum
        });
    };

    const toggleSection = (section: keyof typeof openSections) => setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    const handleColorPickerToggle = (pickerId: string) => setActiveColorPicker(prev => prev === pickerId ? null : pickerId);

    const stylesForSidebar = useMemo(() => isEditingAll ? settings : (editingCard?.style ?? settings), [isEditingAll, editingCard, settings]);

    const handleStyleChange = useCallback(<K extends keyof CardStyleSettings>(key: K, value: CardStyleSettings[K]) => {
        if (isEditingAll) {
            onUpdateAllCardStyles({ [key]: value });
            updateSetting(key, value as AppSettings[K]); // Also update default
        } else if (editingCard) {
            onUpdateCardStyle(editingCard.id, { [key]: value });
        } else {
            // When not editing a specific card, update the defaults AND apply to all visible cards
            updateSetting(key, value as AppSettings[K]);
            onUpdateAllCardStyles({ [key]: value });
        }
    }, [editingCard, isEditingAll, onUpdateCardStyle, onUpdateAllCardStyles, updateSetting]);
    
    const handleHighlightColorChange = (index: number, newColor: string) => handleStyleChange('headlineHighlightColors', stylesForSidebar.headlineHighlightColors.map((c, i) => i === index ? newColor : c));
    const handleAddHighlightColor = () => stylesForSidebar.headlineHighlightColors.length < MAX_HIGHLIGHT_COLORS && handleStyleChange('headlineHighlightColors', [...stylesForSidebar.headlineHighlightColors, '#1EA7FD']);
    const handleRemoveHighlightColor = (index: number) => stylesForSidebar.headlineHighlightColors.length > MIN_HIGHLIGHT_COLORS && handleStyleChange('headlineHighlightColors', stylesForSidebar.headlineHighlightColors.filter((_, i) => i !== index));

    return (
        <div className="hidden lg:block">
            <div className="p-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                {isEditingAll ? (
                    <div><p className="text-sm font-semibold text-primary text-center">Bulk Editing All Cards</p><button onClick={onToggleEditAll} className="w-full mt-2 text-sm py-1 px-2 rounded-md bg-primary text-primary-text hover:bg-primary-hover">Finish</button></div>
                ) : editingCard ? (
                    <div><p className="text-sm font-semibold text-primary truncate text-center">Editing Card</p><p className="text-xs text-center truncate">{editingCard.long_headline}</p><button onClick={onFinishEditing} className="w-full mt-2 text-sm py-1 px-2 rounded-md bg-primary text-primary-text hover:bg-primary-hover">Finish</button></div>
                ) : (
                    <p className="font-semibold text-center">Default Content Settings</p>
                )}
            </div>
            
            <div className="hidden md:block">
                <AccordionSection title="General Settings" isOpen={openSections.general} setIsOpen={() => toggleSection('general')}>
                    <FormRow label="Content Type"><select value={settings.selectedContentType} onChange={e => updateSetting('selectedContentType', e.target.value as ContentType)} className="w-full p-1.5 border rounded-md text-sm">{Object.values(ContentType).map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select></FormRow>
                    <FormRow label="Category"><select value={settings.selectedContentCategory} onChange={e => updateSetting('selectedContentCategory', e.target.value as ContentCategoryValue)} className="w-full p-1.5 border rounded-md text-sm">{Object.values(ContentCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></FormRow>
                    <FormRow label="Emotion"><select value={settings.selectedEmotion} onChange={e => updateSetting('selectedEmotion', e.target.value as SelectedEmotion)} className="w-full p-1.5 border rounded-md text-sm">{Object.entries(Emotions).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></FormRow>
                    <FormRow label="Language"><select value={settings.selectedLanguage} onChange={e => updateSetting('selectedLanguage', e.target.value as SelectedLanguageCode)} className="w-full p-1.5 border rounded-md text-sm">{Object.entries(LanguageOptions).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></FormRow>
                    <FormRow label="Country"><select value={settings.selectedCountryCode} onChange={e => updateSetting('selectedCountryCode', e.target.value as SelectedCountryCode)} className="w-full p-1.5 border rounded-md text-sm">{Object.entries(CountryOptions).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></FormRow>
                    <FormRow label="# of Posts"><Slider value={settings.postCount} onChange={v => updateSetting('postCount', v)} min={1} max={10} /></FormRow>
                </AccordionSection>
            </div>

            {editingCard && !isEditingAll && (
                <AccordionSection title="Text Content" isOpen={openSections.textContent} setIsOpen={() => toggleSection('textContent')}>
                    <FormRow label="Headline"><textarea value={textEditState.headline} onChange={e => handleTextEditChange('headline', e.target.value)} rows={4} className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-gray-700 dark:border-gray-600" /></FormRow>
                    <FormRow label="Summary"><textarea value={textEditState.summary} onChange={e => handleTextEditChange('summary', e.target.value)} rows={3} className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-gray-700 dark:border-gray-600" /></FormRow>
                    <hr className="my-3 border-gray-300 dark:border-gray-600" />
                    <FormRow label="Word Count"><input type="number" value={textEditState.wordCount} onChange={e => handleTextEditChange('wordCount', e.target.value)} placeholder="e.g., 5" min="1" className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-gray-700 dark:border-gray-600" /></FormRow>
                    <p className="text-xs text-gray-500 -mt-2 px-1">Set a word count to regenerate the headline. Leave blank to only save text changes.</p>
                    <button onClick={handleSaveText} className="w-full mt-2 py-2 px-4 bg-primary text-primary-text font-semibold rounded-md hover:bg-primary-hover">Save & Regenerate Text</button>
                </AccordionSection>
            )}

            <AccordionSection title="Header & Headline" isOpen={openSections.headline} setIsOpen={() => toggleSection('headline')}>
                <FormRow label="Header Type"><div className="flex rounded-md shadow-sm w-full"><button onClick={() => handleStyleChange('headerType', HeaderType.Solid)} className={`px-3 py-1.5 text-xs w-full rounded-l-md ${stylesForSidebar.headerType === HeaderType.Solid ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Solid</button><button onClick={() => handleStyleChange('headerType', HeaderType.Gradient)} className={`px-3 py-1.5 text-xs w-full rounded-r-md ${stylesForSidebar.headerType === HeaderType.Gradient ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Gradient</button></div></FormRow>
                {stylesForSidebar.headerType === HeaderType.Solid ? (<FormRow label="Color"><CustomColorPicker value={stylesForSidebar.selectedHeaderColor} onChange={c => handleStyleChange('selectedHeaderColor', c)} isOpen={activeColorPicker === 'headerSolid'} onToggle={() => handleColorPickerToggle('headerSolid')} /></FormRow>) : (<><FormRow label="Direction"><select value={stylesForSidebar.headerGradientDirection} onChange={e => handleStyleChange('headerGradientDirection', e.target.value as GradientDirectionType)} className="w-full p-1.5 border rounded-md text-sm">{Object.entries(GradientDirectionOptions).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></FormRow><FormRow label="Color 1"><CustomColorPicker value={stylesForSidebar.headerGradientColor1} onChange={c => handleStyleChange('headerGradientColor1', c)} isOpen={activeColorPicker === 'headerGrad1'} onToggle={() => handleColorPickerToggle('headerGrad1')} /></FormRow><FormRow label="Color 2"><CustomColorPicker value={stylesForSidebar.headerGradientColor2} onChange={c => handleStyleChange('headerGradientColor2', c)} isOpen={activeColorPicker === 'headerGrad2'} onToggle={() => handleColorPickerToggle('headerGrad2')} /></FormRow></>)}
                <hr className="my-4 border-gray-300 dark:border-gray-600" />
                <FormRow label="Font Family"><select value={stylesForSidebar.headlineFontFamily} onChange={e => handleStyleChange('headlineFontFamily', e.target.value as SelectedHeadlineFontFamily)} className="w-full p-1.5 border rounded-md text-sm">{Object.entries(HeadlineFontOptions).map(([val, name]) => <option key={val} value={val}>{name}</option>)}</select></FormRow>
                <FormRow label="Font Weight"><select value={stylesForSidebar.headlineFontWeight} onChange={e => handleStyleChange('headlineFontWeight', e.target.value as SelectedFontWeight)} className="w-full p-1.5 border rounded-md text-sm">{Object.entries(FontWeightOptions).map(([val, name]) => <option key={val} value={val}>{name}</option>)}</select></FormRow>
                <FormRow label="Text Case"><div className="flex rounded-md shadow-sm w-full"><button onClick={() => handleStyleChange('textCase', TextCase.Default)} className={`px-3 py-1.5 text-xs w-full rounded-l-md ${stylesForSidebar.textCase === TextCase.Default ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Default</button><button onClick={() => handleStyleChange('textCase', TextCase.Uppercase)} className={`px-3 py-1.5 text-xs w-full rounded-r-md ${stylesForSidebar.textCase === TextCase.Uppercase ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>UPPERCASE</button></div></FormRow>
                <FormRow label="Alignment"><AlignButtonGroup value={stylesForSidebar.headlineTextAlign} onChange={v => handleStyleChange('headlineTextAlign', v)} /></FormRow>
                <FormRow label="Font Size"><Slider value={stylesForSidebar.headlineTextSize} onChange={v => handleStyleChange('headlineTextSize', v)} min={16} max={80} /></FormRow>
                <FormRow label="Width %"><Slider value={stylesForSidebar.headlineTextWidth} onChange={v => handleStyleChange('headlineTextWidth', v)} min={30} max={100} /></FormRow>
                <FormRow label="Spacing"><Slider value={stylesForSidebar.headlineLetterSpacing} onChange={v => handleStyleChange('headlineLetterSpacing', v)} min={-5} max={20} /></FormRow>
                <FormRow label="Line Height"><Slider value={stylesForSidebar.headlineLineHeight} onChange={v => handleStyleChange('headlineLineHeight', v)} min={0.8} max={2.5} step={0.1} /></FormRow>
                 { !editingCard && !isEditingAll && (
                    <>
                        <hr className="my-4 border-gray-300 dark:border-gray-600" />
                        <p className="text-sm font-semibold mb-2">Bulk Headline Regeneration</p>
                        <FormRow label="Set Word Count">
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={bulkWordCount}
                                    onChange={e => setBulkWordCount(e.target.value)}
                                    placeholder="e.g., 5"
                                    min="1"
                                    className="w-24 p-1.5 border rounded-md text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
                                />
                                <button
                                    onClick={() => {
                                        const count = parseInt(bulkWordCount, 10);
                                        if (!isNaN(count) && count > 0) {
                                            onRegenerateAllHeadlines(count);
                                        }
                                    }}
                                    disabled={!bulkWordCount || parseInt(bulkWordCount, 10) <= 0}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                                >
                                    Regenerate All
                                </button>
                            </div>
                        </FormRow>
                    </>
                )}
            </AccordionSection>

            <AccordionSection title="Highlight Colors" isOpen={openSections.highlight} setIsOpen={() => toggleSection('highlight')}>
                <div className="space-y-2">{stylesForSidebar.headlineHighlightColors.map((color, index) => (<div key={index} className="flex items-center gap-2"><div className="w-full"><CustomColorPicker value={color} onChange={c => handleHighlightColorChange(index, c)} isOpen={activeColorPicker === `hl-${index}`} onToggle={() => handleColorPickerToggle(`hl-${index}`)} /></div><button onClick={() => handleRemoveHighlightColor(index)} disabled={stylesForSidebar.headlineHighlightColors.length <= MIN_HIGHLIGHT_COLORS} className="p-1 text-red-500 disabled:opacity-50"><TrashIcon className="w-4 h-4" /></button></div>))}<button onClick={handleAddHighlightColor} disabled={stylesForSidebar.headlineHighlightColors.length >= MAX_HIGHLIGHT_COLORS} className="w-full mt-2 text-sm py-1 px-2 rounded-md bg-gray-200 dark:bg-gray-700 disabled:opacity-50">+ Add Color</button></div>
            </AccordionSection>

            <AccordionSection title="Summary & Sources" isOpen={openSections.summary} setIsOpen={() => toggleSection('summary')}>
                <FormRow label="Show Summary"><input type="checkbox" checked={stylesForSidebar.showSummary} onChange={e => handleStyleChange('showSummary', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
                <FormRow label="Font Size"><div className="flex rounded-md shadow-sm w-full">{(Object.keys(FontSizeOptions) as FontSizeKey[]).map(key => (<button key={key} onClick={() => handleStyleChange('summaryFontSizeKey', key)} className={`px-3 py-1.5 text-xs w-full ${stylesForSidebar.summaryFontSizeKey === key ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>{key}</button>))}</div></FormRow>
                <FormRow label="Show Sources"><input type="checkbox" checked={stylesForSidebar.showSources} onChange={e => handleStyleChange('showSources', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
            </AccordionSection>

            <AccordionSection title="Card Outline" isOpen={openSections.outline} setIsOpen={() => toggleSection('outline')}>
                <FormRow label="Enable Outline"><input type="checkbox" checked={stylesForSidebar.outlineEnabled} onChange={e => handleStyleChange('outlineEnabled', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
                {stylesForSidebar.outlineEnabled && (<><FormRow label="Type"><select value={stylesForSidebar.outlineType} onChange={e => handleStyleChange('outlineType', e.target.value as OutlineType)} className="w-full p-1.5 border rounded-md text-sm">{Object.values(OutlineType).map(t => <option key={t} value={t}>{t}</option>)}</select></FormRow><FormRow label="Color"><CustomColorPicker value={stylesForSidebar.outlineColor} onChange={c => handleStyleChange('outlineColor', c)} isOpen={activeColorPicker === 'outline'} onToggle={() => handleColorPickerToggle('outline')} /></FormRow><FormRow label="Width"><Slider value={stylesForSidebar.outlineWidth} onChange={v => handleStyleChange('outlineWidth', v)} min={1} max={20} /></FormRow><FormRow label="Radius"><Slider value={stylesForSidebar.outlineRoundedCorners} onChange={v => handleStyleChange('outlineRoundedCorners', v)} min={0} max={50} /></FormRow><FormRow label="Offset"><Slider value={stylesForSidebar.outlineOffset} onChange={v => handleStyleChange('outlineOffset', v)} min={0} max={30} /></FormRow></>)}
            </AccordionSection>

            <AccordionSection title="Image Overlay" isOpen={openSections.overlay} setIsOpen={() => toggleSection('overlay')}>
                <FormRow label="Enable Overlay"><input type="checkbox" checked={stylesForSidebar.overlayVisible} onChange={e => handleStyleChange('overlayVisible', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>
                {stylesForSidebar.overlayVisible && (<><FormRow label="Position"><OverlayPositionButtons value={stylesForSidebar.overlayPosition} onChange={v => handleStyleChange('overlayPosition', v)} /></FormRow><FormRow label="Type"><div className="flex rounded-md shadow-sm w-full"><button onClick={() => handleStyleChange('overlayIsSolid', true)} className={`px-3 py-1.5 text-xs w-full rounded-l-md ${stylesForSidebar.overlayIsSolid ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Solid</button><button onClick={() => handleStyleChange('overlayIsSolid', false)} className={`px-3 py-1.5 text-xs w-full rounded-r-md ${!stylesForSidebar.overlayIsSolid ? 'bg-primary text-primary-text' : 'bg-white dark:bg-gray-700'}`}>Gradient</button></div></FormRow><FormRow label="Color"><CustomColorPicker value={stylesForSidebar.overlayBackgroundColor} onChange={c => handleStyleChange('overlayBackgroundColor', c)} isOpen={activeColorPicker === 'overlay'} onToggle={() => handleColorPickerToggle('overlay')} /></FormRow><FormRow label="Size %"><Slider value={stylesForSidebar.overlayHeight} onChange={v => handleStyleChange('overlayHeight', v)} min={5} max={100} /></FormRow><hr className="my-4 border-gray-300 dark:border-gray-600" /><FormRow label="Enable Border"><input type="checkbox" checked={stylesForSidebar.overlayOneSideBorderEnabled} onChange={e => handleStyleChange('overlayOneSideBorderEnabled', e.target.checked)} className="h-5 w-5 rounded text-primary" /></FormRow>{stylesForSidebar.overlayOneSideBorderEnabled && (<><FormRow label="Border Side"><select value={stylesForSidebar.overlayBorderPosition} onChange={e => handleStyleChange('overlayBorderPosition', e.target.value as OverlayBorderPosition)} className="w-full p-1.5 border rounded-md text-sm">{(['top', 'bottom', 'left', 'right'] as OverlayBorderPosition[]).map(p=><option key={p} value={p}>{p}</option>)}</select></FormRow><FormRow label="Border Color"><CustomColorPicker value={stylesForSidebar.overlayBorderColor} onChange={c => handleStyleChange('overlayBorderColor', c)} isOpen={activeColorPicker === 'overlayBorder'} onToggle={() => handleColorPickerToggle('overlayBorder')} /></FormRow><FormRow label="Border Width"><Slider value={stylesForSidebar.overlayBorderWidth} onChange={v => handleStyleChange('overlayBorderWidth', v)} min={1} max={10} /></FormRow></>)}</>)}
            </AccordionSection>
        </div>
    );
};

export default SettingsSidebar;