

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, useRef, PropsWithChildren } from 'react';
import { useSidebar } from './src/contexts/SidebarContext.tsx';
import { useTheme } from './src/contexts/ThemeContext.tsx';
import * as collageService from './src/components/main/collageService.ts';
import { CollageLayout, GlobalCollageSettings } from './services/collageService.ts';
import Spinner from './components/Spinner.tsx';
import { DownloadIcon, ChevronUpIcon, ChevronDownIcon, CollageIcon, UploadIcon, RefreshIcon, ChevronLeftIcon, ChevronRightIcon } from './components/IconComponents.tsx';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import { HeadlineFontOptions } from './types.ts';
import JSZip from 'jszip';


// --- TYPE & DATA DEFINITIONS ---

const layouts: Record<string, CollageLayout> = {
  'single': { id: 'single', name: 'Single', cells: [{ x: 0, y: 0, width: 1, height: 1 }] },
  '2-vert': { id: '2-vert', name: '2 Vertical', cells: [{ x: 0, y: 0, width: 0.5, height: 1 }, { x: 0.5, y: 0, width: 0.5, height: 1 }] },
  '2-horiz': { id: '2-horiz', name: '2 Horizontal', cells: [{ x: 0, y: 0, width: 1, height: 0.5 }, { x: 0, y: 0.5, width: 1, height: 0.5 }] },
  '3-vert': { id: '3-vert', name: '3 Vertical', cells: [{ x: 0, y: 0, width: 1/3, height: 1 }, { x: 1/3, y: 0, width: 1/3, height: 1 }, { x: 2/3, y: 0, width: 1/3, height: 1 }] },
  '3-horiz': { id: '3-horiz', name: '3 Horizontal', cells: [{ x: 0, y: 0, width: 1, height: 1/3 }, { x: 0, y: 1/3, width: 1, height: 1/3 }, { x: 0, y: 2/3, width: 1, height: 1/3 }] },
  '2x2-grid': { id: '2x2-grid', name: '2x2 Grid', cells: [{ x: 0, y: 0, width: 0.5, height: 0.5 }, { x: 0.5, y: 0, width: 0.5, height: 0.5 }, { x: 0, y: 0.5, width: 0.5, height: 0.5 }, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }] },
  '1-top-2-bottom': { id: '1-top-2-bottom', name: '1 Top, 2 Bottom', cells: [{ x: 0, y: 0, width: 1, height: 0.5 }, { x: 0, y: 0.5, width: 0.5, height: 0.5 }, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }] },
  '1-left-2-right': { id: '1-left-2-right', name: '1 Left, 2 Right', cells: [{ x: 0, y: 0, width: 0.5, height: 1 }, { x: 0.5, y: 0, width: 0.5, height: 0.5 }, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }] },
};
type LayoutId = keyof typeof layouts;

interface ImageCell {
  id: number;
  files: File[];
  previewUrl: string | null;
}

interface GlobalCellSettings {
    text: string;
    font: string;
    textColor: string;
    textSize: number;
    emojiSize: number;
    emojiFile: File | null;
    emojiPreviewUrl: string | null;
}

const INITIAL_SETTINGS: GlobalCollageSettings = {
    faceZoomEnabled: true,
    borderSize: 5,
    borderColor: '#FFFFFF',
    gapSize: 5,
    gapColor: '#FFFFFF',
    useWatermark: false,
    watermarkText: 'YourWatermark',
    watermarkColor: '#FFFFFF',
    watermarkOpacity: 70,
};

const INITIAL_CELL_SETTINGS: GlobalCellSettings = {
    text: '',
    font: 'Teko, sans-serif',
    textColor: '#FFFFFF',
    textSize: 10,
    emojiSize: 15,
    emojiFile: null,
    emojiPreviewUrl: null,
};

// --- HELPER COMPONENTS ---
type AccordionSectionProps = PropsWithChildren<{
    title: string;
    defaultOpen?: boolean;
}>;
const AccordionSection = ({ title, defaultOpen = false, children }: AccordionSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 text-left font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span>{title}</span>
                {isOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
            {isOpen && <div className="p-4 bg-gray-50 dark:bg-gray-800 space-y-4">{children}</div>}
        </div>
    );
};

type FormRowProps = PropsWithChildren<{
    label: string;
}>;
const FormRow = ({ label, children }: FormRowProps) => (
    <div className="grid grid-cols-12 gap-2 items-center">
        <label className="col-span-5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="col-span-7">{children}</div>
    </div>
);

