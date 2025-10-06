

import React, { useState, useEffect, useCallback, useRef, PropsWithChildren, ChangeEvent } from 'react';
import JSZip from 'jszip';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import Spinner from './components/Spinner.tsx';
import { UploadIcon, DownloadAllIcon, TrashIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './components/IconComponents.tsx';

// --- TYPE DEFINITIONS & HELPERS ---
interface ImageQueueItem {
    file: File;
    url: string;
    name: string;
}

// --- REUSABLE CONTROL COMPONENTS ---

const UploadQueueControls: React.FC<{
    queue: ImageQueueItem[];
    currentIndex: number;
    onFilesSelect: (files: FileList | null) => void;
    onIndexSelect: (index: number) => void;
    onIndexRemove: (index: number) => void;
}> = ({ queue, currentIndex, onFilesSelect, onIndexSelect, onIndexRemove }) => (
    <div className="group mb-3.5">
        <h3 className="m-0 mb-2.5 text-sm font-bold uppercase tracking-[.12em] text-gray-400">Upload Images</h3>
        <label className="drop grid place-items-center text-center p-5 border border-dashed border-white/20 rounded-2xl text-gray-400 cursor-pointer transition-colors hover:bg-white/5">
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => onFilesSelect(e.target.files)} />
            Drag & drop or tap to choose images
        </label>
        <h3 className="m-0 mt-3.5 mb-2.5 text-sm font-bold uppercase tracking-[.12em] text-gray-400">Queue ({queue.length})</h3>
        <div className="thumbs grid grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-2.5 max-h-52 overflow-y-auto scrollbar-thin pr-2">
            {queue.map((item, idx) => (
                <div key={item.url} onClick={() => onIndexSelect(idx)} className={`thumb glass !rounded-lg relative overflow-hidden border-2 ${idx === currentIndex ? 'border-brand' : 'border-transparent'}`}>
                    <img src={item.url} className="w-full h-20 object-cover block" alt="thumbnail"/>
                    <button title="Remove" onClick={e => { e.stopPropagation(); onIndexRemove(idx); }} className="absolute top-1.5 right-1.5 bg-black/60 text-white border-0 rounded-lg px-1.5 py-1 text-xs cursor-pointer">×</button>
                </div>
            ))}
        </div>
    </div>
);

const FrameControls: React.FC<{
    padding: number; setPadding: (v: number) => void;
    scale: number; setScale: (v: number) => void;
    shadow: number; setShadow: (v: number) => void;
    bgColor: string; setBgColor: (v: string) => void;
    showFrameShadow: boolean; setShowFrameShadow: (v: boolean) => void;
    onChooseFrame: () => void;
}> = ({ padding, setPadding, scale, setScale, shadow, setShadow, bgColor, setBgColor, showFrameShadow, setShowFrameShadow, onChooseFrame }) => (
     <div className="group mb-3.5">
        <h3 className="m-0 mb-2.5 text-sm font-bold uppercase tracking-[.12em] text-gray-400">Frame</h3>
        <button onClick={onChooseFrame} className="btn ghost w-full mb-2.5">Choose Frame PNG</button>
        <div className="grid grid-cols-1 gap-2">
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Inner Padding</label><output className="text-sm font-mono">{padding}px</output></div>
            <input type="range" min={0} max={120} value={padding} onChange={e => setPadding(Number(e.target.value))} />
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Border Scale</label><output className="text-sm font-mono">{scale}%</output></div>
            <input type="range" min={60} max={160} value={scale} onChange={e => setScale(Number(e.target.value))} />
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Border Shadow</label><output className="text-sm font-mono">{shadow}</output></div>
            <input type="range" min={0} max={40} value={shadow} onChange={e => setShadow(Number(e.target.value))} />
        </div>
        <div className="flex gap-2.5 mt-2 items-center">
            <span className="text-sm text-gray-400">Stage BG</span><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
            <button onClick={() => setShowFrameShadow(!showFrameShadow)} className="btn ghost flex-1">Toggle Frame Shadow</button>
        </div>
    </div>
);

