
import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import { TrashIcon, CloseIcon, ShieldCheckIcon, ClipboardIcon, DownloadIcon } from './components/IconComponents.tsx';
import Spinner from './components/Spinner.tsx';
import * as totpGenerator from 'totp-generator';

const STORAGE_KEY = '2fa_accounts_v1';

interface TwoFactorAccount {
    id: string;
    name: string;
    secret: string;
}

interface GeneratedCode {
    code: string;
    timeLeft: number;
}

// The totp-generator module might be a function itself or have a `default` export.
// This makes it compatible with different module interop settings.
const totp = (totpGenerator as any).default || totpGenerator;

const TwoFactorAuthPage: React.FC = () => {
    const { addNotification } = useNotification();
    const [accounts, setAccounts] = useState<TwoFactorAccount[]>([]);
    const [codes, setCodes] = useState<Record<string, GeneratedCode>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSecret, setNewSecret] = useState('');
    
    // State for immediate code generation
    const [immediateSecret, setImmediateSecret] = useState('');
    const [immediateCode, setImmediateCode] = useState<string | null>(null);
    const [immediateTimeLeft, setImmediateTimeLeft] = useState(30);


    useEffect(() => {
        try {
            const savedAccounts = localStorage.getItem(STORAGE_KEY);
            if (savedAccounts) {
                setAccounts(JSON.parse(savedAccounts));
            }
        } catch (error) {
            console.error('Failed to load 2FA accounts from storage', error);
        }
    }, []);

    const saveAccounts = (updatedAccounts: TwoFactorAccount[]) => {
        setAccounts(updatedAccounts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAccounts));
    };

    const generateCodes = useCallback(() => {
        const newCodes: Record<string, GeneratedCode> = {};
        const epoch = Math.floor(Date.now() / 1000);
        const timeLeft = 30 - (epoch % 30);

        accounts.forEach(account => {
            try {
                const code = totp(account.secret.replace(/\s/g, ''));
                newCodes[account.id] = { code, timeLeft };
            } catch (error) {
                console.error(`Failed to generate code for ${account.name}`, error);
                newCodes[account.id] = { code: 'Error', timeLeft: 0 };
            }
        });
        setCodes(newCodes);
    }, [accounts]);

    useEffect(() => {
        generateCodes(); // Generate once on load
        const intervalId = setInterval(generateCodes, 1000); // Update every second
        return () => clearInterval(intervalId);
    }, [generateCodes]);

    // Effect for immediate code generation
    useEffect(() => {
        const generateImmediateCode = () => {
            if (immediateSecret.trim()) {
                try {
                    const secret = immediateSecret.replace(/\s/g, '');
                    const code = totp(secret);
                    const epoch = Math.floor(Date.now() / 1000);
                    const timeLeft = 30 - (epoch % 30);
                    setImmediateCode(code);
                    setImmediateTimeLeft(timeLeft);
                } catch (error) {
                    setImmediateCode('Invalid Key');
                    setImmediateTimeLeft(0);
                }
            } else {
                setImmediateCode(null);
                setImmediateTimeLeft(30);
            }
        };

        generateImmediateCode(); // Initial generation
        const intervalId = setInterval(generateImmediateCode, 1000);

        return () => clearInterval(intervalId);
    }, [immediateSecret]);

    const handleAddAccount = () => {
        if (!newName.trim() || !newSecret.trim()) {
            addNotification('Name and Secret Key are required.', 'error');
            return;
        }

        const newAccount: TwoFactorAccount = {
            id: Date.now().toString(),
            name: newName.trim(),
            secret: newSecret.trim(),
        };
        saveAccounts([...accounts, newAccount]);
        setNewName('');
        setNewSecret('');
        setIsModalOpen(false);
        addNotification(`Account "${newAccount.name}" added successfully.`, 'success');
    };

    const handleDeleteAccount = (id: string) => {
        if (window.confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
            const updatedAccounts = accounts.filter(acc => acc.id !== id);
            saveAccounts(updatedAccounts);
            addNotification('Account deleted.', 'info');
        }
    };

    const handleCopyCode = (code: string) => {
        if (!code || code === 'Error' || code === 'Invalid Key') return;
        navigator.clipboard.writeText(code.replace(/\s/g, ''));
        addNotification('Code copied to clipboard!', 'success');
    };
    
    const handlePasteKey = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setImmediateSecret(text);
            addNotification('Key pasted from clipboard.', 'success');
        } catch (err) {
            addNotification('Failed to read from clipboard. Please grant permission.', 'error');
            console.error('Failed to read clipboard contents: ', err);
        }
    };

    const handleDownloadKeys = () => {
        if (accounts.length === 0) {
            addNotification('No accounts to download.', 'info');
            return;
        }

        const fileContent = accounts
            .map(acc => `${acc.name}: ${acc.secret}`)
            .join('\n\n');

        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '2fa_backup_keys.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addNotification('Backup file download started.', 'success');
    };


    return (
        <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 flex justify-end items-center">
                <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-primary text-primary-text font-semibold rounded-md hover:bg-primary-hover shadow-md flex items-center gap-2">
                    + Add Account
                </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Instant Code</h3>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={immediateSecret}
                        onChange={e => setImmediateSecret(e.target.value)}
                        placeholder="Paste a secret key for a one-time code"
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={handlePasteKey}
                        className="p-2.5 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        title="Paste from clipboard"
                    >
                        <ClipboardIcon className="w-5 h-5" />
                    </button>
                </div>
                {immediateCode && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                        <p 
                            className={`text-5xl font-mono font-bold tracking-widest cursor-pointer my-4 transition-colors ${immediateCode === 'Invalid Key' ? 'text-red-500 text-2xl' : 'text-primary'}`}
                            onClick={() => handleCopyCode(immediateCode)}
                            title="Click to copy"
                        >
                            {immediateCode !== 'Invalid Key' ? `${immediateCode.slice(0, 3)} ${immediateCode.slice(3, 6)}` : immediateCode}
                        </p>
                        <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                                className="bg-green-500 h-1.5 rounded-full transition-all duration-1000 linear" 
                                style={{ width: `${(immediateTimeLeft / 30) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {accounts.length > 0 ? (
                    accounts.map(account => (
                        <div key={account.id} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center">
                            <p className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-1 truncate w-full" title={account.name}>{account.name}</p>
                            <p 
                                className="text-5xl font-mono font-bold text-primary tracking-widest cursor-pointer my-4"
                                onClick={() => handleCopyCode(codes[account.id]?.code || '')}
                                title="Click to copy"
                            >
                                {codes[account.id]?.code && codes[account.id]?.code !== 'Error' ? `${codes[account.id].code.slice(0, 3)} ${codes[account.id].code.slice(3, 6)}` : <span className="text-red-500 text-lg">Error</span>}
                            </p>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
                                <div 
                                    className="bg-green-500 h-1.5 rounded-full transition-all duration-1000 linear" 
                                    style={{ width: `${codes[account.id]?.timeLeft && codes[account.id]?.code !== 'Error' ? (codes[account.id].timeLeft / 30) * 100 : 0}%` }}
                                ></div>
                            </div>
                             <button onClick={() => handleDeleteAccount(account.id)} className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg shadow-md">
                        <ShieldCheckIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-700 dark:text-gray-200">No Saved 2FA Accounts</h2>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">Click "Add Account" to get started.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h2 className="text-xl font-bold">Add New 2FA Account</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label htmlFor="account-name" className="block text-sm font-medium mb-1">Account/Service Name</label>
                                <input id="account-name" type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Google (me@example.com)" className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                             <div>
                                <label htmlFor="secret-key" className="block text-sm font-medium mb-1">Secret Key</label>
                                <input id="secret-key" type="text" value={newSecret} onChange={e => setNewSecret(e.target.value)} placeholder="Paste your secret key here" className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                        </div>
                         <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700 flex justify-end">
                            <button onClick={handleAddAccount} className="px-6 py-2 bg-primary text-primary-text font-semibold rounded-md hover:bg-primary-hover">
                                Save Account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {accounts.length > 0 && (
                <button
                    onClick={handleDownloadKeys}
                    className="fixed bottom-8 right-8 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    title="Download All Keys as Text File"
                >
                    <DownloadIcon className="w-6 h-6" />
                </button>
            )}
        </div>
    );
};

export default TwoFactorAuthPage;
