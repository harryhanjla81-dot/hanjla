import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CloseIcon } from './IconComponents.tsx';

interface ImageCropperModalProps {
  imageFile: File;
  onCrop: (dataUrl: string) => void;
  onClose: () => void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ imageFile, onCrop, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string>('');
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const url = URL.createObjectURL(imageFile);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    const handleImageLoad = () => {
        // Reset state when new image is loaded
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    };

    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !imageRef.current || !containerRef.current) return;
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        const scaledWidth = imageRef.current.clientWidth * zoom;
        const scaledHeight = imageRef.current.clientHeight * zoom;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        const maxX = (scaledWidth - containerWidth) / 2;
        const maxY = (scaledHeight - containerHeight) / 2;

        setOffset({
            x: clamp(newX, -maxX, maxX),
            y: clamp(newY, -maxY, maxY),
        });
    };

    const onMouseUp = () => setIsDragging(false);

    const handleCrop = () => {
        if (!imageRef.current || !containerRef.current) return;

        const img = imageRef.current;
        const container = containerRef.current;
        const outputSize = 1080; // High quality output

        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const scaleX = img.naturalWidth / img.clientWidth;
        const scaleY = img.naturalHeight / img.clientHeight;

        const sourceWidth = container.clientWidth / zoom * scaleX;
        const sourceHeight = container.clientHeight / zoom * scaleY;
        
        const sourceX = (img.naturalWidth / 2) - (sourceWidth / 2) - (offset.x * scaleX / zoom);
        const sourceY = (img.naturalHeight / 2) - (sourceHeight / 2) - (offset.y * scaleY / zoom);

        ctx.drawImage(
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            outputSize,
            outputSize
        );

        onCrop(canvas.toDataURL('image/jpeg', 0.95));
    };


    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 flex flex-col"
                onClick={e => e.stopPropagation()}
                style={{ transformOrigin: 'center', animation: 'unfurl 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Crop Image</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><CloseIcon /></button>
                </div>

                <div className="p-6">
                    <div 
                        ref={containerRef}
                        className="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden cursor-move relative shadow-inner"
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    >
                        {imageUrl && (
                            <img
                                ref={imageRef}
                                src={imageUrl}
                                alt="Crop preview"
                                onLoad={handleImageLoad}
                                style={{
                                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transformOrigin: 'center',
                                    // Use translate property for positioning from center
                                    translate: '-50% -50%',
                                }}
                            />
                        )}
                    </div>
                    <div className="mt-4">
                        <label htmlFor="zoom-slider" className="block text-sm font-medium mb-1">Zoom</label>
                        <input
                            id="zoom-slider"
                            type="range"
                            min="1"
                            max="3"
                            step="0.01"
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700 flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-2 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 font-semibold">Cancel</button>
                    <button onClick={handleCrop} className="px-6 py-2 rounded-md bg-primary text-primary-text font-semibold hover:bg-primary-hover">Apply Crop</button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropperModal;
