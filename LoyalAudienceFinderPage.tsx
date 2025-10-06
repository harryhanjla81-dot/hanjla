import React, { useState, useCallback } from 'react';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import Spinner from './components/Spinner.tsx';
import { UserGroupIcon } from './components/IconComponents.tsx';
import { FBPage } from './types.ts';
import { useFacebookPage } from './src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './components/FacebookLoginPrompt.tsx';

// --- CONSTANTS & HELPERS ---
const API_VERSION = 'v19.0';

interface LoyalUser {
    id: string;
    name: string;
    count: number;
}


const LoyalAudienceFinderPage: React.FC = () => {
    const { addNotification } = useNotification();
    const { isAuthenticated, activePage, logout } = useFacebookPage();

    // Feature State
    const [numPosts, setNumPosts] = useState(200);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loyalUsers, setLoyalUsers] = useState<LoyalUser[]>([]);

    // --- CORE FEATURE LOGIC ---
    const handleFindAudience = useCallback(async () => {
        if (!activePage) {
            addNotification('Please select a page.', 'error');
            return;
        }
        setIsLoading(true);
        setError(null);
        setLoyalUsers([]);

        try {
            const fields = `likes.limit(500){id,name},comments.limit(500){from}`;
            const url = `https://graph.facebook.com/${API_VERSION}/${activePage.id}/posts?fields=${fields}&limit=${numPosts}&access_token=${activePage.access_token}`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);
            
            const posts = data.data || [];
            const userFreq: Record<string, { name: string; count: number }> = {};

            posts.forEach((post: any) => {
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

            const users = Object.entries(userFreq)
                .map(([id, { name, count }]) => ({ id, name, count }))
                .filter(user => user.count > 1)
                .sort((a, b) => b.count - a.count);

            setLoyalUsers(users);
            addNotification(`Found ${users.length} loyal audience members.`, 'success');

        } catch (e: any) {
            setError(e.message);
            addNotification(`Error finding audience: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [activePage, numPosts, addNotification]);

    const handleExportCsv = () => {
        if (loyalUsers.length === 0 || !activePage) return;
        
        let csvContent = "data:text/csv;charset=utf-8,Name,Profile Link,Interaction Count\n";
        
        loyalUsers.forEach(user => {
            const name = `"${user.name.replace(/"/g, '""')}"`;
            const link = `https://facebook.com/${user.id}`;
            csvContent += [name, link, user.count].join(',') + '\n';
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `loyal_audience_${activePage.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification('CSV export started.', 'info');
    };

    // --- RENDER LOGIC ---
    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Loyal Audience Finder" subtitle="Connect to Facebook to find your most loyal audience." />;
    }

    return (
        <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h1 className="text-2xl font-bold">Loyal Audience Finder</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Analyzing posts from: <span className="font-semibold text-primary">{activePage.name}</span>
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                     <h2 className="text-lg font-semibold">Configuration</h2>
                    <div>
                        <label className="block text-sm font-medium mb-1">Number of Posts to Analyze</label>
                        <input type="number" value={numPosts} onChange={e => setNumPosts(parseInt(e.target.value, 10))} min="1" max="500" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                    <button onClick={handleFindAudience} disabled={isLoading} className="w-full py-3 bg-primary text-primary-text font-bold rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? <Spinner/> : <UserGroupIcon/>} Find Loyal Audience
                    </button>
                    {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
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
                    {isLoading ? <div className="flex justify-center items-center h-64"><Spinner size="lg"/></div>
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
        </div>
    );
};

export default LoyalAudienceFinderPage;