const WatermarkControls: React.FC<{
    wmText: string; setWmText: (v: string) => void;
    wmColor: string; setWmColor: (v: string) => void;
    wmHasShadow: boolean; setWmHasShadow: (v: boolean) => void;
    wmSize: number; setWmSize: (v: number) => void;
    wmOpacity: number; setWmOpacity: (v: number) => void;
    wmRotate: number; setWmRotate: (v: number) => void;
    wmMargin: number; setWmMargin: (v: number) => void;
    wmPosition: number; setWmPosition: (v: number) => void;
    showWatermark: boolean; setShowWatermark: (v: boolean) => void;
    onChooseLogo: () => void;
}> = (props) => (
    <div className="group mb-3.5">
        <h3 className="m-0 mb-2.5 text-sm font-bold uppercase tracking-[.12em] text-gray-400">Watermark</h3>
        <div className="grid grid-cols-2 gap-2.5">
            <input value={props.wmText} onChange={e => props.setWmText(e.target.value)} className="text col-span-2 w-full p-2.5 rounded-lg border border-white/15 bg-white/5 text-white" placeholder="Watermark text"/>
            <div className="flex items-center gap-2.5"><input type="color" value={props.wmColor} onChange={e => props.setWmColor(e.target.value)} /><label className="text-sm text-gray-400 flex items-center gap-1.5"><input type="checkbox" checked={props.wmHasShadow} onChange={e => props.setWmHasShadow(e.target.checked)} /> Shadow</label></div>
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Size</label><output className="text-sm font-mono">{props.wmSize}px</output></div>
            <input type="range" min={14} max={120} value={props.wmSize} onChange={e => props.setWmSize(Number(e.target.value))} />
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Opacity</label><output className="text-sm font-mono">{props.wmOpacity}%</output></div>
            <input type="range" min={0} max={100} value={props.wmOpacity} onChange={e => props.setWmOpacity(Number(e.target.value))} />
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Rotation</label><output className="text-sm font-mono">{props.wmRotate}°</output></div>
            <input type="range" min={-45} max={45} value={props.wmRotate} onChange={e => props.setWmRotate(Number(e.target.value))} />
            <div className="control grid grid-cols-[1fr_66px] gap-2.5 items-center"><label className="text-sm text-gray-400">Margin</label><output className="text-sm font-mono">{props.wmMargin}px</output></div>
            <input type="range" min={0} max={120} value={props.wmMargin} onChange={e => props.setWmMargin(Number(e.target.value))} />
        </div>
        <div className="posGrid grid grid-cols-3 gap-1.5 mt-2">
            {Array.from({length: 9}).map((_, i) => <button key={i} onClick={() => props.setWmPosition(i)} className={`py-2 border border-white/15 bg-white/5 rounded-lg transition-all ${i === props.wmPosition ? '!bg-brand text-black font-bold' : 'hover:bg-white/10'}`}>{i+1}</button>)}
        </div>
         <div className="flex gap-2.5 mt-2.5">
            <button onClick={props.onChooseLogo} className="btn ghost flex-1">Logo PNG (optional)</button>
            <button onClick={() => props.setShowWatermark(!props.showWatermark)} className="btn secondary flex-1">Toggle Watermark</button>
        </div>
    </div>
);

const ExportControls: React.FC<{
    exportFormat: 'png' | 'jpg';
    setExportFormat: (f: 'png' | 'jpg') => void;
    onExportOne: () => void;
    isExporting: boolean;
    canExport: boolean;
}> = ({ exportFormat, setExportFormat, onExportOne, isExporting, canExport }) => (
    <div className="group">
        <h3 className="m-0 mb-2.5 text-sm font-bold uppercase tracking-[.12em] text-gray-400">Export</h3>
        <div className="flex gap-2.5">
            <button onClick={onExportOne} disabled={!canExport || isExporting} className="btn flex-1">Export Current</button>
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value as 'png'|'jpg')} className="text w-full p-2.5 rounded-lg border border-white/15 bg-white/5 text-white max-w-[140px]"><option value="png">PNG</option><option value="jpg">JPG</option></select>
        </div>
    </div>
);

