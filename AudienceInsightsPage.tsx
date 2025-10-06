
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import * as geminiService from './services/geminiService.ts';
import Spinner from './components/Spinner.tsx';
import { ClipboardIcon, GenerateIcon, UserGroupIcon, ThumbsUpIcon, ChatBubbleIcon } from './components/IconComponents.tsx';
import { useFacebookPage } from './src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './components/FacebookLoginPrompt.tsx';
import { FBPage, ManagedPost, PageInsightsSummary, InsightDataPoint, TopEngagingPost } from './types.ts';


// --- CONSTANTS & TYPES ---
const API_VERSION = 'v19.0';
const HINDI_STOPWORDS = new Set(['मैं','मुझको','मेरा','अपने',' हमने','हमारा','आपका','आपके','उनका','वे','यह','वह','जो','तो','से','में','पर','और','है','हैं','था','थे','थी','गया','गई','गए','किया','कर','रਹਾ',' रही','रहे','हुआ','हुई','हुए','लिये','लिए','एक','इस','उस','को','क्या','कैसे','क्यों','कौन','किस','किसी','किधर','कोई','कुछ','अभी','कभी','सभी','तब','जब','यहां','वहां','कहां','किंतु','परंतु','क्योंकि','इसलिए','आदि','इत्यादि','द्वारा','की','के',' का','एवं','तथा','यदि','अगर']);
const ENGLISH_STOPWORDS = new Set(['i','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']);

interface LoyalUser {
    id: string;
    name: string;
    count: number;
}

// --- HELPER COMPONENTS from Page Insights ---
const KPICard: React.FC<{ title: string; value: string; description: string }> = ({ title, value, description }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50 transform transition-transform hover:-translate-y-1">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{description}</p>
    </div>
);

