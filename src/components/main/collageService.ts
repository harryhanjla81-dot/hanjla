import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
const FINAL_SQUARE_SIZE = 4096;
let modelsLoaded = false;

// --- TYPE DEFINITIONS ---
export interface CellGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface CollageLayout {
    id: string;
    name: string;
    cells: CellGeometry[];
}

export interface ImageCellData {
    id: number;
    files: File[];
    text: string;
    font: string;
    textColor: string;
    textSize: number; // As a percentage of cell width
    emojiFile: File | null;
    emojiSize: number; // As a percentage of cell width
}

export interface GlobalCollageSettings {
    faceZoomEnabled: boolean;
    borderSize: number;
    borderColor: string;
    gapSize: number;
    gapColor: string;
    useWatermark: boolean;
    watermarkText: string;
    watermarkColor: string;
    watermarkOpacity: number;
}


// --- CORE FUNCTIONS ---
export async function loadModels() {
    if (modelsLoaded) return;
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
    } catch (error) {
        console.error("Error loading face-api models:", error);
        throw new Error("Failed to load AI models for face detection.");
    }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = URL.createObjectURL(file);
    });
}

function hexToRgba(hex: string, alpha: number = 1): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function timeout<T>(promise: Promise<T>, ms: number, errorMessage: string = 'Operation timed out'): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
}

async function smartCropAndResize(img: HTMLImageElement, targetW: number, targetH: number, faceZoomEnabled: boolean): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (!modelsLoaded || !faceZoomEnabled) {
        // Default center crop
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const targetAspect = targetW / targetH;
        let sx, sy, sw, sh;

        if (imgAspect > targetAspect) { // image is wider
            sh = img.naturalHeight;
            sw = sh * targetAspect;
            sx = (img.naturalWidth - sw) / 2;
            sy = 0;
        } else { // image is taller
            sw = img.naturalWidth;
            sh = sw / targetAspect;
            sy = (img.naturalHeight - sh) / 2;
            sx = 0;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        return canvas;
    }

    try {
        const detections = await timeout(
            faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true),
            10000, // 10-second timeout
            'Face detection took too long.'
        );
        // FIX: Cast detections to any[] to resolve TypeScript error where type was inferred as 'unknown'.
        const validFaces = (detections as any[]).filter(d => d.landmarks.getLeftEye().length > 0 && d.landmarks.getRightEye().length > 0);

        if (validFaces.length === 0) {
            // Fallback to center crop if no face found
            return smartCropAndResize(img, targetW, targetH, false);
        }
        
        const mainFace = validFaces.sort((a, b) => b.detection.box.area - a.detection.box.area)[0];

        const { box } = mainFace.detection;
        const leftEye = mainFace.landmarks.getLeftEye();
        const rightEye = mainFace.landmarks.getRightEye();

        const leftEyeX = leftEye.reduce((sum: number, p: { x: number; }) => sum + p.x, 0) / leftEye.length;
        const rightEyeX = rightEye.reduce((sum: number, p: { x: number; }) => sum + p.x, 0) / rightEye.length;
        const faceCenterX = (leftEyeX + rightEyeX) / 2;
        const faceCenterY = box.y + box.height * 0.4;

        const targetAspect = targetW / targetH;
        let cropW, cropH;

        cropH = Math.min(img.naturalHeight, box.height * 2.5);
        cropW = cropH * targetAspect;

        if (cropW > img.naturalWidth) {
            cropW = img.naturalWidth;
            cropH = cropW / targetAspect;
        }

        let cropX = faceCenterX - cropW / 2;
        let cropY = faceCenterY - cropH / 2;
        
        cropX = Math.max(0, Math.min(cropX, img.naturalWidth - cropW));
        cropY = Math.max(0, Math.min(cropY, img.naturalHeight - cropH));

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
        return canvas;
    } catch (error) {
        console.warn("Face detection failed or timed out. Falling back to center crop.", error);
        // On any error (including timeout), fall back to simple center crop.
        return smartCropAndResize(img, targetW, targetH, false);
    }
}

