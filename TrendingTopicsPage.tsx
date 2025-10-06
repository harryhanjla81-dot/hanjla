
import React, { useState, useCallback } from 'react';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import * as geminiService from './services/geminiService.ts';
import Spinner from './components/Spinner.tsx';
import { ClipboardIcon, GenerateIcon } from './components/IconComponents.tsx';
import { useFacebookPage } from './src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './components/FacebookLoginPrompt.tsx';


// --- CONSTANTS & HELPERS ---
const API_VERSION = 'v19.0';
const HINDI_STOPWORDS = new Set(['मैं','मुझको','मेरा','अपने','हमने','हमारा','आपका','आपके','उनका','वे','यह','वह','जो','तो','से','में','पर','और','है','हैं','था','थे','थी','गया','गई','गए','किया','कर','रहा','रही','रहे','हुआ','हुई','हुए','लिये','लिए','एक','इस','उस','को','क्या','कैसे','क्यों','कौन','किस','किसी','किधर','कोई','कुछ','अभी','कभी','सभी','तब','जब','यहां','वहां','कहां','किंतु','परंतु','क्योंकि','इसलिए','आदि','इत्यादि','द्वारा','की','के','का','एवं','तथा','यदि','अगर']);
const ENGLISH_STOPWORDS = new Set(['i','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']);


const TrendingTopicsPage: React.FC = () => {
    const { addNotification } = useNotification();
    const { isAuthenticated, activePage, logout } = useFacebookPage();

    // Feature State
    const [numPosts, setNumPosts] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topics, setTopics] = useState<string[]>([]);
    const [generatedPost, setGeneratedPost] = useState<string>('');
    

    // --- CORE FEATURE LOGIC ---
    const analyzeComments = (comments: { message: string }[]): string[] => {
        const textCorpus = comments.map(c => c.message).join(' ');
        const words = textCorpus.toLowerCase().match(/[\u0900-\u097F\w']+/g) || [];
        
        const freqMap: Record<string, number> = {};
        words.forEach((word: string) => {
            if (word.length > 2 && !ENGLISH_STOPWORDS.has(word) && !HINDI_STOPWORDS.has(word) && isNaN(Number(word))) {
                freqMap[word] = (freqMap[word] || 0) + 1;
            }
        });
        
        return Object.entries(freqMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    };

    const handleScan = useCallback(async () => {
        if (!activePage) {
            addNotification('Please select a page.', 'error');
            return;
        }
        setIsLoading(true);
        setError(null);
        setTopics([]);
        setGeneratedPost('');

        try {
            const fields = `message,comments.limit(100){message}`;
            const url = `https://graph.facebook.com/${API_VERSION}/${activePage.id}/posts?fields=${fields}&limit=${numPosts}&access_token=${activePage.access_token}`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);
            
            const posts: any[] = data.data || [];
            
            const allComments: { message: string }[] = [];
            for (const post of posts) {
                const commentsData = post.comments?.data;
                if (commentsData && Array.isArray(commentsData)) {
                    for (const comment of commentsData) {
                        if (comment && typeof comment.message === 'string') {
                            allComments.push({ message: comment.message });
                        }
                    }
                }
            }

            if (allComments.length === 0) {
                addNotification('No comments found in the latest posts to analyze.', 'info');
                setIsLoading(false);
                return;
            }

            const foundTopics = analyzeComments(allComments);
            setTopics(foundTopics);
            addNotification('Comment scan complete. Top topics identified.', 'success');

        } catch (e: any) {
            setError(e.message);
            addNotification(`Error scanning posts: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [activePage, numPosts, addNotification]);

    const handleGeneratePost = async () => {
        if (topics.length === 0) return;
        setIsGenerating(true);
        try {
            const post = await geminiService.generatePostFromTopics(topics);
            setGeneratedPost(post);
        } catch (e: any) {
            addNotification(`Error generating post: ${e.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleCopyPost = () => {
        if(!generatedPost) return;
        navigator.clipboard.writeText(generatedPost);
        addNotification('Post copied to clipboard!', 'success');
    }

    // --- RENDER LOGIC ---
    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Trending Topics" subtitle="Connect to Facebook to find trending topics from your posts." />;
    }

    return (
        <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                 <h1 className="text-2xl font-bold">Trending Topics (Post Analysis)</h1>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Analyzing posts from: <span className="font-semibold text-primary">{activePage.name}</span>
                 </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                    <h2 className="text-lg font-semibold">1. Configuration</h2>
                    <div>
                        <label className="block text-sm font-medium mb-1">Number of Posts to Analyze</label>
                        <input type="number" value={numPosts} onChange={e => setNumPosts(parseInt(e.target.value, 10))} min="1" max="100" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                    <button onClick={handleScan} disabled={isLoading} className="w-full py-3 bg-primary text-primary-text font-bold rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? <Spinner/> : 'Scan Comments'}
                    </button>
                    {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </div>
                
                <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                    <h2 className="text-lg font-semibold">2. Results</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold mb-2">Top Topics Found:</h3>
                            {topics.length > 0 ? (
                                <ul className="flex flex-wrap gap-2">
                                    {topics.map(topic => <li key={topic} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-sm">{topic}</li>)}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">Scan comments to see topics here.</p>
                            )}
                        </div>
                        {topics.length > 0 && (
                            <button onClick={handleGeneratePost} disabled={isGenerating} className="w-full py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                {isGenerating ? <Spinner/> : <GenerateIcon/>} Generate Post from Topics
                            </button>
                        )}
                        {generatedPost && (
                             <div>
                                <h3 className="font-semibold mb-2">Generated Post Preview:</h3>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg whitespace-pre-wrap text-sm border dark:border-gray-600 relative">
                                    {generatedPost}
                                    <button onClick={handleCopyPost} className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500" title="Copy Post">
                                        <ClipboardIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrendingTopicsPage;