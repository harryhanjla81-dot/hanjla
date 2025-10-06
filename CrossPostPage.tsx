

import React, { useState, useEffect, useCallback, ChangeEvent, useRef, useMemo } from 'react';
import Spinner from './components/Spinner.tsx';
import * as geminiService from './services/geminiService.ts';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import CrossPostSchedulerTab, { CrossPostSchedulerSettings } from './components/CrossPostSchedulerTab.tsx';
import { FBPage, ManagedPost, SelectedLanguageCode, LanguageOptions } from './types.ts';
import { ThumbsUpIcon, ChatBubbleIcon } from './components/IconComponents.tsx';
import { useFacebookPage } from './src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './components/FacebookLoginPrompt.tsx';


// --- CONSTANTS ---
const API_VERSION = 'v19.0';
const CROSPOST_HISTORY_KEY = 'crosspost_history_v1';

interface SchedulingLogEntry {
    timestamp: string;
    post: string;
    status: 'success' | 'error' | 'info';
    message: string;
}


const CrossPostPage: React.FC = () => {
    const { addNotification } = useNotification();
    const { isAuthenticated, pages, activePage, logout, selectPage } = useFacebookPage();
    
    // Page Selection & Data State
    const [sourcePage, setSourcePage] = useState<FBPage | null>(null);
    const [destinationPage, setDestinationPage] = useState<FBPage | null>(null);
    const [sourcePosts, setSourcePosts] = useState<ManagedPost[]>([]);
    const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
    const [isFetchingPosts, setIsFetchingPosts] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [minLikes, setMinLikes] = useState('');
    const [minComments, setMinComments] = useState('');
    const [crossPostHistory, setCrossPostHistory] = useState<Set<string>>(new Set());
    const [captionLanguage, setCaptionLanguage] = useState<SelectedLanguageCode>('en');
    
    // Scheduler State
    const [schedulerSettings, setSchedulerSettings] = useState<CrossPostSchedulerSettings>({
        startDate: new Date().toISOString().split('T')[0],
        interval: 60,
        startTime: '09:00',
        endTime: '22:00',
        checkInPlaceId: '',
        smartScheduleEnabled: false,
    });
    const [isScheduling, setIsScheduling] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(isPaused);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    const [isTesting, setIsTesting] = useState(false);
    const [schedulingProgress, setSchedulingProgress] = useState({ current: 0, total: 0 });
    const [schedulingLog, setSchedulingLog] = useState<SchedulingLogEntry[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const schedulerCancelToken = useRef({ cancelled: false });

    // --- LOGIC ---
    const addLog = useCallback((entry: Omit<SchedulingLogEntry, 'timestamp'>) => {
        const timestamp = new Date().toLocaleTimeString();
        setSchedulingLog(prev => [{ ...entry, timestamp }, ...prev]);
    }, []);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = 0;
        }
    }, [schedulingLog]);

    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(CROSPOST_HISTORY_KEY);
            if (savedHistory) {
                setCrossPostHistory(new Set(JSON.parse(savedHistory) as string[]));
            }
        } catch (e) {
            console.error("Failed to load cross-post history", e);
            localStorage.removeItem(CROSPOST_HISTORY_KEY);
        }
    }, []);

    useEffect(() => {
        if (pages.length > 0) {
            // The activePage from context now serves as the default source
            setSourcePage(activePage); 
            if (!destinationPage) {
                setDestinationPage(pages.find(p => p.id !== activePage?.id) || null);
            }
        }
    }, [pages, activePage, destinationPage]);


    const fetchPostsFromUrl = useCallback(async (url: string) => {
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return {
            posts: data.data || [],
            nextUrl: data.paging?.next || null,
        };
    }, []);

    const handleFetchSourcePosts = useCallback(async () => {
        if (!sourcePage) return;
        setIsFetchingPosts(true);
        setSourcePosts([]);
        setSelectedPostIds(new Set());
        setNextPageUrl(null);
        try {
            const fields = 'id,message,full_picture,created_time,likes.summary(true),comments.summary(true)';
            const url = `https://graph.facebook.com/${API_VERSION}/${sourcePage.id}/posts?fields=${fields}&limit=25&access_token=${sourcePage.access_token}`;
            const { posts, nextUrl } = await fetchPostsFromUrl(url);
            setSourcePosts(posts);
            setNextPageUrl(nextUrl);
        } catch(e: any) {
            const message = (e.message || '').toLowerCase();
            if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                addNotification('Facebook token has expired. Please log in again.', 'error');
                logout();
            } else {
                addNotification(`Failed to fetch posts: ${e.message}`, 'error');
            }
        } finally {
            setIsFetchingPosts(false);
        }
    }, [sourcePage, addNotification, fetchPostsFromUrl, logout]);

    const handleLoadMorePosts = useCallback(async () => {
        if (!nextPageUrl || isFetchingMore) return;
        setIsFetchingMore(true);
        try {
            const { posts, nextUrl } = await fetchPostsFromUrl(nextPageUrl);
            setSourcePosts(prev => [...prev, ...posts]);
            setNextPageUrl(nextUrl);
        } catch (e: any) {
            addNotification(`Failed to load more posts: ${e.message}`, 'error');
        } finally {
            setIsFetchingMore(false);
        }
    }, [nextPageUrl, isFetchingMore, addNotification, fetchPostsFromUrl]);
    
    const handleSelectPost = (postId: string) => {
        setSelectedPostIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
    };

    const uploadCrossPost = useCallback(async (post: ManagedPost, scheduleTime: Date | null) => {
        if (!destinationPage) throw new Error("No destination page selected.");
        if (!post.full_picture) throw new Error("Post has no image to cross-post.");

        addLog({ post: post.id, status: 'info', message: 'Analyzing image for new caption...' });
    
        const imageDataBase64 = await geminiService.urlToBase64(post.full_picture);
        let newCaption = '';
        if (imageDataBase64) {
            newCaption = await geminiService.generateCaptionFromImage(imageDataBase64, captionLanguage, post.message);
        } else {
            addLog({ post: post.id, status: 'info', message: 'Could not get image data, falling back to text-based rewrite.' });
            newCaption = await geminiService.generateCrossPostCaption(post.message || '', captionLanguage);
        }
        addLog({ post: post.id, status: 'info', message: `Caption ready: "${newCaption.substring(0, 50)}..."` });
    
        const postFormData = new FormData();
        postFormData.append('access_token', destinationPage.access_token);
        postFormData.append('url', post.full_picture);
        postFormData.append('caption', newCaption);

        if (scheduleTime) {
            postFormData.append('published', 'false');
            postFormData.append('scheduled_publish_time', Math.floor(scheduleTime.getTime() / 1000).toString());
            addLog({ post: post.id, status: 'info', message: `Scheduling for ${scheduleTime.toLocaleString()}` });
        } else {
             postFormData.append('published', 'true');
        }

        if (schedulerSettings.checkInPlaceId) {
             postFormData.append('place', schedulerSettings.checkInPlaceId);
        }
    
        const postResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${destinationPage.id}/photos`, { method: 'POST', body: postFormData });
        const postResponseData = await postResponse.json();
        if (postResponseData.error) throw new Error(`Post creation failed: ${postResponseData.error.message}`);

        const historyKey = `${post.id}|${destinationPage.id}`;
        setCrossPostHistory(prev => {
            const newHistorySet = new Set(prev).add(historyKey);
            try {
                localStorage.setItem(CROSPOST_HISTORY_KEY, JSON.stringify(Array.from(newHistorySet)));
            } catch (e) { console.error("Failed to save cross-post history", e); }
            return newHistorySet;
        });

        const successMessage = scheduleTime ? `Scheduled successfully! ID: ${postResponseData.id}` : `Posted successfully!`;
        addLog({ post: post.id, status: 'success', message: successMessage });

    }, [destinationPage, schedulerSettings, addLog, captionLanguage]);

    const handleSchedulingProcess = useCallback(async () => {
        if (isScheduling) {
            schedulerCancelToken.current.cancelled = true;
            addLog({ post: '', status: 'info', message: 'Stopping process...' });
            return;
        }

        const postsToSchedule = sourcePosts.filter(p => selectedPostIds.has(p.id));
        if (postsToSchedule.length === 0 || !destinationPage || !sourcePage || destinationPage.id === sourcePage.id) {
            addNotification('Please select posts, a valid source, and a different destination page.', 'error');
            return;
        }
        
        setIsScheduling(true);
        setIsPaused(false);
        schedulerCancelToken.current.cancelled = false;
        setSchedulingLog([]);
        setSchedulingProgress({ current: 0, total: postsToSchedule.length });

        const [startH, startM] = schedulerSettings.startTime.split(':').map(Number);
        const [endH, endM] = schedulerSettings.endTime.split(':').map(Number);
        let scheduleTime = new Date(schedulerSettings.startDate);
        scheduleTime.setHours(startH, startM, 0, 0);

        for (let i = 0; i < postsToSchedule.length; i++) {
            if (schedulerCancelToken.current.cancelled) {
                addLog({ post: '', status: 'info', message: 'Scheduling cancelled by user.' });
                break;
            }

            while (isPausedRef.current) await sleep(1000);
            
            const currentPost = postsToSchedule[i];
            const historyKey = `${currentPost.id}|${destinationPage.id}`;
            setSchedulingProgress({ current: i + 1, total: postsToSchedule.length });

            if (crossPostHistory.has(historyKey)) {
                addLog({ post: currentPost.id, status: 'info', message: 'Skipped: This post has already been cross-posted to the destination page.' });
                continue;
            }

            let finalScheduleTime = new Date(scheduleTime);
            if (finalScheduleTime.getTime() < Date.now() + 600000) {
                 finalScheduleTime.setDate(finalScheduleTime.getDate() + 1);
            }

            try {
                await uploadCrossPost(currentPost, finalScheduleTime);
            } catch (e: any) {
                const message = (e.message || '').toLowerCase();
                addLog({ post: currentPost.id, status: 'error', message: `Failed: ${e.message}` });
                 if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                    addNotification('Facebook token expired during operation. Please log in again.', 'error');
                    logout();
                    break; 
                }
            }

            scheduleTime.setMinutes(scheduleTime.getMinutes() + schedulerSettings.interval);
            if (scheduleTime.getHours() > endH || (scheduleTime.getHours() === endH && scheduleTime.getMinutes() > endM)) {
                scheduleTime.setDate(scheduleTime.getDate() + 1);
                scheduleTime.setHours(startH, startM, 0, 0);
            }
        }
        addNotification('Cross-posting process has finished.', 'success');
        setIsScheduling(false);
    }, [isScheduling, sourcePosts, selectedPostIds, destinationPage, sourcePage, schedulerSettings, addLog, uploadCrossPost, addNotification, crossPostHistory, logout]);

    const filteredPosts = useMemo(() => {
        const likesNum = minLikes ? parseInt(minLikes, 10) : -1;
        const commentsNum = minComments ? parseInt(minComments, 10) : -1;

        if (!isFinite(likesNum) && !isFinite(commentsNum)) {
            return sourcePosts;
        }

        return sourcePosts.filter(post => {
            const postLikes = post.likes?.summary?.total_count ?? 0;
            const postComments = post.comments?.summary?.total_count ?? 0;

            const passesLikes = isFinite(likesNum) ? postLikes > likesNum : true;
            const passesComments = isFinite(commentsNum) ? postComments > commentsNum : true;

            return passesLikes && passesComments;
        });
    }, [sourcePosts, minLikes, minComments]);

    const handleSelectAllFiltered = useCallback(() => {
        const filteredSelectableIds = new Set(
            filteredPosts
                .filter(p => !crossPostHistory.has(`${p.id}|${destinationPage?.id}`))
                .map(p => p.id)
        );
        setSelectedPostIds(filteredSelectableIds);
        addNotification(`${filteredSelectableIds.size} posts selected.`, 'info');
    }, [filteredPosts, crossPostHistory, destinationPage, addNotification]);

    const handleDeselectAll = useCallback(() => {
        setSelectedPostIds(new Set());
        addNotification('Selection cleared.', 'info');
    }, [addNotification]);


    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Cross Post" subtitle="Connect to Facebook to get started." />;
    }
    
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
             <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h1 className="text-2xl font-bold">Cross-Page Poster</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Select posts from a source page to re-post on a destination page with new, AI-generated captions.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium mb-1">Source Page</label>
                    <select value={sourcePage?.id || ''} onChange={e => setSourcePage(pages.find(p => p.id === e.target.value) || null)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                 <div className="md:col-span-1">
                    <label className="block text-sm font-medium mb-1">Destination Page</label>
                    <select value={destinationPage?.id || ''} onChange={e => setDestinationPage(pages.find(p => p.id === e.target.value) || null)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium mb-1">Caption Language</label>
                    <select value={captionLanguage} onChange={e => setCaptionLanguage(e.target.value as SelectedLanguageCode)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        {Object.entries(LanguageOptions).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                </div>
            </div>
             <button onClick={handleFetchSourcePosts} disabled={isFetchingPosts || !sourcePage} className="w-full py-2 bg-primary text-primary-text rounded-md disabled:opacity-50 flex items-center justify-center">
                {isFetchingPosts ? <Spinner/> : `Fetch Posts from ${sourcePage?.name || ''}`}
             </button>

             {sourcePosts.length > 0 && (
                <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                    <h3 className="font-bold mb-4">Select posts to cross-post ({selectedPostIds.size} selected)</h3>
                    
                    <div className="flex flex-wrap gap-4 items-center p-3 mb-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <label className="text-sm font-medium">Filter by:</label>
                        <div className="flex items-center gap-2">
                            <label htmlFor="min-likes" className="text-sm">Likes &gt;</label>
                            <input id="min-likes" type="number" value={minLikes} onChange={e => setMinLikes(e.target.value)} placeholder="e.g. 100" className="w-24 p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="min-comments" className="text-sm">Comments &gt;</label>
                            <input id="min-comments" type="number" value={minComments} onChange={e => setMinComments(e.target.value)} placeholder="e.g. 20" className="w-24 p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="flex-grow flex justify-end gap-2">
                            <button onClick={handleSelectAllFiltered} disabled={filteredPosts.length === 0} className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                                Select All ({filteredPosts.filter(p => !crossPostHistory.has(`${p.id}|${destinationPage?.id}`)).length})
                            </button>
                            <button onClick={handleDeselectAll} disabled={selectedPostIds.size === 0} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50">
                                Deselect All
                            </button>
                        </div>
                    </div>
                    
                    {nextPageUrl && !isFetchingMore && (
                        <div className="mb-4 text-center">
                            <button onClick={handleLoadMorePosts} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                                Load More Posts
                            </button>
                        </div>
                    )}
                    {isFetchingMore && <div className="flex justify-center my-4"><Spinner /></div>}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-96 overflow-y-auto p-2 scrollbar-thin">
                        {filteredPosts.map(post => {
                            const isAlreadyPosted = crossPostHistory.has(`${post.id}|${destinationPage?.id}`);
                            return (
                                <div key={post.id} onClick={() => !isAlreadyPosted && handleSelectPost(post.id)} className={`relative rounded-lg overflow-hidden border-4 group ${selectedPostIds.has(post.id) ? 'border-primary' : 'border-transparent'} ${isAlreadyPosted ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <img src={post.full_picture} alt="" className="w-full aspect-square object-cover transition-transform group-hover:scale-105" />
                                    {isAlreadyPosted && <div className="absolute inset-0 bg-black/60"></div>}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                    <div className="absolute top-2 left-2 flex items-center gap-2 text-white text-xs bg-black/50 px-2 py-1 rounded-full">
                                        <div className="flex items-center gap-1"><ThumbsUpIcon className="w-3 h-3"/> {post.likes?.summary.total_count ?? 0}</div>
                                        <div className="flex items-center gap-1"><ChatBubbleIcon className="w-3 h-3"/> {post.comments?.summary.total_count ?? 0}</div>
                                    </div>
                                    <p className="absolute bottom-1 left-2 right-2 text-white text-xs leading-tight line-clamp-2">{post.message}</p>
                                    {selectedPostIds.has(post.id) && <div className="absolute top-2 right-2 bg-primary text-white w-5 h-5 flex items-center justify-center rounded-full text-xs shadow-lg">✓</div>}
                                    {isAlreadyPosted && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-white font-bold text-lg bg-black/70 px-4 py-1 rounded-lg">POSTED</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
             )}

            <CrossPostSchedulerTab
                schedulerSettings={schedulerSettings}
                handleSettingChange={setSchedulerSettings}
                selectedPostCount={selectedPostIds.size}
                isScheduling={isScheduling}
                isPaused={isPaused}
                isTesting={isTesting}
                handleTestUpload={() => addNotification("Test function not available for cross-posting yet.", "info")}
                handleSchedulingProcess={handleSchedulingProcess}
                setIsPaused={setIsPaused}
                schedulingProgress={schedulingProgress}
                schedulingLog={schedulingLog}
                logContainerRef={logContainerRef}
            />
        </div>
    );
};

export default CrossPostPage;