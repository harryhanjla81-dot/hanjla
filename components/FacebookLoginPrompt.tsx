import React, { useState } from 'react';
import { useFacebookPage } from '../src/contexts/FacebookPageContext.tsx';
import Spinner from './Spinner.tsx';

const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.323-1.325z"/>
    </svg>
);

const FacebookLoginPrompt: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
    const { login, isLoading, loginError } = useFacebookPage();
    const [token, setToken] = useState('');

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800/50 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl text-center">
                <FacebookIcon className="mx-auto h-12 w-12 text-blue-500" />
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{title}</h2>
                <p className="text-gray-500 dark:text-gray-400">{subtitle}</p>
                {loginError && <p className="text-center text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">{loginError}</p>}
                <div>
                    <label htmlFor="accessToken" className="sr-only">User Access Token</label>
                    <input
                        id="accessToken"
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste your token here"
                        className="w-full p-3 text-center text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition"
                    />
                    <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary/80 hover:text-primary hover:underline mt-2 block">
                        How to get a token?
                    </a>
                </div>
                <button onClick={() => login(token)} disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg hover:from-blue-700 hover:to-blue-600 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center transition-all transform hover:-translate-y-px">
                    {isLoading ? <Spinner size="sm" /> : 'Connect to Facebook'}
                </button>
            </div>
        </div>
    );
};

export default FacebookLoginPrompt;