export async function generateCollage(
    layout: CollageLayout,
    cells: ImageCellData[],
    settings: GlobalCollageSettings,
    theme: 'light' | 'dark',
    imageIndex: number = 0
): Promise<Blob | null> {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = FINAL_SQUARE_SIZE;
    finalCanvas.height = FINAL_SQUARE_SIZE;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw border color as the absolute base
    ctx.fillStyle = settings.borderColor;
    ctx.fillRect(0, 0, FINAL_SQUARE_SIZE, FINAL_SQUARE_SIZE);
    
    // 2. Draw gap color inset by the border size
    const contentAreaW = FINAL_SQUARE_SIZE - 2 * settings.borderSize;
    const contentAreaH = FINAL_SQUARE_SIZE - 2 * settings.borderSize;
    if (contentAreaW > 0 && contentAreaH > 0) {
        ctx.fillStyle = settings.gapColor;
        ctx.fillRect(settings.borderSize, settings.borderSize, contentAreaW, contentAreaH);
    }

    // 3. Draw each cell image
    const contentX = settings.borderSize;
    const contentY = settings.borderSize;

    for (let i = 0; i < layout.cells.length; i++) {
        const cellDef = layout.cells[i];
        const cellData = cells[i];
        
        if (!cellData || !cellData.files || !cellData.files[imageIndex]) continue;

        const singleGap = settings.gapSize / 2;
        const epsilon = 0.01;

        const onLeftEdge = cellDef.x < epsilon;
        const onRightEdge = (cellDef.x + cellDef.width) > (1 - epsilon);
        const onTopEdge = cellDef.y < epsilon;
        const onBottomEdge = (cellDef.y + cellDef.height) > (1 - epsilon);

        const x_offset = onLeftEdge ? 0 : singleGap;
        const y_offset = onTopEdge ? 0 : singleGap;
        
        let w_reduction = 0;
        if (!onLeftEdge) w_reduction += singleGap;
        if (!onRightEdge) w_reduction += singleGap;
        
        let h_reduction = 0;
        if (!onTopEdge) h_reduction += singleGap;
        if (!onBottomEdge) h_reduction += singleGap;
        
        const x_pos = contentX + (contentAreaW * cellDef.x) + x_offset;
        const y_pos = contentY + (contentAreaH * cellDef.y) + y_offset;
        const w_pos = (contentAreaW * cellDef.width) - w_reduction;
        const h_pos = (contentAreaH * cellDef.height) - h_reduction;

        if (w_pos <= 0 || h_pos <= 0) continue;

        const img = await loadImage(cellData.files[imageIndex]);
        const croppedCanvas = await smartCropAndResize(img, w_pos, h_pos, settings.faceZoomEnabled);
        ctx.drawImage(croppedCanvas, x_pos, y_pos);

        if (cellData.text) {
            const fontSize = w_pos * (cellData.textSize / 100);
            ctx.font = `bold ${fontSize}px ${cellData.font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const textX = x_pos + w_pos / 2;
            const textY = y_pos + h_pos - (h_pos * 0.05); // 5% from bottom

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillText(cellData.text, textX + 2, textY + 2);

            ctx.fillStyle = cellData.textColor;
            ctx.fillText(cellData.text, textX, textY);
        }
        
        if (cellData.emojiFile) {
            const emojiImg = await loadImage(cellData.emojiFile);
            const emojiTargetWidth = w_pos * (cellData.emojiSize / 100);
            const emojiAspect = emojiImg.naturalWidth / emojiImg.naturalHeight;
            const emojiH = emojiTargetWidth / emojiAspect;
            const emojiX = x_pos + (w_pos / 2) - (emojiTargetWidth / 2);
            const emojiY = y_pos + (h_pos * 0.05); // 5% from top
            ctx.drawImage(emojiImg, emojiX, emojiY, emojiTargetWidth, emojiH);
        }
    }
    
    if (settings.useWatermark && settings.watermarkText) {
        applyWatermark(ctx, settings);
    }

    return new Promise(resolve => finalCanvas.toBlob(blob => resolve(blob), 'image/jpeg', 1.0));
}


function applyWatermark(ctx: CanvasRenderingContext2D, settings: GlobalCollageSettings) {
    const canvas = ctx.canvas;
    const fontSize = Math.floor(FINAL_SQUARE_SIZE / 45);
    ctx.font = `bold ${fontSize}px "Nunito Sans", sans-serif`;
    
    const alpha = settings.watermarkOpacity / 100;
    const textColor = hexToRgba(settings.watermarkColor, alpha);
    
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    
    const x = canvas.width - settings.borderSize - 15;
    const y = canvas.height - settings.borderSize - 15;
    
    ctx.fillText(settings.watermarkText, x, y);
}