const Slider = ({ value, onChange, min, max, step = 1 }: { value: number, onChange: (val: number) => void, min: number, max: number, step?: number }) => (
    <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full" />
        <span className="text-xs w-8 text-right">{value}</span>
    </div>
);

const TemplateIcon: React.FC<{ layout: CollageLayout, isSelected: boolean, onClick: () => void }> = ({ layout, isSelected, onClick }) => {
    return (
        <button 
            onClick={onClick} 
            title={layout.name} 
            className={`w-full aspect-square p-1 rounded-md transition-all duration-200 focus:outline-none ${isSelected ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-primary' : 'ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-primary/70'}`}
        >
            <div 
                className={`w-full h-full transition-colors ${isSelected ? 'bg-primary/20' : 'bg-gray-200 dark:bg-gray-700'}`} 
                style={{ display: 'grid', gridTemplateRows: '1fr', gridTemplateColumns: '1fr', position: 'relative', gap: '2px' }}
            >
                {layout.cells.map((cell, index) => (
                    <div 
                        key={index} 
                        className={`transition-colors ${isSelected ? 'bg-primary/50' : 'bg-gray-400 dark:bg-gray-500'}`} 
                        style={{ 
                            position: 'absolute', 
                            left: `${cell.x * 100}%`, 
                            top: `${cell.y * 100}%`, 
                            width: `${cell.width * 100}%`, 
                            height: `${cell.height * 100}%`,
                            border: `1px solid ${isSelected ? 'var(--app-primary-color)' : 'var(--template-gap-color, #F3F4F6)'}`
                        }}
                    ></div>
                ))}
            </div>
        </button>
    );
};


