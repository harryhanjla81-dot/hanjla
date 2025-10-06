import React, { useState, FormEvent, useCallback, ChangeEvent } from 'react';
import { CloseIcon, GenerateIcon, UploadIcon } from '../../../components/IconComponents.tsx';
import Spinner from '../../../components/Spinner.tsx';

interface RecreateViralPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecreate: (file: File, customCaption?: string) => void;
}

const RecreateViralPostModal: React.FC<RecreateViralPostModalProps> = ({ isOpen, onClose, onRecreate }) => {
    const [caption, setCaption] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (file) {
            setIsSubmitting(true);
            await onRecreate(file, caption.trim());
            // Reset state after submission
            setIsSubmitting(false);
            setFile(null);
            setCaption('');
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold">Recreate Viral Post from Image</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><CloseIcon /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">1. Upload Viral Image</label>
                             <label className="w-full h-64 cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-1" />
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <UploadIcon className="w-10 h-10 mx-auto mb-2" />
                                        <span>Click to select an image</span>
                                    </div>
                                )}
                                <input type="file" accept="image/png, image/jpeg" onChange={handleFileChange} className="hidden" />
                            </label>
                        </div>
                        <div className="space-y-4">
                            <div>
                               <label htmlFor="recreate-caption" className="block text-sm font-medium mb-2">2. Optional Context</label>
                               <textarea
                                   id="recreate-caption"
                                   rows={5}
                                   value={caption}
                                   onChange={(e) => setCaption(e.target.value)}
                                   placeholder="Add any extra context, caption, or title here. The AI will use this to improve the new headline and summary."
                                   className="w-full p-2.5 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600"
                               />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">The AI will analyze the image to extract the headline and summary. It will then generate a new background image based on its analysis. The context you provide here can help guide the AI.</p>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-600 flex justify-end">
                        <button type="submit" disabled={!file || isSubmitting} className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-md disabled:opacity-50 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
                            {isSubmitting ? <Spinner size="sm" /> : <GenerateIcon />}
                            {isSubmitting ? 'Recreating...' : 'Recreate Post'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RecreateViralPostModal;
