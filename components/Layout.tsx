import React, { useState, useEffect, ReactNode, useRef, useLayoutEffect, useCallback } from 'react';
// Using named import for NavLink from react-router-dom to resolve module export error.
import { NavLink } from 'react-router-dom';
import { FeedIcon, DocumentTextIcon, CollageIcon, UploadIcon, ClipboardListIcon, CrossPostIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, UserGroupIcon, LanguageIcon, InformationCircleIcon, LockClosedIcon, ChatBubbleBottomCenterTextIcon, CurrencyDollarIcon, ArrowLeftOnRectangleIcon, MenuIcon, Cog6ToothIcon, BellIcon, ChevronDownIcon, CheckCircleIcon, FrameIcon } from './IconComponents.tsx';
import { useSidebar, usePageActions } from '../src/contexts/SidebarContext.tsx';
import { useAuth } from '../src/contexts/AuthContext.tsx';
import NotificationSystem from './NotificationSystem.tsx';
import SettingsModal from './SettingsModal.tsx';
import { useFacebookPage } from '../src/contexts/FacebookPageContext.tsx';
import { FBPage } from '../types.ts';
import Spinner from './Spinner.tsx';
import { useTheme } from '../src/contexts/ThemeContext.tsx';


// --- Page Selector Component ---
const PageSelector: React.FC = () => {
    const { isAuthenticated, pages, activePage, selectPage, isLoading } = useFacebookPage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const getPagePictureUrl = (page: FBPage) => {
        // The access token is appended to handle pages with restricted profile pictures
        return `https://graph.facebook.com/${page.id}/picture?type=square&access_token=${page.access_token}`;
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isAuthenticated || pages.length === 0) {
        return null; // Don't render if not logged into Facebook
    }

    if (isLoading || !activePage) {
        return <div className="p-2 mx-2"><Spinner size="sm" /></div>;
    }

    return (
        <div ref={dropdownRef} className="relative mx-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 bg-gray-100 dark:bg-gray-800/80 rounded-full shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <img src={getPagePictureUrl(activePage)} alt={activePage.name} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-600" />
                <span className="font-semibold text-sm hidden sm:inline">{activePage.name}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border dark:border-gray-700 z-50 overflow-hidden animate-[unfurl_0.2s_ease-out]">
                    <ul className="max-h-80 overflow-y-auto scrollbar-thin">
                        {pages.map(page => (
                            <li key={page.id}>
                                <button
                                    onClick={() => {
                                        selectPage(page.id);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <img src={getPagePictureUrl(page)} alt={page.name} className="w-8 h-8 rounded-full" />
                                    <span className="flex-grow font-medium text-sm text-gray-800 dark:text-gray-200">{page.name}</span>
                                    {activePage.id === page.id && <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};


interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout } = useAuth();
  const { sidebarControls, isSidebarOpen, toggleSidebar } = useSidebar();
  const { headerActions } = usePageActions();
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Refs to manage sidebar scroll position
  const sidebarScrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollPositionRef = useRef<number>(0);

  // Handler to save the scroll position to a ref whenever the user scrolls
  const handleScroll = useCallback(() => {
    if (sidebarScrollContainerRef.current) {
      lastScrollPositionRef.current = sidebarScrollContainerRef.current.scrollTop;
    }
  }, []);

  // Effect to restore the scroll position after the sidebar content has been re-rendered
  useLayoutEffect(() => {
    if (sidebarScrollContainerRef.current) {
      sidebarScrollContainerRef.current.scrollTop = lastScrollPositionRef.current;
    }
  }, [sidebarControls]); // This dependency is crucial: the effect runs when the sidebar content is replaced

  const navLinkClasses = ({ isActive }: { isActive: boolean }): string => {
    const baseClasses = 'flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200';
    const activeClass = 'bg-primary/10 text-primary dark:bg-primary/20';
    const inactiveClass = 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10';
    return `${baseClasses} ${isActive ? activeClass : inactiveClass}`;
  };
  
  return (
    <>
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-black/70 dark:backdrop-blur-lg dark:border-r dark:border-white/20 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className={`flex-shrink-0 flex items-center justify-center p-4 border-b border-gray-200 dark:border-white/10`}>
                <h1 className="text-3xl font-bold text-[var(--app-primary-color)] dark:text-[var(--app-primary-color)] text-center font-inter tracking-tight">
                    Hanjla Harry
                </h1>
            </div>

            <div 
                className="flex-grow overflow-y-auto scrollbar-thin p-2"
                ref={sidebarScrollContainerRef}
                onScroll={handleScroll}
            >
                <nav className="border-b border-gray-200 dark:border-white/10 pb-2 mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Apps</p>
                    <ul className="grid grid-cols-3 gap-2">
                        <li><NavLink to="/feed" className={navLinkClasses} title="Feed"><FeedIcon className="w-6 h-6" /><span className="text-xs mt-1">Feed</span></NavLink></li>
                        <li><NavLink to="/dashboard" className={navLinkClasses} title="Content Generator"><DocumentTextIcon className="w-6 h-6" /><span className="text-xs mt-1">Generator</span></NavLink></li>
                        <li><NavLink to="/collage-maker" className={navLinkClasses} title="Collage Maker"><CollageIcon className="w-6 h-6" /><span className="text-xs mt-1">Collage</span></NavLink></li>
                        <li><NavLink to="/frame-maker" className={navLinkClasses} title="Frame Maker"><FrameIcon className="w-6 h-6" /><span className="text-xs mt-1">Frames</span></NavLink></li>
                        <li><NavLink to="/cross-post" className={navLinkClasses} title="Cross Post"><CrossPostIcon className="w-6 h-6" /><span className="text-xs mt-1">Cross-Post</span></NavLink></li>
                        <li><NavLink to="/uploader" className={navLinkClasses} title="Scheduler"><UploadIcon className="w-6 h-6" /><span className="text-xs mt-1">Scheduler</span></NavLink></li>
                        <li><NavLink to="/manage-posts" className={navLinkClasses} title="Manage Posts"><ClipboardListIcon className="w-6 h-6" /><span className="text-xs mt-1">Posts</span></NavLink></li>
                        <li><NavLink to="/messages" className={navLinkClasses} title="Messages"><ChatBubbleLeftRightIcon className="w-6 h-6" /><span className="text-xs mt-1">Messages</span></NavLink></li>
                        <li><NavLink to="/community-chat" className={navLinkClasses} title="Community Chat"><ChatBubbleBottomCenterTextIcon className="w-6 h-6" /><span className="text-xs mt-1">Community</span></NavLink></li>
                        <li><NavLink to="/audience-insights" className={navLinkClasses} title="Audience Insights"><UserGroupIcon className="w-6 h-6" /><span className="text-xs mt-1">Audience</span></NavLink></li>
                        <li><NavLink to="/script-maker" className={navLinkClasses} title="Script Maker"><LanguageIcon className="w-6 h-6" /><span className="text-xs mt-1">Scripts</span></NavLink></li>
                    </ul>
                </nav>
                <div className="border-b border-gray-200 dark:border-white/10 pb-2 mb-2">
                     <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Account</p>
                    <ul className="grid grid-cols-3 gap-2">
                        <li><NavLink to="/2fa" className={navLinkClasses} title="2FA Codes"><ShieldCheckIcon className="w-6 h-6" /><span className="text-xs mt-1">2FA</span></NavLink></li>
                        <li><NavLink to="/pricing" className={navLinkClasses} title="Pricing & Plans"><CurrencyDollarIcon className="w-6 h-6" /><span className="text-xs mt-1">Pricing</span></NavLink></li>
                        <li><NavLink to="/about" className={navLinkClasses} title="About & Contact"><InformationCircleIcon className="w-6 h-6" /><span className="text-xs mt-1">About</span></NavLink></li>
                        <li><NavLink to="/privacy-policy" className={navLinkClasses} title="Privacy Policy"><LockClosedIcon className="w-6 h-6" /><span className="text-xs mt-1">Privacy</span></NavLink></li>
                    </ul>
                </div>

                <div className="p-2">
                    {sidebarControls}
                </div>
            </div>
            
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <button onClick={logout} className="w-full flex items-center justify-center gap-3 p-3 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors" title="Logout">
                        <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                        <span className="font-semibold">Logout</span>
                    </button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="flex-shrink-0 p-3 rounded-lg text-gray-500 dark:text-gray-400 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" title="Settings">
                        <Cog6ToothIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </aside>

        {isSidebarOpen && <div onClick={toggleSidebar} className="fixed inset-0 z-30 bg-black/50 lg:hidden"></div>}

        <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:ml-72' : ''}`}>
            <div className="flex flex-col" style={{ height: '100vh' }}>
                <header className="flex-shrink-0 z-30 flex items-center h-16 px-4 bg-white/80 dark:bg-black/70 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-white/10">
                    <button onClick={toggleSidebar} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/10">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    
                    <div className="ml-2">
                        {headerActions}
                    </div>

                    <div className="flex-grow"></div>
                    
                    <PageSelector />
                    
                    <NotificationSystem />
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    <div className="p-2 md:p-4 lg:p-6">{children}</div>
                </main>
            </div>
        </div>
      </div>
    </>
  );
};

export default Layout;