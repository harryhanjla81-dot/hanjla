import React from 'react';
import MessagesContent from './components/MessagesContent.tsx';
import { useFacebookPage } from './src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './components/FacebookLoginPrompt.tsx';

// --- MAIN PAGE COMPONENT ---
const MessagesPage: React.FC = () => {
    const { isAuthenticated, activePage, logout } = useFacebookPage();
    
    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Manage Messages" subtitle="Connect to Facebook to manage your page's messages." />;
    }
    
    return (
         <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h1 className="text-2xl font-bold">Inbox</h1>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                   Viewing messages for: <span className="font-semibold text-primary">{activePage.name}</span>
                </p>
            </div>
            {activePage && <MessagesContent activePage={activePage} onAuthError={logout} />}
        </div>
    );
};

export default MessagesPage;