const FollowerGrowthChart: React.FC<{ data: InsightDataPoint[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-500">No follower data for this period.</div>;
    }

    const values = data.map(d => d.value);
    const maxVal = Math.max(...values, 0); 
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal;

    const getPointY = (value: number) => {
        if (range === 0) return 50;
        return 100 - ((value - minVal) / range) * 90 + 5;
    };
    
    const pathData = data.map((d, i) => {
        const x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
        const y = getPointY(d.value);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Follower Growth (Net)</h3>
            <div className="h-64 relative">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="0" y1={getPointY(0)} x2="100" y2={getPointY(0)} stroke="rgba(156, 163, 175, 0.3)" strokeWidth="0.5" strokeDasharray="2,2" />
                    <path d={pathData} fill="none" stroke="var(--app-primary-color, #6366F1)" strokeWidth="0.5" />
                </svg>
                <div className="absolute inset-0 flex justify-between items-end text-xs text-gray-400">
                    <span>{data[0]?.date}</span>
                    <span>{data[data.length-1]?.date}</span>
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
const AudienceInsightsPage: React.FC = () => {
    const { addNotification } = useNotification();
    const { isAuthenticated, activePage, logout } = useFacebookPage();
    const [activeTab, setActiveTab] = useState<'insights' | 'topics' | 'audience'>('insights');
    
    // Date Range State for Insights
    const [dateRange, setDateRange] = useState(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 28);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    });

    // State for Page Insights
    const [summaryData, setSummaryData] = useState<PageInsightsSummary | null>(null);
    const [isFetchingData, setIsFetchingData] = useState(true);
    const [aiInsights, setAiInsights] = useState<string | null>(null);
    const [isFetchingInsights, setIsFetchingInsights] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof TopEngagingPost; direction: 'desc' | 'asc' }>({ key: 'engagement', direction: 'desc' });

    // State for Trending Topics
    const [topicsNumPosts, setTopicsNumPosts] = useState(50);
    const [isTopicsLoading, setIsTopicsLoading] = useState(false);
    const [isGeneratingPost, setIsGeneratingPost] = useState(false);
    const [topicsError, setTopicsError] = useState<string | null>(null);
    const [foundTopics, setFoundTopics] = useState<string[]>([]);
    const [generatedPost, setGeneratedPost] = useState<string>('');

    // State for Loyal Audience
    const [audienceNumPosts, setAudienceNumPosts] = useState(200);
    const [isAudienceLoading, setIsAudienceLoading] = useState(false);
    const [audienceError, setAudienceError] = useState<string | null>(null);
    const [loyalUsers, setLoyalUsers] = useState<LoyalUser[]>([]);

    // --- LOGIC FOR PAGE INSIGHTS ---
    const fetchInsightsData = useCallback(async (page: FBPage, startDateStr: string, endDateStr: string) => {
        setIsFetchingData(true);
        setAiInsights(null);
        setSummaryData(null);
        try {
            const until = Math.floor(new Date(endDateStr).setHours(23, 59, 59, 999) / 1000);
            const since = Math.floor(new Date(startDateStr).getTime() / 1000);
            const batch = [
                { method: 'GET', relative_url: `/${page.id}/insights?metric=page_fans&period=day`},
                { method: 'GET', relative_url: `/${page.id}/insights?metric=page_fan_adds_unique,page_fan_removes_unique,page_impressions_unique,page_engaged_users&period=day&since=${since}&until=${until}`},
            ];
            const formData = new FormData();
            formData.append('access_token', page.access_token);
            formData.append('batch', JSON.stringify(batch));
            const response = await fetch(`https://graph.facebook.com/${API_VERSION}`, { method: 'POST', body: formData });
            const batchData = await response.json();
            if (batchData.error) throw new Error(`Batch request failed: ${batchData.error.message}`);
            
            const getResult = (batchIndex: number, metricName: string) => {
                 if (batchData[batchIndex]?.code === 200) {
                    try {
                        const body = JSON.parse(batchData[batchIndex].body);
                        return body.data?.find((d: any) => d.name === metricName);
                    } catch { return null; }
                }
                return null;
            };

            const totalFollowers = getResult(0, 'page_fans')?.values?.slice(-1)[0]?.value || 0;
            
            let newFollowers = 0;
            const followerChartData: InsightDataPoint[] = [];

            const fanAddsData = getResult(1, 'page_fan_adds_unique')?.values || [];
            const fanRemovesData = getResult(1, 'page_fan_removes_unique')?.values || [];
            const dailyReachData = getResult(1, 'page_impressions_unique')?.values || [];
            const dailyEngagementData = getResult(1, 'page_engaged_users')?.values || [];

            const fanAddsMap = new Map(fanAddsData.map((item: any) => [item.end_time.split('T')[0], item.value]));
            const fanRemovesMap = new Map(fanRemovesData.map((item: any) => [item.end_time.split('T')[0], item.value]));

            const diffDays = Math.ceil(Math.abs(new Date(endDateStr).getTime() - new Date(startDateStr).getTime()) / (1000 * 3600 * 24)) + 1;

            for (let i = 0; i < diffDays; i++) {
                const d = new Date(startDateStr);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const adds = fanAddsMap.get(dateStr) || 0;
                const removes = fanRemovesMap.get(dateStr) || 0;
                const netChange = adds - removes;
                newFollowers += netChange;
                followerChartData.push({ date: d.toLocaleDateString('en-us',{month: 'short', day: 'numeric'}), value: netChange });
            }

            // FIX: Ensure values are numbers before summing to prevent errors with objects.
            const totalReach = dailyReachData.reduce((sum: number, item: any) => sum + (typeof item.value === 'number' ? item.value : 0), 0);
            const totalEngagement = dailyEngagementData.reduce((sum: number, item: any) => sum + (typeof item.value === 'number' ? item.value : 0), 0);
            
            const postsUrl = `https://graph.facebook.com/${API_VERSION}/${page.id}/posts?fields=id,message,full_picture,likes.summary(true),comments.summary(true)&since=${since}&until=${until}&limit=100&access_token=${page.access_token}`;
            const postsResponse = await fetch(postsUrl);
            const postsData = await postsResponse.json();
            if (postsData.error) throw new Error(`Failed to fetch posts: ${postsData.error.message}`);
            
            const latestPosts: ManagedPost[] = postsData.data || [];
            let topPosts: TopEngagingPost[] = [];
            if (latestPosts.length > 0) {
                 const postInsightsBatch = latestPosts.map(post => ({ method: 'GET', relative_url: `/${post.id}/insights?metric=post_impressions_unique,post_engaged_users`}));
                 const postFormData = new FormData();
                 postFormData.append('access_token', page.access_token);
                 postFormData.append('batch', JSON.stringify(postInsightsBatch));
                 const postBatchResponse = await fetch(`https://graph.facebook.com/${API_VERSION}`, { method: 'POST', body: postFormData });
                 const postBatchData = await postBatchResponse.json();
                 if (!postBatchData.error) {
                    topPosts = latestPosts.map((post, index) => {
                        const res = postBatchData[index];
                        if (res?.code === 200) {
                             try {
                                const body = JSON.parse(res.body);
                                // FIX: Facebook API can return an object for `value` instead of a number, causing errors.
                                // Added a `typeof` check to ensure `reach` and `engagement` are always numbers.
                                const reachRaw = body.data?.find((m: any) => m.name === 'post_impressions_unique')?.values?.[0]?.value;
                                const engagementRaw = body.data?.find((m: any) => m.name === 'post_engaged_users')?.values?.[0]?.value;
                                const reach = typeof reachRaw === 'number' ? reachRaw : 0;
                                const engagement = typeof engagementRaw === 'number' ? engagementRaw : 0;
                                return { id: post.id, message: post.message || 'No caption', thumbnail: post.full_picture || '', reach, engagement, likes: post.likes?.summary.total_count || 0, comments: post.comments?.summary.total_count || 0 };
                            } catch (e) { /* ignore parse error */ }
                        }
                        return null;
                    }).filter((p): p is TopEngagingPost => p !== null);
                }
            }
            setSummaryData({ totalFollowers, newFollowers, totalReach, totalEngagement, followerChartData, topPosts });
        } catch (e: any) { 
            const message = (e.message || '').toLowerCase();
            if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                logout();
                addNotification('Facebook session is invalid. Please log in again.', 'error');
            } else {
                addNotification(`Failed to fetch insights: ${e.message}`, 'error');
            }
        } 
        finally { setIsFetchingData(false); }
    }, [addNotification, logout]);


    const handleGetAiInsights = async () => {
        if (!summaryData || !activePage) return;
        setIsFetchingInsights(true);
        try {
            const insights = await geminiService.getPageInsights(JSON.stringify(summaryData), activePage.name);
            setAiInsights(insights);
            addNotification("AI Insights generated!", "success");
        } catch(e: any) { addNotification(`Error generating AI insights: ${e.message}`, "error"); } 
        finally { setIsFetchingInsights(false); }
    }
    
    const handleSort = (key: keyof TopEngagingPost) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTopPosts = useMemo(() => {
        if (!summaryData?.topPosts) return [];
        // FIX: Replaced dynamic property access with a type-safe switch statement to prevent potential arithmetic errors on non-numeric types and to respect sort direction.
        return [...summaryData.topPosts].sort((a, b) => {
            const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;
            switch (sortConfig.key) {
                case 'engagement':
                    return (a.engagement - b.engagement) * directionMultiplier;
                case 'reach':
                    return (a.reach - b.reach) * directionMultiplier;
                case 'likes':
                    return (a.likes - b.likes) * directionMultiplier;
                case 'comments':
                    return (a.comments - b.comments) * directionMultiplier;
                default:
                    return 0;
            }
        });
    }, [summaryData, sortConfig]);


    useEffect(() => {
        if (activePage && activeTab === 'insights') {
            fetchInsightsData(activePage, dateRange.start, dateRange.end);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePage, activeTab]);


    // --- LOGIC FOR TRENDING TOPICS ---
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
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    };

    const handleScanTopics = useCallback(async () => {
        if (!activePage) return;
        setIsTopicsLoading(true);
        setTopicsError(null);
        setFoundTopics([]);
        setGeneratedPost('');
        try {
            const fields = `message,comments.limit(100){message}`;
            const url = `https://graph.facebook.com/${API_VERSION}/${activePage.id}/posts?fields=${fields}&limit=${topicsNumPosts}&access_token=${activePage.access_token}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const allComments = (data.data || []).flatMap((post: any) => post.comments?.data?.filter((c: any) => c.message) || []);
            if (allComments.length === 0) {
                addNotification('No comments found in the latest posts to analyze.', 'info');
                return;
            }
            const topics = analyzeComments(allComments);
            setFoundTopics(topics);
            addNotification('Comment scan complete. Top topics identified.', 'success');
        } catch (e: any) {
            setTopicsError(e.message);
            addNotification(`Error scanning posts: ${e.message}`, 'error');
        } finally {
            setIsTopicsLoading(false);
        }
    }, [activePage, topicsNumPosts, addNotification]);

    const handleGeneratePost = async () => {
        if (foundTopics.length === 0) return;
        setIsGeneratingPost(true);
        try {
            const post = await geminiService.generatePostFromTopics(foundTopics);
            setGeneratedPost(post);
        } catch (e: any) {
            addNotification(`Error generating post: ${e.message}`, 'error');
        } finally {
            setIsGeneratingPost(false);
        }
    };
    
    const handleCopyPost = () => {
        if(!generatedPost) return;
        navigator.clipboard.writeText(generatedPost);
        addNotification('Post copied to clipboard!', 'success');
    }

    // --- LOGIC FOR LOYAL AUDIENCE ---
    const handleFindAudience = useCallback(async () => {
        if (!activePage) return;
        setIsAudienceLoading(true);
        setAudienceError(null);
        setLoyalUsers([]);
        try {
            const fields = `likes.limit(500){id,name},comments.limit(500){from}`;
            const url = `https://graph.facebook.com/${API_VERSION}/${activePage.id}/posts?fields=${fields}&limit=${audienceNumPosts}&access_token=${activePage.access_token}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const userFreq: Record<string, { name: string; count: number }> = {};
            (data.data || []).forEach((post: any) => {
                const likers = new Set<string>();
                if (post.likes?.data) {
                    post.likes.data.forEach((like: any) => {
                        if (!likers.has(like.id)) {
                             userFreq[like.id] = { name: like.name, count: (userFreq[like.id]?.count || 0) + 1 };
                             likers.add(like.id);
                        }
                    });
                }
                if (post.comments?.data) {
                    post.comments.data.forEach((comment: any) => {
                        if (comment.from && !likers.has(comment.from.id)) {
                             userFreq[comment.from.id] = { name: comment.from.name, count: (userFreq[comment.from.id]?.count || 0) + 1 };
                        }
                    });
                }
            });
            const users = Object.entries(userFreq).map(([id, { name, count }]) => ({ id, name, count })).filter(user => user.count > 1).sort((a, b) => b.count - a.count);
            setLoyalUsers(users);
            addNotification(`Found ${users.length} loyal audience members.`, 'success');
        } catch (e: any) {
            setAudienceError(e.message);
            addNotification(`Error finding audience: ${e.message}`, 'error');
        } finally {
            setIsAudienceLoading(false);
        }
    }, [activePage, audienceNumPosts, addNotification]);

    const handleExportCsv = () => {
        if (loyalUsers.length === 0 || !activePage) return;
        let csvContent = "data:text/csv;charset=utf-8,Name,Profile Link,Interaction Count\n";
        loyalUsers.forEach(user => {
            csvContent += [`"${user.name.replace(/"/g, '""')}"`, `https://facebook.com/${user.id}`, user.count].join(',') + '\n';
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `loyal_audience_${activePage.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification('CSV export started.', 'info');
    };

    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Audience Insights" subtitle="Connect to Facebook to analyze your audience." />;
    }

    const TabButton: React.FC<{ tabId: 'insights' | 'topics' | 'audience'; children: React.ReactNode; }> = ({ tabId, children }) => (
         <button onClick={() => setActiveTab(tabId)} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tabId ? 'bg-primary text-primary-text' : 'bg-gray-100 text-gray-800 dark:text-gray-200 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {children}
        </button>
    );
    
    const SortableHeader: React.FC<{ sortKey: keyof TopEngagingPost; children: React.ReactNode; className?: string; }> = ({ sortKey, children, className }) => (
        <th scope="col" className={`px-4 py-3 cursor-pointer select-none ${className}`} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center justify-end gap-1">
                {children}
                <span className="w-4">
                    {sortConfig.key === sortKey && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                </span>
            </div>
        </th>
    );


    return (
        <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h1 className="text-2xl font-bold">Audience Insights</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analyzing posts from: <span className="font-semibold text-primary">{activePage.name}</span></p>
            </div>
            
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <TabButton tabId="insights">Page Insights</TabButton>
                <TabButton tabId="topics">Trending Topics</TabButton>
                <TabButton tabId="audience">Loyal Audience</TabButton>
            </div>

            {activeTab === 'insights' && (
                 <div className="space-y-8 animate-[fade-in_0.5s_ease-out]">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border dark:border-gray-700 flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Date</label>
                            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">End Date</label>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                        </div>
                        <button onClick={() => fetchInsightsData(activePage, dateRange.start, dateRange.end)} disabled={isFetchingData} className="px-6 py-2 bg-primary text-primary-text font-bold rounded-md hover:bg-primary-hover disabled:opacity-50">
                            Apply
                        </button>
                    </div>

                    {isFetchingData ? <div className="flex justify-center items-center py-20"><Spinner size="lg" /></div>
                    : summaryData ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <KPICard title="Total Followers" value={summaryData.totalFollowers.toLocaleString()} description="Current page likes" />
                                <KPICard title="New Followers" value={`${summaryData.newFollowers > 0 ? '+' : ''}${summaryData.newFollowers.toLocaleString()}`} description={`For period: ${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`} />
                                <KPICard title="Total Reach" value={summaryData.totalReach.toLocaleString()} description={`For period`} />
                                <KPICard title="Total Engagement" value={summaryData.totalEngagement.toLocaleString()} description={`For period`} />
                            </div>
                            <FollowerGrowthChart data={summaryData.followerChartData} />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Top Posts</h3></div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                                <tr>
                                                    <th scope="col" className="px-4 py-3">Post</th>
                                                    <SortableHeader sortKey="reach">Reach</SortableHeader>
                                                    <SortableHeader sortKey="engagement">Engagement</SortableHeader>
                                                    <SortableHeader sortKey="likes"><ThumbsUpIcon className="w-4 h-4 inline-block" /></SortableHeader>
                                                    <SortableHeader sortKey="comments"><ChatBubbleIcon className="w-4 h-4 inline-block" /></SortableHeader>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedTopPosts.length > 0 ? sortedTopPosts.map(post => (
                                                    <tr key={post.id} className="group border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 font-medium flex items-center gap-3 relative">
                                                            <img src={post.thumbnail} alt="" className="w-10 h-10 object-cover rounded-md flex-shrink-0"/>
                                                            <div className="relative">
                                                                <span className="truncate w-40 inline-block" title={post.message}>{post.message}</span>
                                                                {post.thumbnail && (
                                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10 pointer-events-none">
                                                                        <img src={post.thumbnail} alt="Post preview" className="w-full h-auto object-cover rounded-md" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold">{post.reach.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right font-semibold">{post.engagement.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right">{post.likes.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right">{post.comments.toLocaleString()}</td>
                                                    </tr>
                                                )) : (<tr><td colSpan={5} className="text-center py-8 text-gray-500">No posts with data for this period.</td></tr>)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/50"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">AI-Powered Insights</h3><button onClick={handleGetAiInsights} disabled={isFetchingInsights} className="px-4 py-2 text-sm bg-primary text-primary-text rounded-md hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50">{isFetchingInsights ? <Spinner size="sm" /> : <GenerateIcon className="w-4 h-4"/>}{isFetchingInsights ? "Analyzing..." : "Get Insights"}</button></div>{isFetchingInsights ? <div className="flex justify-center items-center h-40"><Spinner/></div> : aiInsights ? <div className="space-y-3 text-sm whitespace-pre-line bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">{aiInsights}</div> : <div className="text-center py-10 text-gray-500"><p>Click "Get Insights" for AI-powered tips.</p></div>}</div>
                            </div>
                        </>
                    ) : <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg shadow-md"><h2 className="text-xl font-semibold">Could not load insights data.</h2><p className="mt-2 text-gray-500 dark:text-gray-400">Please refresh or check token permissions.</p></div>}
                </div>
            )}

            {activeTab === 'topics' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fade-in_0.5s_ease-out]">
                    <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                        <h2 className="text-lg font-semibold">1. Configuration</h2>
                        <div>
                            <label className="block text-sm font-medium mb-1">Number of Posts to Analyze</label>
                            <input type="number" value={topicsNumPosts} onChange={e => setTopicsNumPosts(parseInt(e.target.value, 10))} min="1" max="100" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                        </div>
                        <button onClick={handleScanTopics} disabled={isTopicsLoading} className="w-full py-3 bg-primary text-primary-text font-bold rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2">
                            {isTopicsLoading ? <Spinner/> : 'Scan Comments'}
                        </button>
                        {topicsError && <p className="text-sm text-red-500 mt-2">{topicsError}</p>}
                    </div>
                    <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                        <h2 className="text-lg font-semibold">2. Results</h2>
                        <div>
                            <h3 className="font-semibold mb-2">Top Topics Found:</h3>
                            {foundTopics.length > 0 ? (
                                <ul className="flex flex-wrap gap-2">
                                    {foundTopics.map(topic => <li key={topic} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-sm">{topic}</li>)}
                                </ul>
                            ) : (<p className="text-sm text-gray-500">Scan comments to see topics here.</p>)}
                        </div>
                        {foundTopics.length > 0 && (
                            <button onClick={handleGeneratePost} disabled={isGeneratingPost} className="w-full py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                {isGeneratingPost ? <Spinner/> : <GenerateIcon/>} Generate Post from Topics
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
            )}

            {activeTab === 'audience' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fade-in_0.5s_ease-out]">
                    <div className="lg:col-span-1 space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                         <h2 className="text-lg font-semibold">Configuration</h2>
                        <div>
                            <label className="block text-sm font-medium mb-1">Number of Posts to Analyze</label>
                            <input type="number" value={audienceNumPosts} onChange={e => setAudienceNumPosts(parseInt(e.target.value, 10))} min="1" max="500" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                        </div>
                        <button onClick={handleFindAudience} disabled={isAudienceLoading} className="w-full py-3 bg-primary text-primary-text font-bold rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2">
                            {isAudienceLoading ? <Spinner/> : <UserGroupIcon/>} Find Loyal Audience
                        </button>
                        {audienceError && <p className="text-sm text-red-500 mt-2">{audienceError}</p>}
                    </div>
                    <div className="lg:col-span-2 space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                         <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Results</h2>
                            {loyalUsers.length > 0 && (
                                <button onClick={handleExportCsv} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
                                    Export CSV
                                </button>
                            )}
                        </div>
                        {isAudienceLoading ? <div className="flex justify-center items-center h-64"><Spinner size="lg"/></div>
                        : loyalUsers.length > 0 ? (
                            <div className="overflow-auto max-h-96 border dark:border-gray-700 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Name</th>
                                            <th scope="col" className="px-6 py-3">Profile Link</th>
                                            <th scope="col" className="px-6 py-3 text-center">Interactions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loyalUsers.map(user => (
                                            <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-6 py-4 font-medium whitespace-nowrap">{user.name}</td>
                                                <td className="px-6 py-4"><a href={`https://facebook.com/${user.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Profile</a></td>
                                                <td className="px-6 py-4 text-center font-bold text-lg">{user.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-gray-500">
                                <p>Find your most engaged audience members here.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudienceInsightsPage;