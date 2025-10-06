
import React, { useState, ChangeEvent, useRef } from 'react';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import * as geminiService from './services/geminiService.ts';
import Spinner from './components/Spinner.tsx';
import { UploadIcon, GenerateIcon, ClipboardIcon, DownloadIcon } from './components/IconComponents.tsx';

const ScriptMakerPage: React.FC = () => {
    const { addNotification } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for file handling
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState<string>('');

    // State for script content
    const [processedSrt, setProcessedSrt] = useState<string>('');
    const [translatedSrt, setTranslatedSrt] = useState<string>('');
    
    // State for UI
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isTranslating, setIsTranslating] = useState<boolean>(false);

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.srt')) {
            addNotification('Please select a valid .srt file.', 'error');
            return;
        }
        setSelectedFile(file);
        setFileName(file.name);
        setProcessedSrt(''); // Clear old processed content
        setTranslatedSrt(''); // Clear old translated content
    };

    const handleProcessFile = () => {
        if (!selectedFile) {
            addNotification('Please select a file first.', 'error');
            return;
        }
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const processed = content
                    .replace(/^\d+$/gm, '') // Remove sequence number lines
                    .replace(/\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}/g, '(................)') // Replace timestamps
                    .replace(/(\r\n|\n|\r){2,}/g, '$1\n'); // Normalize newlines
                setProcessedSrt(processed.trim());
                addNotification(`Successfully processed "${selectedFile.name}". Ready for translation.`, 'success');
            }
            setIsProcessing(false);
        };
        reader.onerror = () => {
            addNotification('Failed to read the selected file.', 'error');
            setIsProcessing(false);
        };
        reader.readAsText(selectedFile);
    };

    const handleTranslate = async () => {
        if (!processedSrt) {
            addNotification('Please process an SRT file first.', 'error');
            return;
        }
        setIsTranslating(true);
        setTranslatedSrt('');
        try {
            const result = await geminiService.translateSrtScript(processedSrt);
            setTranslatedSrt(result);
            addNotification('Script translated successfully!', 'success');
        } catch (e: any) {
            addNotification(e.message || 'An error occurred during translation.', 'error');
        } finally {
            setIsTranslating(false);
        }
    };

    const handleCopy = (text: string, type: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        addNotification(`${type} script copied to clipboard!`, 'success');
    };

    const handleSave = (text: string, baseFileName: string, type: string) => {
        if (!text) return;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const newFileName = baseFileName.replace(/\.srt$/i, `_${type}.txt`);
        link.download = newFileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".srt" className="hidden" />
            
            {/* 1. Upload Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">1. Upload SRT File</h2>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-grow w-full p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                        <UploadIcon className="w-8 h-8 mx-auto text-gray-400 mb-2"/>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {fileName ? <span>Selected: <strong>{fileName}</strong></span> : 'Click to select an .SRT file'}
                        </p>
                    </div>
                    <button 
                        onClick={handleProcessFile} 
                        disabled={!selectedFile || isProcessing}
                        className="w-full sm:w-auto px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                    >
                        {isProcessing ? <Spinner /> : 'Process File'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 2. Formatted Script Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">2. Formatted Script</h2>
                    <textarea
                        value={processedSrt}
                        readOnly
                        placeholder="After processing a file, its formatted content for the AI will appear here..."
                        className="w-full flex-grow p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 font-mono text-sm scrollbar-thin h-96"
                    />
                    <div className="mt-4 flex gap-4">
                        <button onClick={() => handleCopy(processedSrt, 'Formatted')} disabled={!processedSrt} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2">
                            <ClipboardIcon /> Copy
                        </button>
                        <button onClick={() => handleSave(processedSrt, fileName, 'formatted')} disabled={!processedSrt} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2">
                            <DownloadIcon /> Save
                        </button>
                    </div>
                </div>
                
                {/* 3. AI Translation Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">3. AI Translation</h2>
                        <button onClick={handleTranslate} disabled={isTranslating || !processedSrt} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                            {isTranslating ? <Spinner size="sm"/> : <GenerateIcon />}
                            {isTranslating ? 'Translating...' : 'Translate'}
                        </button>
                    </div>
                    <textarea
                        value={translatedSrt}
                        readOnly
                        placeholder="Translated script will appear here after processing..."
                        className="w-full flex-grow p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 font-mono text-sm scrollbar-thin h-96"
                    />
                    <div className="mt-4 flex gap-4">
                         <button onClick={() => handleCopy(translatedSrt, 'Translated')} disabled={!translatedSrt} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2">
                            <ClipboardIcon /> Copy
                        </button>
                        <button onClick={() => handleSave(translatedSrt, fileName, 'translated')} disabled={!translatedSrt} className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            <DownloadIcon /> Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScriptMakerPage;
