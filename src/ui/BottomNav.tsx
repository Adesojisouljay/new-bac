import { NavLink, useLocation } from 'react-router-dom';
import { Home, Play, MessageSquare, Bell, PlusCircle } from 'lucide-react';

import { useChat } from '../contexts/ChatContext';
import { useState, useEffect } from 'react';
import { SearchModal } from '../features/feed/components/SearchModal';

export function BottomNav() {
    const { unreadCount } = useChat();
    const location = useLocation();
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isHidden, setIsHidden] = useState(false);

    // Determine active states for parent routes
    const isHomeActive = location.pathname === '/' || location.pathname.startsWith('/posts') || location.pathname.startsWith('/c/');
    const isMessagesActive = location.pathname.startsWith('/messages');
    const isNotificationsActive = location.pathname.startsWith('/notifications');
    const isShortsActive = location.pathname.startsWith('/shorts');
    const isSinglePost = location.pathname.startsWith('/post/');
    const isSubmitActive = location.pathname.startsWith('/submit');

    // Subscribe to body attribute changes
    useEffect(() => {
        const checkAttribute = () => {
            setIsHidden(document.body.getAttribute('data-hide-nav') === 'true');
        };

        const observer = new MutationObserver(checkAttribute);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-hide-nav'] });

        // Initial check
        checkAttribute();

        return () => observer.disconnect();
    }, []);

    // Hide on shorts/story/post view/submit to avoid overlaying interaction buttons/content
    if (isShortsActive || isSinglePost || isSubmitActive || isHidden) return null;

    const navItemClass = "flex flex-col items-center justify-center w-full h-full text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all relative tap-highlight-transparent";
    const activeIconClass = "text-[var(--primary-color)]";

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 w-full h-[64px] bg-[var(--bg-card)]/80 backdrop-blur-xl border-t border-[var(--border-color)] z-[100] grid grid-cols-5 items-center pb-safe box-content shadow-[0_-8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">

                {/* Home */}
                <NavLink to="/" className={navItemClass}>
                    <div className="flex flex-col items-center gap-0.5 relative">
                        <Home size={22} className={isHomeActive ? activeIconClass : ''} strokeWidth={isHomeActive ? 2.5 : 2} />
                        <span className={`text-[9px] font-bold uppercase tracking-tighter transition-all ${isHomeActive ? 'text-[var(--primary-color)] opacity-100' : 'opacity-60'}`}>Home</span>
                        {isHomeActive && (
                            <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary-color)] shadow-[0_0_8px_var(--primary-color)]" />
                        )}
                    </div>
                </NavLink>


                {/* Shorts */}
                <NavLink to="/shorts" className={navItemClass}>
                    <div className="flex flex-col items-center gap-0.5 relative">
                        <Play size={20} className={isShortsActive ? "fill-[var(--primary-color)] text-[var(--primary-color)]" : "opacity-80"} strokeWidth={2.5} />
                        <span className={`text-[9px] font-bold uppercase tracking-tighter transition-all ${isShortsActive ? 'text-[var(--primary-color)] opacity-100' : 'opacity-60'}`}>Shorts</span>
                        {isShortsActive && (
                            <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary-color)] shadow-[0_0_8px_var(--primary-color)]" />
                        )}
                    </div>
                </NavLink>



                {/* Center Post Button */}
                <div className="flex justify-center -mt-8">
                    <NavLink
                        to="/submit"
                        className="bg-[var(--bg-card)] rounded-full p-2 shadow-xl border border-[var(--border-color)] hover:scale-105 active:scale-90 transition-all"
                        aria-label="Create Post"
                    >
                        <div className="bg-gradient-to-tr from-[var(--primary-color)] to-purple-600 rounded-full p-3 text-white shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)]">
                            <PlusCircle size={28} className="drop-shadow-md" strokeWidth={2.5} />
                        </div>
                    </NavLink>
                </div>


                {/* Messages */}
                <NavLink to="/messages" className={navItemClass}>
                    <div className="flex flex-col items-center gap-0.5 relative">
                        <div className="relative">
                            <MessageSquare size={22} className={isMessagesActive ? activeIconClass : ''} strokeWidth={isMessagesActive ? 2.5 : 2} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] shadow-sm">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-tighter transition-all ${isMessagesActive ? 'text-[var(--primary-color)] opacity-100' : 'opacity-60'}`}>Messages</span>
                        {isMessagesActive && (
                            <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary-color)] shadow-[0_0_8px_var(--primary-color)]" />
                        )}
                    </div>
                </NavLink>


                {/* Notifications */}
                <NavLink to="/notifications" className={navItemClass}>
                    <div className="flex flex-col items-center gap-0.5 relative">
                        <Bell size={22} className={isNotificationsActive ? activeIconClass : ''} strokeWidth={isNotificationsActive ? 2.5 : 2} />
                        <span className={`text-[9px] font-bold uppercase tracking-tighter transition-all ${isNotificationsActive ? 'text-[var(--primary-color)] opacity-100' : 'opacity-60'}`}>Alerts</span>
                        {isNotificationsActive && (
                            <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary-color)] shadow-[0_0_8px_var(--primary-color)]" />
                        )}
                    </div>
                </NavLink>

            </div>

            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
            />
        </>
    );
}