// --- MAIN PAGE COMPONENT ---
const CollageMakerPage: React.FC = () => {
    const { setSidebarControls } = useSidebar();
    const { theme: globalTheme } = useTheme();
    const { addNotification } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [selectedLayoutId, setSelectedLayoutId] = useState<LayoutId>('2x2-grid');
    const [cells, setCells] = useState<ImageCell[]>([]);
    const [globalSettings, setGlobalSettings] = useState<GlobalCollageSettings>(INITIAL_SETTINGS);
    const [globalCellSettings, setGlobalCellSettings] = useState<GlobalCellSettings>(INITIAL_CELL_SETTINGS);
    
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [maxCollages, setMaxCollages] = useState(0);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isGeneratingZip, setIsGeneratingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);
    const [isModelsLoading, setIsModelsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState('Loading AI face models...');

    // --- Effects ---
    useEffect(() => {
        collageService.loadModels()
            .then(() => {
                setIsModelsLoading(false);
                setStatusMessage('Ready. Select a layout and add image folders.');
                addNotification('AI Models loaded successfully.', 'success');
            })
            .catch(err => {
                console.error("Model loading failed:", err);
                setStatusMessage('Error: AI models failed. Face detection disabled.');
                addNotification('Error: Face detection models failed to load.', 'error');
                setIsModelsLoading(false);
                setGlobalSettings(prev => ({ ...prev, faceZoomEnabled: false }));
            });
    }, [addNotification]);
    
    useEffect(() => {
        const layout = layouts[selectedLayoutId];
        const newCellCount = layout.cells.length;

        setCells(prevCells => {
            return Array.from({ length: newCellCount }, (_, i) => {
                return prevCells[i] && prevCells[i].files ? prevCells[i] : {
                    id: i,
                    files: [],
                    previewUrl: null,
                };
            });
        });
        setPreviewIndex(0);
    }, [selectedLayoutId]);

    useEffect(() => {
        const foldersWithFiles = cells.filter(c => c.files.length > 0);
        if (foldersWithFiles.length === 0 || foldersWithFiles.length < cells.length) {
            setMaxCollages(0);
        } else {
            const minCount = Math.min(...foldersWithFiles.map(c => c.files.length));
            setMaxCollages(minCount);
        }
        setPreviewIndex(0);
    }, [cells]);

    // --- Handlers ---
    const handleGlobalSettingChange = useCallback(<K extends keyof GlobalCollageSettings>(key: K, value: GlobalCollageSettings[K]) => {
        setGlobalSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleGlobalCellSettingChange = useCallback(<K extends keyof GlobalCellSettings>(key: K, value: GlobalCellSettings[K]) => {
        setGlobalCellSettings(prev => ({ ...prev, [key]: value }));
    }, []);
    
    const handleFolderSelect = (cellId: number, fileList: FileList | null) => {
        if (!fileList) return;
        const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            addNotification('No image files found in the selected folder.', 'error');
            return;
        }

        const firstImagePreview = URL.createObjectURL(imageFiles[0]);
        setCells(prevCells => prevCells.map(c => {
            if (c.id === cellId) {
                if (c.previewUrl) URL.revokeObjectURL(c.previewUrl);
                return { ...c, files: imageFiles, previewUrl: firstImagePreview };
            }
            return c;
        }));
        addNotification(`Loaded ${imageFiles.length} images for cell #${cellId + 1}.`, 'success');
    };

    const handlePlaceholderClick = (cellId: number) => {
        if (fileInputRef.current) {
            fileInputRef.current.onchange = (e: any) => e.target.files && handleFolderSelect(cellId, e.target.files);
            fileInputRef.current.click();
        }
    };
    
    const handleEmojiFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const emojiUrl = URL.createObjectURL(file);
            setGlobalCellSettings(prev => ({ ...prev, emojiFile: file, emojiPreviewUrl: emojiUrl }));
        }
    }, []);
    
    const removeEmoji = useCallback(() => {
         setGlobalCellSettings(prev => ({ ...prev, emojiFile: null, emojiPreviewUrl: null }));
    }, []);

    const generatePreview = useCallback(async (index: number) => {
        if (maxCollages === 0) {
             addNotification('Please select folders for all collage cells.', 'error');
             return;
        }
        if (index < 0) index = 0;
        if (index >= maxCollages) {
            addNotification("You've reached the end of the available images.", 'info');
            index = maxCollages - 1;
        }
        setPreviewIndex(index);


        setIsProcessing(true);
        setStatusMessage(`Generating preview for collage #${index + 1}...`);
        
        try {
            const layout = layouts[selectedLayoutId];
            const cellsWithData = cells.map(cell => ({ ...cell, ...globalCellSettings }));
            const collageBlob = await collageService.generateCollage(layout, cellsWithData, globalSettings, globalTheme as 'light' | 'dark', index);
            
            if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
            if (collageBlob) {
                setPreviewImageUrl(URL.createObjectURL(collageBlob));
                setStatusMessage(`Showing preview for collage #${index + 1} of ${maxCollages}.`);
            } else {
                 setPreviewImageUrl(null);
                 setStatusMessage('Could not generate preview.');
            }
        } catch (error) {
            console.error("Preview generation failed:", error);
            const errorMessage = `Preview error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            addNotification(errorMessage, 'error');
            setStatusMessage(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [cells, globalSettings, globalCellSettings, selectedLayoutId, globalTheme, maxCollages, addNotification, previewImageUrl]);

    const handleDownloadAll = useCallback(async () => {
        if (maxCollages === 0) {
            addNotification("No collages to generate. Please select folders for all cells.", "error");
            return;
        }
        setIsGeneratingZip(true);
        setZipProgress(0);
        addNotification(`Starting batch generation of ${maxCollages} collages...`, 'info');
        const zip = new JSZip();

        try {
            for (let i = 0; i < maxCollages; i++) {
                const layout = layouts[selectedLayoutId];
                const cellsWithData = cells.map(cell => ({ ...cell, ...globalCellSettings }));
                const collageBlob = await collageService.generateCollage(layout, cellsWithData, globalSettings, globalTheme as 'light' | 'dark', i);
                if (collageBlob) {
                    zip.file(`collage_${String(i + 1).padStart(3, '0')}.jpeg`, collageBlob);
                }
                setZipProgress(((i + 1) / maxCollages) * 100);
            }

            addNotification('Zipping files...', 'info');
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `collages_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addNotification('ZIP file download started!', 'success');
        } catch (e: any) {
            addNotification(`Error during ZIP generation: ${e.message}`, 'error');
        } finally {
            setIsGeneratingZip(false);
        }
    }, [maxCollages, selectedLayoutId, cells, globalSettings, globalCellSettings, globalTheme, addNotification]);

    // --- Sidebar ---
    const sidebarContent = useMemo(() => (
        <div>
            <div className="p-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-center text-primary">Collage Controls</h2>
            </div>
            
            <AccordionSection title="Collage Template" defaultOpen={true}>
               <div className="grid grid-cols-4 gap-2">
                    {Object.values(layouts).map(layout => (
                       <TemplateIcon key={layout.id} layout={layout} isSelected={selectedLayoutId === layout.id} onClick={() => setSelectedLayoutId(layout.id as LayoutId)} />
                    ))}
                </div>
            </AccordionSection>
            
            <AccordionSection title="Global Cell Settings">
                <FormRow label="Text Label"><input type="text" value={globalCellSettings.text} onChange={e => handleGlobalCellSettingChange('text', e.target.value)} className="w-full p-1.5 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" /></FormRow>
                <FormRow label="Text Font"><select value={globalCellSettings.font} onChange={e => handleGlobalCellSettingChange('font', e.target.value)} className="w-full p-1.5 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-sm">{Object.entries(HeadlineFontOptions).map(([val, name]) => <option key={val} value={val} style={{fontFamily: val}}>{name}</option>)}</select></FormRow>
                <FormRow label="Text Size %"><Slider value={globalCellSettings.textSize} onChange={v => handleGlobalCellSettingChange('textSize', v)} min={2} max={25} /></FormRow>
                <FormRow label="Text Color"><input type="color" value={globalCellSettings.textColor} onChange={e => handleGlobalCellSettingChange('textColor', e.target.value)} className="w-full p-0 h-8 border-none rounded cursor-pointer" /></FormRow>
                <hr className="my-3 border-gray-300 dark:border-gray-600" />
                <div className="flex justify-between items-center"><label className="w-full text-center cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-500 text-white transition-all shadow-md hover:bg-indigo-600"><UploadIcon className="w-4 h-4" />Set Emoji<input type="file" onChange={handleEmojiFileSelect} className="hidden" accept="image/png,image/jpeg"/></label>{globalCellSettings.emojiPreviewUrl && <button onClick={removeEmoji} className="ml-2 p-1 text-red-500 hover:text-red-700"><RefreshIcon className="w-4 h-4"/></button>}</div>
                <FormRow label="Emoji Size %"><Slider value={globalCellSettings.emojiSize} onChange={v => handleGlobalCellSettingChange('emojiSize', v)} min={5} max={50} /></FormRow>
            </AccordionSection>
            
            <AccordionSection title="Global Layout Settings">
                <FormRow label="Center Gap"><Slider value={globalSettings.gapSize} onChange={v => handleGlobalSettingChange('gapSize', v)} min={0} max={50} /></FormRow>
                <FormRow label="Gap Color"><input type="color" value={globalSettings.gapColor} onChange={e => handleGlobalSettingChange('gapColor', e.target.value)} className="w-full p-0 h-8 border-none rounded cursor-pointer" /></FormRow>
                <FormRow label="Outer Border"><Slider value={globalSettings.borderSize} onChange={v => handleGlobalSettingChange('borderSize', v)} min={0} max={50} /></FormRow>
                <FormRow label="Border Color"><input type="color" value={globalSettings.borderColor} onChange={e => handleGlobalSettingChange('borderColor', e.target.value)} className="w-full p-0 h-8 border-none rounded cursor-pointer" /></FormRow>
                <hr className="my-2 border-gray-300 dark:border-gray-600" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={globalSettings.faceZoomEnabled} onChange={e => handleGlobalSettingChange('faceZoomEnabled', e.target.checked)} disabled={isModelsLoading} className="rounded text-primary focus:ring-primary disabled:opacity-50" /> Auto-Zoom Face</label>
                <hr className="my-2 border-gray-300 dark:border-gray-600" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={globalSettings.useWatermark} onChange={e => handleGlobalSettingChange('useWatermark', e.target.checked)} className="rounded text-primary focus:ring-primary" /> Use Watermark</label>
                {globalSettings.useWatermark && (<><input type="text" value={globalSettings.watermarkText} onChange={e => handleGlobalSettingChange('watermarkText', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" /><FormRow label="Color"><input type="color" value={globalSettings.watermarkColor} onChange={e => handleGlobalSettingChange('watermarkColor', e.target.value)} className="w-full p-0 h-8 border-none rounded cursor-pointer" /></FormRow><FormRow label="Opacity %"><Slider value={globalSettings.watermarkOpacity} onChange={v => handleGlobalSettingChange('watermarkOpacity', v)} min={10} max={100} /></FormRow></>)}
            </AccordionSection>
        </div>
    ), [selectedLayoutId, globalSettings, globalCellSettings, isModelsLoading, handleGlobalSettingChange, handleGlobalCellSettingChange, handleEmojiFileSelect, removeEmoji]);

    useEffect(() => {
        setSidebarControls(sidebarContent);
        const gapColor = getComputedStyle(document.body).getPropertyValue('--app-bg') || '#F3F4F6';
        document.documentElement.style.setProperty('--template-gap-color', gapColor);
        return () => setSidebarControls(null);
    }, [sidebarContent, setSidebarControls]);

    const currentLayout = layouts[selectedLayoutId];

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} className="hidden" {...{ webkitdirectory: "true", directory: "true" }} multiple />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                     <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">1. Select Image Folders</h2>
                     <div className="relative aspect-square w-full mx-auto bg-gray-100 dark:bg-gray-900/50 rounded-lg shadow-inner overflow-hidden border dark:border-gray-700">
                        <div className="absolute inset-0 p-1" style={{ display: 'grid' }}>
                             <div className="relative w-full h-full" style={{ gap: `${globalSettings.gapSize / 5}px`, padding: `${globalSettings.borderSize / 5}px` }}>
                                 {currentLayout.cells.map((cellDef, i) => {
                                    const cellData = cells[i];
                                    return (
                                        <div 
                                            key={i} 
                                            onClick={() => handlePlaceholderClick(i)} 
                                            className="absolute bg-gray-300 dark:bg-gray-700/50 hover:bg-gray-400/50 dark:hover:bg-gray-600/50 transition-all duration-200 cursor-pointer group overflow-hidden border border-gray-400 dark:border-gray-600" 
                                            style={{ 
                                                left: `${cellDef.x * 100}%`, 
                                                top: `${cellDef.y * 100}%`, 
                                                width: `${cellDef.width * 100}%`, 
                                                height: `${cellDef.height * 100}%` 
                                            }}
                                        >
                                            {cellData?.previewUrl ? (
                                                <img src={cellData.previewUrl} alt={`Cell ${i+1} preview`} className="w-full h-full object-cover"/>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-2 text-center">
                                                    <UploadIcon className="w-8 h-8 opacity-50"/>
                                                    <span className="text-xs mt-1 font-semibold">Cell #{i + 1}</span>
                                                    <span className="text-xs">Click to Select Folder</span>
                                                </div>
                                            )}
                                            <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-2 text-center transition-opacity duration-300 ${cellData?.files.length ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <p className="text-white font-bold">Cell #{i + 1}</p>
                                                <p className="text-white text-xs">{cellData?.files.length || 0} images</p>
                                            </div>
                                        </div>
                                    )
                                 })}
                             </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">2. Preview & Generate</h2>
                    <div className="relative aspect-square w-full mx-auto bg-gray-100 dark:bg-gray-900/50 rounded-lg shadow-inner overflow-hidden border dark:border-gray-700">
                        {previewImageUrl ? (<img src={previewImageUrl} alt="Collage Preview" className="w-full h-full object-contain" />) : (
                            <div className="text-center text-gray-500 dark:text-gray-400 p-8 flex flex-col items-center justify-center h-full">
                                {isProcessing || isModelsLoading ? <Spinner size="lg" /> : <CollageIcon className="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600" />}
                                <p className="mt-4 font-semibold">{statusMessage}</p>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <button onClick={() => generatePreview(previewIndex - 1)} disabled={previewIndex === 0 || isProcessing || isGeneratingZip} className="py-2.5 px-2 bg-gray-200 dark:bg-gray-700 rounded-md disabled:opacity-50 flex items-center justify-center gap-2 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><ChevronLeftIcon className="w-5 h-5"/> Prev</button>
                        <button onClick={() => generatePreview(previewIndex)} disabled={isProcessing || maxCollages === 0 || isGeneratingZip} className="py-2.5 px-2 bg-primary text-primary-text rounded-md disabled:opacity-50 flex items-center justify-center gap-2 font-bold shadow-md hover:shadow-lg hover:bg-primary-hover transition-all">
                           {isProcessing ? <Spinner size="sm"/> : <RefreshIcon className="w-5 h-5"/>}
                           {isProcessing ? 'Working...' : `Preview #${previewIndex + 1}`}
                        </button>
                        <button onClick={() => generatePreview(previewIndex + 1)} disabled={previewIndex >= maxCollages - 1 || isProcessing || isGeneratingZip} className="py-2.5 px-2 bg-gray-200 dark:bg-gray-700 rounded-md disabled:opacity-50 flex items-center justify-center gap-2 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Next <ChevronRightIcon className="w-5 h-5"/></button>
                    </div>
                    <div className="mt-2">
                        <button onClick={handleDownloadAll} disabled={isProcessing || isGeneratingZip || maxCollages === 0} className="w-full mt-2 p-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-teal-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-px text-lg">
                            {isGeneratingZip ? <Spinner /> : <DownloadIcon />} {isGeneratingZip ? `Generating... (${Math.round(zipProgress)}%)` : `Download All (${maxCollages}) as ZIP`}
                        </button>
                        {isGeneratingZip && <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 dark:bg-gray-700"><div className="bg-green-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${zipProgress}%`}}></div></div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CollageMakerPage;