// --- MOBILE-SPECIFIC UI COMPONENTS ---

type ActiveSheet = 'upload' | 'frame' | 'watermark' | 'export' | null;

const SettingsBottomSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; }> = ({ title, onClose, children }) => (
    <>
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} style={{ animation: 'fade-in 0.3s ease-out' }}></div>
        <div className="fixed bottom-0 left-0 right-0 glass glow-border !rounded-t-2xl !rounded-b-none z-50 lg:hidden max-h-[80vh] flex flex-col" style={{ transformOrigin: 'bottom center', animation: 'unfurl 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div className="flex justify-between items-center p-4 border-b border-white/20 flex-shrink-0">
                <h3 className="font-bold text-lg">{title}</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10"><CloseIcon /></button>
            </div>
            <div className="overflow-y-auto p-4 scrollbar-thin">
                {children}
            </div>
        </div>
    </>
);

const MobileFooterToolbar: React.FC<{ onSheetOpen: (sheet: ActiveSheet) => void }> = ({ onSheetOpen }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollArrows, setScrollArrows] = useState({ left: false, right: false });

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (el) {
            const hasOverflow = el.scrollWidth > el.clientWidth;
            const scrollEnd = Math.ceil(el.scrollLeft) >= el.scrollWidth - el.clientWidth;
            setScrollArrows({
                left: el.scrollLeft > 5,
                right: hasOverflow && !scrollEnd,
            });
        }
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            checkScroll();
            const resizeObserver = new ResizeObserver(checkScroll);
            resizeObserver.observe(el);
            el.addEventListener('scroll', checkScroll);
            return () => {
                resizeObserver.disconnect();
                el.removeEventListener('scroll', checkScroll);
            };
        }
    }, [checkScroll]);
    
    const FooterButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
        <button onClick={onClick} className="flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full bg-white/10 hover:bg-white/20 transition-colors">{label}</button>
    );
    
    return (
        <div className="fixed bottom-0 left-0 right-0 glass !rounded-t-2xl !rounded-b-none z-30 lg:hidden">
             <div className="relative flex-grow flex items-center overflow-hidden px-2 py-3">
                {scrollArrows.left && <div className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pointer-events-none"><ChevronLeftIcon className="w-5 h-5 text-white/70" /></div>}
                <div ref={scrollRef} className="overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent">
                    <div className="flex items-center gap-2 px-2">
                        <FooterButton label="Upload" onClick={() => onSheetOpen('upload')} />
                        <FooterButton label="Frame" onClick={() => onSheetOpen('frame')} />
                        <FooterButton label="Watermark" onClick={() => onSheetOpen('watermark')} />
                        <FooterButton label="Export" onClick={() => onSheetOpen('export')} />
                    </div>
                </div>
                {scrollArrows.right && <div className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pointer-events-none"><ChevronRightIcon className="w-5 h-5 text-white/70" /></div>}
            </div>
        </div>
    );
};


// --- MAIN PAGE COMPONENT ---
const FrameMakerPage: React.FC = () => {
    const { addNotification } = useNotification();

    // State
    const [queue, setQueue] = useState<ImageQueueItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [logoURL, setLogoURL] = useState<string | null>(null);
    const [frameURL, setFrameURL] = useState<string | null>(null);

    const [padding, setPadding] = useState(20);
    const [scale, setScale] = useState(100);
    const [shadow, setShadow] = useState(18);
    const [bgColor, setBgColor] = useState('#0e1224');
    const [showFrameShadow, setShowFrameShadow] = useState(true);

    const [wmText, setWmText] = useState('FOLLOW FOR MORE KNOWLEDGE');
    const [wmColor, setWmColor] = useState('#ffffff');
    const [wmSize, setWmSize] = useState(36);
    const [wmOpacity, setWmOpacity] = useState(60);
    const [wmRotate, setWmRotate] = useState(0);
    const [wmMargin, setWmMargin] = useState(24);
    const [wmHasShadow, setWmHasShadow] = useState(true);
    const [wmPosition, setWmPosition] = useState(8);
    const [showWatermark, setShowWatermark] = useState(false);

    const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState('');
    
    const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

    const canvasAreaRef = useRef<HTMLDivElement>(null);
    const metaRef = useRef<HTMLDivElement>(null);
    const frameInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const wmLiveRef = useRef<HTMLDivElement>(null);

    const handleFiles = useCallback((fileList: FileList | null) => {
        if (!fileList) return;
        const newItems: ImageQueueItem[] = Array.from(fileList).filter(f => f.type.startsWith('image/')).map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name.replace(/\.[^.]+$/, '') }));
        setQueue(prev => [...prev, ...newItems]);
        if (currentIndex === -1 && newItems.length > 0) setCurrentIndex(0);
    }, [currentIndex]);

    const removeIndex = useCallback((i: number) => {
        setQueue(prev => {
            const newQueue = [...prev];
            URL.revokeObjectURL(newQueue[i].url); newQueue.splice(i, 1);
            if (i < currentIndex) setCurrentIndex(p => p - 1);
            else if (i === currentIndex) setCurrentIndex(p => (p >= newQueue.length ? newQueue.length - 1 : p));
            return newQueue;
        });
    }, [currentIndex]);

    const clearAll = useCallback(() => {
        queue.forEach(item => URL.revokeObjectURL(item.url)); setQueue([]); setCurrentIndex(-1);
    }, [queue]);
    
    useEffect(() => {
        const area = canvasAreaRef.current;
        if (!area) return;
        const observer = new ResizeObserver(() => {
            if (metaRef.current) {
                const r = area.getBoundingClientRect();
                metaRef.current.textContent = `${Math.round(r.width)} × ${Math.round(r.height)} px`;
            }
        });
        observer.observe(area);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const wmEl = wmLiveRef.current, area = canvasAreaRef.current;
        if (!wmEl || !area || !showWatermark) return;
        const pos = () => {
            const { width: W, height: H } = area.getBoundingClientRect(); const { width: w, height: h } = wmEl.getBoundingClientRect(); const m = wmMargin;
            const posStyles = [ { left: `${m}px`, top: `${m}px`, right: 'auto', bottom: 'auto' }, { left: `${(W - w) / 2}px`, top: `${m}px`, right: 'auto', bottom: 'auto' }, { right: `${m}px`, top: `${m}px`, left: 'auto', bottom: 'auto' }, { left: `${m}px`, top: `${(H - h) / 2}px`, right: 'auto', bottom: 'auto' }, { left: `${(W - w) / 2}px`, top: `${(H - h) / 2}px`, right: 'auto', bottom: 'auto' }, { right: `${m}px`, top: `${(H - h) / 2}px`, left: 'auto', bottom: 'auto' }, { left: `${m}px`, bottom: `${m}px`, right: 'auto', top: 'auto' }, { left: `${(W - w) / 2}px`, bottom: `${m}px`, right: 'auto', top: 'auto' }, { right: `${m}px`, bottom: `${m}px`, left: 'auto', top: 'auto' } ];
            Object.assign(wmEl.style, posStyles[wmPosition]);
        };
        const timerId = setTimeout(pos, 50); return () => clearTimeout(timerId);
    }, [wmPosition, wmMargin, wmText, wmSize, wmColor, wmRotate, showWatermark, queue, currentIndex, padding, scale]);

    const renderComposite = useCallback(async (imgEl: HTMLImageElement) => {
        const padPx = padding, scaleVal = scale / 100;
        const { naturalWidth: imgW, naturalHeight: imgH } = imgEl;
        const areaW = imgW + padPx * 2, areaH = imgH + padPx * 2;
        const factor = Math.min(1, 3500 / Math.max(areaW, areaH));
        const W = Math.round(areaW * factor), H = Math.round(areaH * factor), p = Math.round(padPx * factor);
        const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
        const ctx = cvs.getContext('2d'); if (!ctx) throw new Error("No canvas context");
        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(imgEl, p, p, Math.round(imgW * factor), Math.round(imgH * factor));
        const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=src; });
        if (frameURL) { const frameImg = await loadImage(frameURL); const oW = Math.round(W * scaleVal), oH = Math.round(H * scaleVal); const x = Math.round((W - oW) / 2), y = Math.round((H - oH) / 2); ctx.save(); if (showFrameShadow) { ctx.shadowColor = 'rgba(0,0,0,.36)'; ctx.shadowBlur = shadow * factor; ctx.shadowOffsetY = 10 * factor; } ctx.drawImage(frameImg, x, y, oW, oH); ctx.restore(); }
        if (logoURL) { const lg = await loadImage(logoURL); const size = Math.round(Math.min(W, H) * 0.12), m = Math.round(16 * factor); ctx.save(); ctx.globalAlpha = 0.85; ctx.drawImage(lg, W - size - m, H - size - m, size, size); ctx.restore(); }
        if (showWatermark && wmText.trim()) { ctx.save(); ctx.globalAlpha = wmOpacity / 100; const fontSize = Math.round(wmSize * factor); ctx.font = `800 ${fontSize}px Teko, Inter, system-ui`; ctx.fillStyle = wmColor; ctx.textBaseline = 'top'; const m = ctx.measureText(wmText); const h = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0) || fontSize, w = m.width; const margin = Math.round(wmMargin * factor); const posMap = [ { x: margin, y: margin }, { x: (W - w) / 2, y: margin }, { x: W - w - margin, y: margin }, { x: margin, y: (H - h) / 2 }, { x: (W - w) / 2, y: (H - h) / 2 }, { x: W - w - margin, y: (H - h) / 2 }, { x: margin, y: H - h - margin }, { x: (W - w) / 2, y: H - h - margin }, { x: W - w - margin, y: H - h - margin } ][wmPosition]; ctx.translate(posMap.x + w/2, posMap.y + h/2); ctx.rotate(wmRotate * Math.PI / 180); if (wmHasShadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8 * factor; ctx.shadowOffsetY = 2 * factor; } ctx.fillText(wmText, -w/2, -h/2); ctx.restore(); }
        return cvs;
    }, [padding, scale, shadow, bgColor, frameURL, logoURL, showFrameShadow, showWatermark, wmText, wmOpacity, wmSize, wmColor, wmMargin, wmPosition, wmRotate, wmHasShadow]);

    const handleExportOne = useCallback(async () => {
        if (currentIndex < 0) return addNotification("No image selected.", "error");
        const item = queue[currentIndex]; if (!item) return;
        const currentImage = new Image(); currentImage.crossOrigin = 'anonymous';
        currentImage.onload = async () => { try { const cvs = await renderComposite(currentImage); const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png'; const url = cvs.toDataURL(mime, 1.0); const a = document.createElement('a'); a.href = url; a.download = `${item.name}_framed.${exportFormat}`; a.click(); } catch (e: any) { addNotification(`Export failed: ${e.message}`, 'error'); } };
        currentImage.src = item.url;
    }, [renderComposite, exportFormat, queue, currentIndex, addNotification]);
    
    const handleExportAll = useCallback(async () => {
        if (queue.length === 0) return; setIsExporting(true); setExportProgress('Starting...'); addNotification('Batch export started...', 'info'); const zip = new JSZip();
        try { for (let i = 0; i < queue.length; i++) { setExportProgress(`Processing ${i + 1}/${queue.length}...`); const item = queue[i]; const imgEl = await new Promise<HTMLImageElement>((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=item.url}); const cvs = await renderComposite(imgEl); const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png'; zip.file(`${item.name}_framed.${exportFormat}`, cvs.toDataURL(mime, 1.0).split(',')[1], { base64: true }); } setExportProgress('Zipping...'); const blob = await zip.generateAsync({ type: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'framed_batch.zip'; a.click(); URL.revokeObjectURL(a.href); addNotification('ZIP file download started!', 'success'); } catch(e: any) { addNotification(`Batch export failed: ${e.message}`, 'error'); }
        finally { setIsExporting(false); setExportProgress(''); }
    }, [queue, renderComposite, exportFormat, addNotification]);
    
    const sheetContent = {
        upload: <UploadQueueControls queue={queue} currentIndex={currentIndex} onFilesSelect={handleFiles} onIndexSelect={setCurrentIndex} onIndexRemove={removeIndex} />,
        frame: <FrameControls padding={padding} setPadding={setPadding} scale={scale} setScale={setScale} shadow={shadow} setShadow={setShadow} bgColor={bgColor} setBgColor={setBgColor} showFrameShadow={showFrameShadow} setShowFrameShadow={setShowFrameShadow} onChooseFrame={() => frameInputRef.current?.click()} />,
        watermark: <WatermarkControls wmText={wmText} setWmText={setWmText} wmColor={wmColor} setWmColor={setWmColor} wmHasShadow={wmHasShadow} setWmHasShadow={setWmHasShadow} wmSize={wmSize} setWmSize={setWmSize} wmOpacity={wmOpacity} setWmOpacity={setWmOpacity} wmRotate={wmRotate} setWmRotate={setWmRotate} wmMargin={wmMargin} setWmMargin={setWmMargin} wmPosition={wmPosition} setWmPosition={setWmPosition} showWatermark={showWatermark} setShowWatermark={setShowWatermark} onChooseLogo={() => logoInputRef.current?.click()} />,
        export: <ExportControls exportFormat={exportFormat} setExportFormat={setExportFormat} onExportOne={handleExportOne} isExporting={isExporting} canExport={currentIndex >= 0} />
    };

    return (
        <>
            <style>{`:root{--brand:#73fbd3;--accent:#8a7dff;--hot:#ff7ab6;}.frame-maker-page{color:#e6edff;font:500 16px/1.45 Inter,system-ui,sans-serif;background:radial-gradient(1200px 600px at 10% 0%,#15224d 0%,rgba(21,34,77,0) 60%),radial-gradient(1200px 700px at 100% 0%,#1b4252 0%,rgba(27,66,82,0) 55%),linear-gradient(180deg,#060a16,#0b1020)}.glow-border:before{content:"";position:absolute;inset:-2px;border-radius:20px;background:linear-gradient(135deg,var(--brand),var(--accent),var(--hot));filter:blur(18px);opacity:.35;z-index:-1}.glass{background:rgba(255,255,255,.08);backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.04)}input[type=range]{-webkit-appearance:none;width:100%;height:6px;background:rgba(255,255,255,.1);border-radius:3px;outline:0}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;background:var(--brand);border-radius:50%;cursor:pointer}input[type=color]{background:#0000;border:1px solid rgba(255,255,255,.15);border-radius:10px;width:48px;height:38px}.btn{appearance:none;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:8px 14px;background:linear-gradient(135deg,var(--accent),var(--hot));color:#fff;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:all .2s}.btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.35)}.btn:focus-visible{outline:2px solid var(--brand);outline-offset:2px}.btn.ghost{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.btn.secondary{background:linear-gradient(135deg,#3e4a7a,#283058)}.btn:disabled{opacity:.5;cursor:not-allowed}`}</style>
            <div className="frame-maker-page -m-2 md:-m-4 lg:-m-6 min-h-screen pb-24 lg:pb-0">
                <header className="glass glow-border m-3.5 flex items-center gap-4 justify-between p-4 !rounded-2xl">
                    <div><h1 className="m-0 text-lg font-bold tracking-wide">Frame Maker — Pro</h1><div className="text-gray-400 text-sm hidden sm:block">Batch processing • Advanced controls • Watermark • ZIP export</div></div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleExportAll} disabled={isExporting || queue.length === 0} className="btn"><DownloadAllIcon className="inline-block w-5 h-5 mr-2"/> {isExporting ? exportProgress : 'Export ZIP'}</button>
                        <button onClick={clearAll} className="btn ghost"><TrashIcon className="inline-block w-5 h-5 mr-2"/>Clear</button>
                    </div>
                </header>
                <main className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-auto lg:h-[calc(100vh-92px)] p-3.5">
                    <section className="left glass glow-border p-4 overflow-auto scrollbar-thin hidden lg:block">
                        <UploadQueueControls queue={queue} currentIndex={currentIndex} onFilesSelect={handleFiles} onIndexSelect={setCurrentIndex} onIndexRemove={removeIndex} />
                        <FrameControls padding={padding} setPadding={setPadding} scale={scale} setScale={setScale} shadow={shadow} setShadow={setShadow} bgColor={bgColor} setBgColor={setBgColor} showFrameShadow={showFrameShadow} setShowFrameShadow={setShowFrameShadow} onChooseFrame={() => frameInputRef.current?.click()} />
                        <WatermarkControls wmText={wmText} setWmText={setWmText} wmColor={wmColor} setWmColor={setWmColor} wmHasShadow={wmHasShadow} setWmHasShadow={setWmHasShadow} wmSize={wmSize} setWmSize={setWmSize} wmOpacity={wmOpacity} setWmOpacity={setWmOpacity} wmRotate={wmRotate} setWmRotate={setWmRotate} wmMargin={wmMargin} setWmMargin={setWmMargin} wmPosition={wmPosition} setWmPosition={setWmPosition} showWatermark={showWatermark} setShowWatermark={setShowWatermark} onChooseLogo={() => logoInputRef.current?.click()} />
                        <ExportControls exportFormat={exportFormat} setExportFormat={setExportFormat} onExportOne={handleExportOne} isExporting={isExporting} canExport={currentIndex >= 0} />
                        <input type="file" accept="image/png" className="hidden" ref={frameInputRef} onChange={e => { if(e.target.files?.[0]) setFrameURL(URL.createObjectURL(e.target.files[0])); }} />
                        <input type="file" accept="image/png" className="hidden" ref={logoInputRef} onChange={e => { if(e.target.files?.[0]) setLogoURL(URL.createObjectURL(e.target.files[0])); }} />
                    </section>
                    <section className="stageWrap glass glow-border flex items-center justify-center p-4">
                        <div className="relative w-[min(900px,100%)] m-auto rounded-2xl p-4" style={{ backgroundColor: bgColor }}>
                            <div ref={canvasAreaRef} className="relative m-auto bg-[#111] rounded-2xl" style={{ padding: `${padding}px`}}>
                                <img className="uploaded w-full block rounded-xl" alt="Preview" src={queue[currentIndex]?.url || ''} />
                                {frameURL && <img src={frameURL} alt="Frame" className="overlay absolute inset-0 w-full h-full pointer-events-none" style={{ transform: `scale(${scale / 100})`, filter: showFrameShadow ? `drop-shadow(0 10px ${shadow}px rgba(0,0,0,.36))` : 'none' }} />}
                                <div style={{ display: showWatermark ? 'block' : 'none', position: 'absolute', pointerEvents: 'none', color: wmColor, fontSize: `${wmSize}px`, opacity: wmOpacity/100, transform: `rotate(${wmRotate}deg)`, textShadow: wmHasShadow ? '0 2px 8px rgba(0,0,0,0.45)' : 'none', fontFamily: 'Teko, sans-serif', fontWeight: 800 }} ref={wmLiveRef}>{wmText}</div>
                            </div>
                            <div ref={metaRef} className="absolute right-3 bottom-2.5 text-sm text-gray-400">—</div>
                        </div>
                    </section>
                </main>
                <MobileFooterToolbar onSheetOpen={setActiveSheet} />
                {activeSheet && (
                     <SettingsBottomSheet title={activeSheet.charAt(0).toUpperCase() + activeSheet.slice(1)} onClose={() => setActiveSheet(null)}>
                        {sheetContent[activeSheet]}
                    </SettingsBottomSheet>
                )}
            </div>
        </>
    );
};

export default FrameMakerPage;