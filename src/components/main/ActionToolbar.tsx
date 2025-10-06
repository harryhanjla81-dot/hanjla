import React, { useState, FormEvent, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import * as geminiService from '../../../services/geminiService.ts';
import { useNotification } from '../../contexts/NotificationContext.tsx';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import {
    GenerateIcon, DownloadAllIcon, TrashIcon, EditIcon
} from '../../../components/IconComponents.tsx';
import Spinner from '../../../components/Spinner.tsx';


interface ActionToolbarProps {
    contentManager: any; // Simplified type for the contentManager hook return value
    cardCount: number;
    isEditingAll: boolean;
    onToggleEditAll: () => void;
    onOpenViralPostModal: () => void;
    onOpenRecreateModal: () => void;
}

const ActionToolbar: React.FC<ActionToolbarProps> = ({
    contentManager,
    cardCount,
    isEditingAll,
    onToggleEditAll,
    onOpenViralPostModal,
    onOpenRecreateModal
}) => {
    const { handleGenerateContent, handleDownloadAll, handleClearAllContent, isLoading, isDownloadingAll } = contentManager;
    const { addNotification } = useNotification();
    const { settings, updateSetting } = useSettings();

    const [userPrompt, setUserPrompt] = useState<string>('');
    const [isProcessingPrompt, setIsProcessingPrompt] = useState<boolean>(false);

    const handlePromptSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        if (!userPrompt.trim() || isProcessingPrompt) return;

        setIsProcessingPrompt(true);

        const settingsOptions = { /* Schema for AI */ };
        try {
            const result = await geminiService.processUserPrompt(userPrompt, settingsOptions);
            
            if (result.action === 'generate_content' && result.content_prompt) {
                await handleGenerateContent(result.content_prompt);
            } else if (result.action === 'update_settings' && result.settings) {
                Object.entries(result.settings).forEach(([key, value]) => {
                    updateSetting(key as any, value as any);
                });
                addNotification(`${Object.keys(result.settings).length} setting(s) updated.`, 'success');
            } else if (result.action === 'answer_question' && result.answer) {
                addNotification(result.answer, 'info');
            }
            setUserPrompt('');
        } catch (err: any) {
            addNotification(err.message || 'Failed to process prompt.', 'error');
        } finally {
            setIsProcessingPrompt(false);
        }
    }, [userPrompt, isProcessingPrompt, handleGenerateContent, updateSetting, addNotification]);

    return (
        <>
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg rounded-2xl p-4 mb-6 sticky top-2 z-20 border dark:border-gray-700">
                <form onSubmit={handlePromptSubmit} className="flex flex-col sm:flex-row items-center gap-4">
                    <input type="text" value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Tell me what to do... (e.g., 'Make the headlines bigger' or 'Generate 5 posts about cats')" className="w-full flex-grow p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" disabled={isProcessingPrompt || isLoading} />
                    <button type="submit" disabled={isProcessingPrompt || isLoading || !userPrompt.trim()} className="px-6 py-2.5 bg-primary text-primary-text font-bold rounded-full disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform transition-all w-full sm:w-auto">
                        {isProcessingPrompt ? <Spinner size="sm" /> : <GenerateIcon />} <span>{isProcessingPrompt ? 'Thinking...' : 'Submit'}</span>
                    </button>
                </form>
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 flex-grow text-center sm:text-left">Use the prompt bar or buttons below for control.</p>
                    <div className="flex-shrink-0 flex flex-wrap items-center justify-center gap-2">
                        
                        {cardCount > 0 && (
                            <>
                                <button onClick={onToggleEditAll} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-semibold ${isEditingAll ? 'bg-primary text-primary-text' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}`}><EditIcon /><span>{isEditingAll ? 'Finish Editing' : 'Edit All'}</span></button>
                                <button onClick={handleDownloadAll} disabled={isDownloadingAll} className="px-4 py-2 rounded-lg flex items-center gap-2 font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">{isDownloadingAll ? <Spinner size="sm" /> : <DownloadAllIcon />}<span>{isDownloadingAll ? 'Zipping...' : 'Download All'}</span></button>
                                <button onClick={handleClearAllContent} className="px-4 py-2 rounded-lg flex items-center gap-2 font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"><TrashIcon /><span>Clear All</span></button>
                            </>
                        )}
                        <button onClick={onOpenRecreateModal} disabled={isLoading || isProcessingPrompt} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-full disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:bg-indigo-700 hover:-translate-y-0.5 transform transition-all"><GenerateIcon /><span>Recreate From Image</span></button>
                        <button onClick={onOpenViralPostModal} disabled={isLoading || isProcessingPrompt} className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-full disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:bg-purple-700 hover:-translate-y-0.5 transform transition-all"><GenerateIcon /><span>Generate Viral Post</span></button>
                        
                        {/* Keep the main generate button hidden on mobile, as it's in the footer */}
                        <button onClick={() => handleGenerateContent()} disabled={isLoading || isProcessingPrompt} className="hidden md:flex px-6 py-2.5 bg-primary text-primary-text font-bold rounded-full disabled:opacity-50 items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform transition-all">
                            {isLoading ? <Spinner size="sm" /> : <GenerateIcon />}<span>{isLoading ? 'Generating...' : (cardCount > 0 ? 'Generate More' : 'Generate')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ActionToolbar;