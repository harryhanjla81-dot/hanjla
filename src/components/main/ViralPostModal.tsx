import React, { useState, FormEvent, useCallback, useEffect } from 'react';
import { CloseIcon, GenerateIcon, RefreshIcon } from '../../../components/IconComponents.tsx';
import * as geminiService from '../../../services/geminiService.ts';
import Spinner from '../../../components/Spinner.tsx';
import { useNotification } from '../../contexts/NotificationContext.tsx';

interface ViralPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (topic: string) => void;
}

const ViralPostModal: React.FC<ViralPostModalProps> = ({ isOpen, onClose, onGenerate }) => {
    const { addNotification } = useNotification();
    const [topic, setTopic] = useState('');
    const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
    const [isLoadingTopics, setIsLoadingTopics] = useState(false);

    const loadTopics = useCallback(async () => {
        setIsLoadingTopics(true);
        try {
            // FIX: Removed apiKey argument. The service handles the key.
            const fetchedTopics = await geminiService.fetchTrendingTopics();
            setTrendingTopics(fetchedTopics);
        } catch (err: any) {
            console.error("Failed to load topics:", err);
            addNotification(`Could not fetch trending topics: ${err.message}`, 'error');
            // Fallback is handled within the service, but have one here just in case.
            setTrendingTopics([
                "Love Jihad", "Fake Babas", "Youth selling kidneys for iPhones",
                "Viral Marriage Drama", "Village banishes daughter-in-law", "Liquor tragedy in Bihar",
            ]);
        } finally {
            setIsLoadingTopics(false);
        }
    }, [addNotification]);

    useEffect(() => {
        if (isOpen) {
            loadTopics();
        }
    }, [isOpen, loadTopics]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (topic.trim()) {
            onGenerate(topic.trim());
            setTopic('');
            onClose();
        }
    };

    const handleSampleClick = (sampleTopic: string) => {
        onGenerate(sampleTopic);
        setTopic('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold">Generate Viral Post</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><CloseIcon /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <label htmlFor="viral-topic" className="block text-sm font-medium mb-2">Enter a topic to make it viral</label>
                        <textarea id="viral-topic" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., A new social media trend..." className="w-full p-2.5 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                        
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium">Or try a trending topic:</h3>
                                <button
                                    type="button"
                                    onClick={loadTopics}
                                    disabled={isLoadingTopics}
                                    className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Refresh topics"
                                >
                                    {isLoadingTopics ? <Spinner size="sm" /> : <RefreshIcon className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-[50px]">
                                {isLoadingTopics ? (
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                        <Spinner size="sm" className="mr-2" />
                                        Fetching latest trends...
                                    </div>
                                ) : (
                                    trendingTopics.map(sample => (
                                        <button 
                                            type="button" 
                                            key={sample} 
                                            onClick={() => handleSampleClick(sample)} 
                                            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            {sample}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-600 flex justify-end">
                        <button type="submit" disabled={!topic.trim()} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-md disabled:opacity-50 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
                            <GenerateIcon />Generate
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ViralPostModal;