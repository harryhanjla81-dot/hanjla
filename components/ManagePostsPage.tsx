import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Spinner from './Spinner.tsx';
import { TrashIcon, ThumbsUpIcon, ChatBubbleIcon, EyeIcon, CloseIcon, GenerateIcon, ChevronDownIcon, DownloadIcon } from './IconComponents.tsx';
import * as geminiService from '../services/geminiService.ts';
import { useNotification } from '../src/contexts/NotificationContext.tsx';
import { FBPage, ManagedPost } from '../types.ts';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { useFacebookPage } from '../src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './FacebookLoginPrompt.tsx';


// --- CONSTANTS ---
const API_VERSION = 'v19.0';
const REPLIED_COMMENTS_KEY = 'replied_comment_ids_v3'; // Incremented version for new structure

type PostSortKey = 'default' | 'likes' | 'comments' | 'reach';


// --- MAIN CONTENT COMPONENT ---
const ManagePostsContent: React.FC<{ activePage: FBPage; onAuthError: () => void; }> = ({ activePage, onAuthError }) => {
    const { addNotification } = useNotification();
    
    // Post Management State
    const [postTypeToShow, setPostTypeToShow] = useState<'published' | 'scheduled'>('published');
    const [publishedPosts, setPublishedPosts] = useState<ManagedPost[]>([]);
    const [scheduledPosts, setScheduledPosts] = useState<ManagedPost[]>([]);
    const [isFetchingPosts, setIsFetchingPosts] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [postsError, setPostsError] = useState<string | null>(null);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [nextScheduledPageUrl, setNextScheduledPageUrl] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<PostSortKey>('default');

    // Filtering State
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [filterKeyword, setFilterKeyword] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterMinLikes, setFilterMinLikes] = useState('');
    const [filterMaxLikes, setFilterMaxLikes] = useState('');
    const [filterMinComments, setFilterMinComments] = useState('');
    const [filterMaxComments, setFilterMaxComments] = useState('');

    // Selection and Deletion State
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
    const [isDeletingSelected, setIsDeletingSelected] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [deletedPostsCount, setDeletedPostsCount] = useState(0);
    const continuousDeleteCancelToken = useRef({ cancelled: false });
    const deletionQueueRef = useRef<{ posts: ManagedPost[], nextUrl: string | null }>({ posts: [], nextUrl: null });
    const deleteCycleTimer = useRef<number | null>(null);
    const [isDownloadingImages, setIsDownloadingImages] = useState(false);
    
    // Timer state
    const [timer, setTimer] = useState(0);
    const timerIntervalId = useRef<number | null>(null);


    // AI Reply State
    const [replyingPostId, setReplyingPostId] = useState<string | null>(null);
    const [isBulkReplying, setIsBulkReplying] = useState(false);
    const [customCta, setCustomCta] = useState<string>('For more, Like, Follow, and Share!');
    const [useImageContextForReply, setUseImageContextForReply] = useState<boolean>(false);
    const [mentionCommenterName, setMentionCommenterName] = useState<boolean>(false);
    const [repliedCommentHistory, setRepliedCommentHistory] = useState<Record<string, string[]>>({});

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const stopTimer = useCallback(() => {
        if (timerIntervalId.current) {
            clearInterval(timerIntervalId.current);
            timerIntervalId.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        stopTimer(); // Clear any existing timer before starting
        setTimer(0);
        timerIntervalId.current = window.setInterval(() => {
            setTimer(prev => prev + 1);
        }, 1000);
    }, [stopTimer]);

    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(REPLIED_COMMENTS_KEY);
            if (savedHistory) {
                setRepliedCommentHistory(JSON.parse(savedHistory));
            }
        } catch (e) {
            console.error("Failed to load replied comment history", e);
        }
    }, []);

    const addRepliedCommentId = useCallback((pageId: string, commentId: string) => {
        setRepliedCommentHistory(prev => {
            const newHistory = { ...prev };
            if (!newHistory[pageId]) {
                newHistory[pageId] = [];
            }
            if (!newHistory[pageId].includes(commentId)) {
                newHistory[pageId].push(commentId);
            }
            try {
                localStorage.setItem(REPLIED_COMMENTS_KEY, JSON.stringify(newHistory));
            } catch (e) {
                console.error("Failed to save replied comment ID", e);
            }
            return newHistory;
        });
    }, []);

    const handleClearReplyHistory = () => {
        if (window.confirm('Are you sure you want to clear the history of all replied comments for ALL pages? This will allow the AI to reply to them again.')) {
            localStorage.removeItem(REPLIED_COMMENTS_KEY);
            setRepliedCommentHistory({});
            addNotification('Replied comment history has been cleared for all pages.', 'success');
        }
    };


    const handleToggleSelectPost = (postId: string) => {
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

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, post: ManagedPost) => {
        if (isSelectMode) {
            handleToggleSelectPost(post.id);
            return;
        }
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        if (postTypeToShow === 'published' && post.permalink_url) {
            window.open(post.permalink_url, '_blank', 'noopener,noreferrer');
        }
    };
    
    const handleFetchPosts = useCallback(async (
        page: FBPage,
        type: 'published' | 'scheduled',
        urlOverride: string | null = null,
        silent: boolean = false
    ): Promise<{ posts: ManagedPost[], nextUrl: string | null }> => {
        const isLoadMore = !!urlOverride;
        if (!silent) {
            if (isLoadMore) setIsFetchingMore(true);
            else setIsFetchingPosts(true);
        }
        setPostsError(null);
    
        try {
            if (type === 'published') {
                const primaryFields = 'id,message,created_time,permalink_url';
                const baseUrl = `https://graph.facebook.com/${API_VERSION}/${page.id}/posts?fields=${primaryFields}&limit=25&access_token=${page.access_token}`;
                const url = urlOverride || baseUrl;
    
                const response = await fetch(url);
                const data = await response.json();
                if (data.error) throw new Error(`Primary data fetch failed: ${data.error.message}`);
    
                let primaryPosts: ManagedPost[] = data.data || [];
                const nextUrl = data.paging?.next || null;
    
                const newPostsWithFullData = primaryPosts.map(p => ({ ...p, full_picture: undefined, likes: undefined, comments: undefined, insights: undefined }));

                if (isLoadMore) setPublishedPosts(prev => [...prev, ...newPostsWithFullData]);
                else setPublishedPosts(newPostsWithFullData);
                setNextPageUrl(nextUrl);
    
                if (primaryPosts.length > 0) {
                    const batch = primaryPosts.map(post => ({ method: 'GET', relative_url: `${API_VERSION}/${post.id}?fields=full_picture,likes.summary(true),comments.summary(true),insights.metric(post_impressions_unique).period(lifetime)` }));
                    const formData = new FormData();
                    formData.append('access_token', page.access_token);
                    formData.append('batch', JSON.stringify(batch));
    
                    fetch(`https://graph.facebook.com`, { method: 'POST', body: formData })
                        .then(res => res.json())
                        .then(batchData => {
                            if (batchData.error) return;
                            const detailedDataMap = new Map<string, Partial<ManagedPost>>();
                            batchData.forEach((res: any) => {
                                if (res?.code === 200) {
                                    try {
                                        const body = JSON.parse(res.body);
                                        if (body.id) detailedDataMap.set(body.id, body);
                                    } catch (e) { console.error("Failed to parse batch response body item: ", res.body); }
                                }
                            });
                            setPublishedPosts(prev => prev.map(post => {
                                const details = detailedDataMap.get(post.id);
                                return details ? { ...post, ...details } : post;
                            }));
                        });
                }
                return { posts: newPostsWithFullData, nextUrl };
            } else { // 'scheduled'
                const fields = 'id,message,scheduled_publish_time,full_picture';
                const baseUrl = `https://graph.facebook.com/${API_VERSION}/${page.id}/scheduled_posts?fields=${fields}&limit=50&access_token=${page.access_token}`;
                const url = urlOverride || baseUrl;

                const response = await fetch(url);
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                
                const posts = data.data || [];
                const nextUrl = data.paging?.next || null;
                if (isLoadMore) setScheduledPosts(prev => [...prev, ...posts]);
                else setScheduledPosts(posts);
                setNextScheduledPageUrl(nextUrl);
                return { posts, nextUrl };
            }
        } catch (e: any) {
             const message = (e.message || '').toLowerCase();
            if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                onAuthError();
            } else {
                setPostsError(`Failed to fetch posts: ${e.message}`);
            }
        } finally {
            if (!silent) {
                if (isLoadMore) setIsFetchingMore(false);
                else setIsFetchingPosts(false);
            }
        }
        return { posts: [], nextUrl: null };
    }, [onAuthError]);

    const performBatchDelete = useCallback(async (postIds: string[]) => {
        if (!activePage || postIds.length === 0) return 0;

        let totalDeletedCount = 0;
        const chunks = [];
        for (let i = 0; i < postIds.length; i += 50) {
            chunks.push(postIds.slice(i, i + 50));
        }

        for (const chunk of chunks) {
            const batch = chunk.map(postId => ({ method: 'DELETE', relative_url: `${API_VERSION}/${postId}` }));
            const formData = new FormData();
            formData.append('access_token', activePage.access_token);
            formData.append('batch', JSON.stringify(batch));
            
            try {
                const response = await fetch(`https://graph.facebook.com`, { method: 'POST', body: formData });
                const responseData = await response.json();
                if (responseData.error) throw new Error(responseData.error.message);

                const successfullyDeletedIds = chunk.filter((_, index) => responseData[index]?.code === 200);
                if (successfullyDeletedIds.length > 0) {
                    if (postTypeToShow === 'published') {
                        setPublishedPosts(prev => prev.filter(p => !successfullyDeletedIds.includes(p.id)));
                    } else {
                        setScheduledPosts(prev => prev.filter(p => !successfullyDeletedIds.includes(p.id)));
                    }
                }
                totalDeletedCount += successfullyDeletedIds.length;
            } catch (e: any) {
                 const message = (e.message || '').toLowerCase();
                 if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                    addNotification('Facebook token expired during deletion.', 'error'); onAuthError();
                    break;
                 }
                 addNotification(`Batch deletion failed: ${e.message}`, 'error');
                 break;
            }
        }
        return totalDeletedCount;
    }, [activePage, onAuthError, addNotification, postTypeToShow]);
    
    const runContinuousDeleteCycle = useCallback(async () => {
        if (continuousDeleteCancelToken.current.cancelled) {
            setIsDeletingAll(false);
            stopTimer();
            addNotification('Continuous delete stopped by user.', 'info');
            return;
        }
    
        const type = postTypeToShow;
        let postsToDelete = deletionQueueRef.current.posts;
        let nextUrl = deletionQueueRef.current.nextUrl;
    
        if (postsToDelete.length === 0) {
            if (nextUrl) {
                const result = await handleFetchPosts(activePage, type, nextUrl, true);
                postsToDelete = result.posts;
                nextUrl = result.nextUrl;
                deletionQueueRef.current = { posts: postsToDelete, nextUrl };
            } else {
                setIsDeletingAll(false);
                stopTimer();
                addNotification(`Finished: All ${type} posts have been deleted.`, 'success');
                return;
            }
        }
    
        if (postsToDelete.length === 0) {
            setIsDeletingAll(false);
            stopTimer();
            addNotification(`Finished: All ${type} posts have been deleted.`, 'success');
            return;
        }
    
        const idsToDelete = postsToDelete.splice(0, 25).map(p => p.id);
        const deletedInBatch = await performBatchDelete(idsToDelete);
        setDeletedPostsCount(prev => prev + deletedInBatch);
    
        deleteCycleTimer.current = window.setTimeout(runContinuousDeleteCycle, 250);
    
    }, [activePage, addNotification, postTypeToShow, handleFetchPosts, performBatchDelete, stopTimer]);

    const handleAllDeleteToggle = () => {
        if (isDeletingAll) {
            continuousDeleteCancelToken.current.cancelled = true;
            if (deleteCycleTimer.current) {
                clearTimeout(deleteCycleTimer.current);
            }
            stopTimer();
            // The running cycle will detect the cancellation, show the "stopped" notification, and set isDeletingAll to false.
        } else {
            const type = postTypeToShow;
            const totalPosts = type === 'published' ? publishedPosts.length : scheduledPosts.length;
            if (window.confirm(`Are you sure you want to delete ALL ${type} posts? This will delete the ${totalPosts} currently loaded posts and then continue fetching and deleting until none are left. This action is irreversible.`)) {
                setIsDeletingAll(true);
                setDeletedPostsCount(0);
                startTimer();
                continuousDeleteCancelToken.current.cancelled = false;
    
                const currentPosts = type === 'published' ? publishedPosts : scheduledPosts;
                const currentNextUrl = type === 'published' ? nextPageUrl : nextScheduledPageUrl;
                deletionQueueRef.current = { posts: [...currentPosts], nextUrl: currentNextUrl };
    
                addNotification(`Starting continuous delete for all ${postTypeToShow} posts...`, 'info');
                runContinuousDeleteCycle();
            }
        }
    };


    const handleDeletePost = async (postId: string) => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            const count = await performBatchDelete([postId]);
            if (count > 0) {
                addNotification('Post deleted successfully.', 'success');
                setDeletedPostsCount(prev => prev + 1);
            }
        }
    };
    
    const handleDeleteSelectedPosts = async () => {
        if (selectedPostIds.size === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedPostIds.size} selected posts?`)) {
            setIsDeletingSelected(true);
            const count = await performBatchDelete(Array.from(selectedPostIds));
            if (count > 0) {
                addNotification(`${count} posts deleted successfully.`, 'success');
            }
            setSelectedPostIds(new Set());
            setIsDeletingSelected(false);
        }
    };
    
    
    const handleAiReplyToAll = useCallback(async (post: ManagedPost) => {
        if (!activePage || replyingPostId) return;
        setReplyingPostId(post.id);
        addNotification(`Starting AI replies for post: "${post.message?.substring(0, 30)}..."`, 'info');
        try {
            let allComments: any[] = [];
            let commentsUrl: string | null = `https://graph.facebook.com/${API_VERSION}/${post.id}/comments?fields=id,message,from{name,id},can_comment,comment_count,comments.limit(50){id,message,from{name,id},can_comment,comment_count}&limit=100&filter=stream&access_token=${activePage.access_token}`;
    
            while (commentsUrl) {
                const commentsResponse = await fetch(commentsUrl);
                const commentsData = await commentsResponse.json();
                if (commentsData.error) throw new Error(`Failed to fetch comments page: ${commentsData.error.message}`);
                
                const pageComments = commentsData.data || [];
                const flattenedComments = pageComments.flatMap((comment: any) => [comment, ...(comment.comments?.data || [])]);
                allComments = allComments.concat(flattenedComments);
                
                commentsUrl = commentsData.paging?.next || null;
            }

            const pageRepliedIds = repliedCommentHistory[activePage.id] || [];
            
            const allUserComments = allComments.filter(c => c.from && c.from.id !== activePage.id);
            const alreadyRepliedCount = allUserComments.filter(c => pageRepliedIds.includes(c.id)).length;
            const unrepliableCount = allUserComments.filter(c => c.can_comment === false).length;
            
            const commentsToReply = allUserComments.filter(c => 
                c.can_comment !== false && 
                !pageRepliedIds.includes(c.id)
            );
    
            if (commentsToReply.length === 0) {
                if (allUserComments.length > 0) {
                    let analysis = `Analysis:\n- Total user comments & replies found: ${allUserComments.length}`;
                    if (alreadyRepliedCount > 0) {
                        analysis += `\n- Comments already in reply history (skipped): ${alreadyRepliedCount}`;
                    }
                    if (unrepliableCount > 0) {
                        analysis += `\n- Comments where replies are disabled (skipped): ${unrepliableCount}`;
                    }
                    addNotification(`No new comments to reply to.\n\n${analysis}\n\nTip: Use 'Clear Reply History' if you want to reply again.`, 'info', 15000);
                } else {
                    addNotification('No user comments found on this post to reply to.', 'info');
                }
                setReplyingPostId(null);
                return;
            }
    
            let successCount = 0;
            for (const comment of commentsToReply) {
                try {
                    // Like the comment first
                    const likeFormData = new FormData(); 
                    likeFormData.append('access_token', activePage.access_token);
                    await fetch(`https://graph.facebook.com/${API_VERSION}/${comment.id}/likes`, { method: 'POST', body: likeFormData });
    
                    // Generate AI reply
                    const bestReply = await geminiService.generateSingleBestReply(post.message || '', comment.message, comment.from, customCta, mentionCommenterName, useImageContextForReply, post.full_picture || null);
                    
                    // Post the reply
                    const replyFormData = new FormData(); 
                    replyFormData.append('message', bestReply); 
                    replyFormData.append('access_token', activePage.access_token);
                    const replyResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${comment.id}/comments`, { method: 'POST', body: replyFormData });
                    const replyData = await replyResponse.json();
                    
                    if (!replyData.error) {
                         successCount++;
                         addRepliedCommentId(activePage.id, comment.id);
                    } else {
                        console.error(`Failed to reply to comment ${comment.id}:`, replyData.error.message);
                    }
                } catch (e: any) { 
                    console.error(`AI generation or reply process failed for comment ${comment.id}:`, e.message); 
                }
            }
            addNotification(`Finished AI replies. Successfully replied to ${successCount} out of ${commentsToReply.length} new comments.`, 'success');
    
        } catch (e: any) {
            const message = (e.message || '').toLowerCase();
            if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                onAuthError();
            } else {
                addNotification(`An error occurred during the AI reply process: ${e.message}`, 'error');
            }
        } finally {
            setReplyingPostId(null);
        }
    }, [activePage, addNotification, replyingPostId, onAuthError, customCta, useImageContextForReply, mentionCommenterName, repliedCommentHistory, addRepliedCommentId]);

    const sortedPosts = useMemo(() => {
        const postsToSort = postTypeToShow === 'published' ? publishedPosts : scheduledPosts;
        return [...postsToSort].sort((a, b) => {
            switch (sortKey) {
                case 'likes': return (b.likes?.summary?.total_count ?? 0) - (a.likes?.summary?.total_count ?? 0);
                case 'comments': return (b.comments?.summary?.total_count ?? 0) - (a.comments?.summary?.total_count ?? 0);
                case 'reach': { const valA = a.insights?.data?.[0]?.values?.[0]?.value; const valB = b.insights?.data?.[0]?.values?.[0]?.value; const reachA = typeof valA === 'number' ? valA : 0; const reachB = typeof valB === 'number' ? valB : 0; return reachB - reachA; }
                default: { const timeA = a.created_time ? new Date(a.created_time).getTime() : a.scheduled_publish_time ? a.scheduled_publish_time * 1000 : 0; const timeB = b.created_time ? new Date(b.created_time).getTime() : b.scheduled_publish_time ? b.scheduled_publish_time * 1000 : 0; return timeB - timeA; }
            }
        });
    }, [publishedPosts, scheduledPosts, postTypeToShow, sortKey]);

    const filteredPosts = useMemo(() => {
        const postsToFilter = sortedPosts;
        const minLikesNum = filterMinLikes ? parseInt(filterMinLikes, 10) : 0;
        const maxLikesNum = filterMaxLikes ? parseInt(filterMaxLikes, 10) : Infinity;
        const minCommentsNum = filterMinComments ? parseInt(filterMinComments, 10) : 0;
        const maxCommentsNum = filterMaxComments ? parseInt(filterMaxComments, 10) : Infinity;

        if (!filterKeyword && !filterStartDate && !filterEndDate && !filterMinLikes && !filterMaxLikes && !filterMinComments && !filterMaxComments) {
            return postsToFilter;
        }

        return postsToFilter.filter(post => {
            if (filterKeyword && !post.message?.toLowerCase().includes(filterKeyword.toLowerCase())) return false;
            
            const postDate = post.created_time ? new Date(post.created_time) : (post.scheduled_publish_time ? new Date(post.scheduled_publish_time * 1000) : null);
            if (postDate) {
                if (filterStartDate && postDate < new Date(filterStartDate)) return false;
                if (filterEndDate) {
                    const end = new Date(filterEndDate);
                    end.setHours(23, 59, 59, 999);
                    if (postDate > end) return false;
                }
            } else if (filterStartDate || filterEndDate) {
                return false;
            }
            
            const postLikes = post.likes?.summary?.total_count ?? 0;
            const postComments = post.comments?.summary?.total_count ?? 0;
            if (postLikes < minLikesNum || postLikes > maxLikesNum) return false;
            if (postComments < minCommentsNum || postComments > maxCommentsNum) return false;
            
            return true;
        });
    }, [sortedPosts, filterKeyword, filterStartDate, filterEndDate, filterMinLikes, filterMaxLikes, filterMinComments, filterMaxComments]);

    const handleBulkAiReplyProcess = useCallback(async () => {
        if (isBulkReplying || replyingPostId) return;

        const postsToProcess = filteredPosts.filter(p => (p.comments?.summary?.total_count ?? 0) > 0);

        if (postsToProcess.length === 0) {
            addNotification("No posts with comments found in the current view to reply to.", "info");
            return;
        }

        setIsBulkReplying(true);
        addNotification(`Starting bulk AI replies for ${postsToProcess.length} posts... This may take a while.`, 'info');

        let postIndex = 0;
        for (const post of postsToProcess) {
            postIndex++;
            addNotification(`Replying to post ${postIndex} of ${postsToProcess.length}...`, 'info');
            await handleAiReplyToAll(post);
        }

        setIsBulkReplying(false);
        addNotification('Bulk AI reply process finished.', 'success');
    }, [filteredPosts, isBulkReplying, replyingPostId, handleAiReplyToAll, addNotification]);
    
    useEffect(() => {
        if (activePage) {
            handleFetchPosts(activePage, 'published');
            handleFetchPosts(activePage, 'scheduled');
        }
    }, [activePage, handleFetchPosts]);

    const handleClearFilters = () => {
        setFilterKeyword(''); setFilterStartDate(''); setFilterEndDate(''); setFilterMinLikes(''); setFilterMaxLikes(''); setFilterMinComments(''); setFilterMaxComments('');
    };

    const handleSelectAllFiltered = () => {
        setSelectedPostIds(new Set(filteredPosts.map(p => p.id)));
    };
    
    const handleDownloadLoadedImages = async () => {
        const imagePosts = filteredPosts.filter(p => p.full_picture);
        if (imagePosts.length === 0) {
            addNotification("No image posts found in the current view to download.", "info");
            return;
        }
        setIsDownloadingImages(true);
        addNotification(`Preparing to download ${imagePosts.length} images...`, 'info');
        const zip = new JSZip();
        
        try {
            for (const post of imagePosts) {
                const element = document.querySelector(`[data-post-id="${post.id}"]`) as HTMLElement;
                if (element) {
                    const canvas = await html2canvas(element, {
                        allowTaint: true,
                        useCORS: true,
                        scale: 2
                    });
                    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                    const fileName = `${(post.message || post.id).slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.jpeg`;
                    zip.file(fileName, dataUrl.split(',')[1], { base64: true });
                }
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `facebook_posts_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            addNotification('ZIP file download initiated!', 'success');
        } catch (e: any) {
            addNotification(`Error creating ZIP file: ${e.message}`, 'error');
        } finally {
            setIsDownloadingImages(false);
        }
    };

    // Helper to safely get post reach
    const getPostReach = (post: ManagedPost): number => {
        const value = post.insights?.data?.[0]?.values?.[0]?.value;
        return typeof value === 'number' ? value : 0;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex rounded-lg shadow-sm"><button onClick={() => setPostTypeToShow('published')} className={`px-4 py-2 rounded-l-lg text-sm font-medium transition-colors ${postTypeToShow === 'published' ? 'bg-primary text-primary-text' : 'bg-gray-100 text-gray-800 dark:text-gray-200 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>Published ({publishedPosts.length})</button><button onClick={() => setPostTypeToShow('scheduled')} className={`px-4 py-2 rounded-r-lg text-sm font-medium transition-colors ${postTypeToShow === 'scheduled' ? 'bg-primary text-primary-text' : 'bg-gray-100 text-gray-800 dark:text-gray-200 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>Scheduled ({scheduledPosts.length})</button></div>
                <div className="flex items-center gap-4 flex-wrap">
                    {(postTypeToShow === 'published' ? nextPageUrl : nextScheduledPageUrl) && !isFetchingPosts && (
                        <button 
                            onClick={() => handleFetchPosts(activePage, postTypeToShow, (postTypeToShow === 'published' ? nextPageUrl : nextScheduledPageUrl))} 
                            disabled={isFetchingMore} 
                            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-800 dark:text-gray-200 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {isFetchingMore ? <Spinner size="sm" /> : <ChevronDownIcon className="w-4 h-4" />}
                            {isFetchingMore ? 'Loading...' : 'Load More'}
                        </button>
                    )}
                    {postTypeToShow === 'published' && ( <div className="flex items-center gap-2"><label htmlFor="sort-posts" className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label><select id="sort-posts" value={sortKey} onChange={(e) => setSortKey(e.target.value as PostSortKey)} className="p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm"><option value="default">Most Recent</option><option value="likes">Likes</option><option value="comments">Comments</option><option value="reach">Reach</option></select></div>)}
                    {isDeletingAll ? (
                        <div className="flex items-center gap-2 text-sm font-semibold p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <Spinner size="sm" color="text-red-600" />
                            <span className="text-red-600 dark:text-red-400">
                                Deleting... ({deletedPostsCount}) | {formatTime(timer)}
                            </span>
                            <button onClick={handleAllDeleteToggle} title="Stop Deleting" className="p-1 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleAllDeleteToggle} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                            <TrashIcon className="w-4 h-4" /> Delete All Posts
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50">
                <button onClick={() => setIsFilterVisible(!isFilterVisible)} className="w-full flex justify-between items-center p-4 font-semibold text-lg"><span className="text-gray-800 dark:text-gray-200">Filter & Select Options</span><ChevronDownIcon className={`w-6 h-6 transition-transform ${isFilterVisible ? 'rotate-180' : ''}`} /></button>
                {isFilterVisible && <div className="p-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="lg:col-span-4"><label className="block text-sm font-medium mb-1">Keyword</label><input type="text" value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)} placeholder="Search in message..." className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div><label className="block text-sm font-medium mb-1">Min Likes</label><input type="number" value={filterMinLikes} onChange={e => setFilterMinLikes(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div><label className="block text-sm font-medium mb-1">Max Likes</label><input type="number" value={filterMaxLikes} onChange={e => setFilterMaxLikes(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div><label className="block text-sm font-medium mb-1">Min Comments</label><input type="number" value={filterMinComments} onChange={e => setFilterMinComments(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div><label className="block text-sm font-medium mb-1">Max Comments</label><input type="number" value={filterMaxComments} onChange={e => setFilterMaxComments(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div className="lg:col-span-2"><label className="block text-sm font-medium mb-1">Start Date</label><input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div className="lg:col-span-2"><label className="block text-sm font-medium mb-1">End Date</label><input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/></div>
                    <div className="lg:col-span-4"><button onClick={handleClearFilters} className="w-full px-4 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Clear Filters</button></div>
                    <div className="lg:col-span-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-2"><label className="font-medium" htmlFor="select-mode-toggle">Select Mode</label><div className="relative"><input type="checkbox" id="select-mode-toggle" checked={isSelectMode} onChange={e => setIsSelectMode(e.target.checked)} className="sr-only peer"/><label htmlFor="select-mode-toggle" className="block w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></label></div></div>
                        {isSelectMode && <>
                            <button onClick={handleSelectAllFiltered} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600">Select All Filtered ({filteredPosts.length})</button>
                            <button onClick={handleDeleteSelectedPosts} disabled={selectedPostIds.size === 0 || isDeletingSelected} className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">{isDeletingSelected ? <Spinner size="sm"/> : <TrashIcon className="w-4 h-4" />} Delete Selected ({selectedPostIds.size})</button>
                        </>}
                    </div>
                </div>}
            </div>

            {postTypeToShow === 'published' && (<div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <button onClick={handleBulkAiReplyProcess} disabled={isBulkReplying || !!replyingPostId} className="px-4 py-2 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">{isBulkReplying ? <Spinner size="sm" /> : <GenerateIcon />} AI Reply to All Loaded</button>
                    <button onClick={handleDownloadLoadedImages} disabled={isDownloadingImages} className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">{isDownloadingImages ? <Spinner size="sm" /> : <DownloadIcon />} Download Loaded Images</button>
                </div>
                <div><label htmlFor="custom-cta" className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Reply Call-to-Action</label><input id="custom-cta" type="text" value={customCta} onChange={(e) => setCustomCta(e.target.value)} className="w-full mt-2 p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm"/></div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700"><label htmlFor="image-context-toggle" className="flex flex-col cursor-pointer"><span className="font-medium text-gray-700 dark:text-gray-300">Analyze Image for Replies</span><span className="text-xs text-gray-500 dark:text-gray-400">Slower, but more context-aware.</span></label><div className="relative"><input type="checkbox" id="image-context-toggle" checked={useImageContextForReply} onChange={e => setUseImageContextForReply(e.target.checked)} className="sr-only peer"/><div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></div></div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700"><label htmlFor="mention-name-toggle" className="font-medium text-gray-700 dark:text-gray-300">Mention Commenter in Reply</label><div className="relative"><input type="checkbox" id="mention-name-toggle" checked={mentionCommenterName} onChange={e => setMentionCommenterName(e.target.checked)} className="sr-only peer"/><div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></div></div>
                <div className="flex justify-end pt-2">
                    <button onClick={handleClearReplyHistory} className="text-xs text-red-500 hover:underline">
                        {/* FIX: The reduce function was missing an initial value, causing a type error. Added 0 as the initial value. */}
                        Clear Reply History ({Object.values(repliedCommentHistory).reduce((acc: number, val: string[]) => acc + val.length, 0)} records)
                    </button>
                </div>
            </div>)}

            {isFetchingPosts && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
            {postsError && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow"><p>{postsError}</p></div>}
            
            {!isFetchingPosts && filteredPosts.length === 0 && (<div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-2xl shadow-md"><h2 className="text-xl font-semibold">No {postTypeToShow} posts found.</h2><p className="mt-1 text-sm text-gray-500">Try adjusting your filters or loading more posts.</p></div>)}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {filteredPosts.map(post => {
                    const isSelected = isSelectMode && selectedPostIds.has(post.id);
                    return (
                        <div data-post-id={post.id} key={post.id} onClick={(e) => handleCardClick(e, post)} className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-200 ease-in-out ${isSelectMode ? 'cursor-pointer' : 'hover:shadow-2xl hover:-translate-y-1'} ${isSelected ? 'ring-4 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900' : ''}`}>
                             <div className="relative w-full aspect-square bg-gray-200 dark:bg-gray-700"><img src={post.full_picture} alt="" className="w-full h-full object-cover" loading="lazy" /><button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors z-10"><TrashIcon className="w-4 h-4"/></button></div>
                            <div className="p-4 flex-grow flex flex-col justify-between">
                                <div><p className="text-sm text-gray-600 dark:text-gray-300 mb-3 break-words">{post.message ? post.message.substring(0, 150) + (post.message.length > 150 ? '...' : '') : 'No caption.'}</p><p className="text-xs text-gray-400 dark:text-gray-500">{post.created_time ? new Date(post.created_time).toLocaleString() : post.scheduled_publish_time ? `Scheduled: ${new Date(post.scheduled_publish_time * 1000).toLocaleString()}`: ''}</p></div>
                                {postTypeToShow === 'published' && (<div className="mt-4"><div className="flex justify-around items-center text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3"><span className="flex items-center gap-1"><ThumbsUpIcon className="w-4 h-4"/>{post.likes?.summary?.total_count ?? 0}</span><span className="flex items-center gap-1"><ChatBubbleIcon className="w-4 h-4"/>{post.comments?.summary?.total_count ?? 0}</span><span className="flex items-center gap-1"><EyeIcon className="w-4 h-4"/>{getPostReach(post).toLocaleString()}</span></div>{(post.comments?.summary?.total_count ?? 0) > 0 && (<button onClick={(e) => {e.stopPropagation(); handleAiReplyToAll(post);}} disabled={!!replyingPostId} className="w-full mt-3 py-1.5 px-2 text-xs font-semibold text-white bg-purple-500 rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">{replyingPostId === post.id ? <Spinner size="sm"/> : <GenerateIcon className="w-3 h-3"/>}{replyingPostId === post.id ? "Replying..." : "AI Reply"}</button>)}</div>)}
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

const ManagePostsPage: React.FC = () => {
    const { isAuthenticated, activePage, logout } = useFacebookPage();
    
    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Manage Posts" subtitle="Connect to Facebook to manage your page's posts." />;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h1 className="text-2xl font-bold">Manage Posts</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                   Viewing posts for: <span className="font-semibold text-primary">{activePage.name}</span>
                </p>
            </div>
            
            {activePage && <ManagePostsContent activePage={activePage} onAuthError={logout} />}
        </div>
    );
};

export default ManagePostsPage;