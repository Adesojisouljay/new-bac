import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, MessageSquare, Bell, PlusCircle } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useState } from 'react';
import { SearchModal } from '../features/feed/components/SearchModal';

export function BottomNav() {
    const { unreadCount } = useChat();
    const location = useLocation();
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    // Determine active states for parent routes
    const isHomeActive = location.pathname === '/' || location.pathname.startsWith('/posts') || location.pathname.startsWith('/c/');
    const isMessagesActive = location.pathname.startsWith('/messages');
    const isNotificationsActive = location.pathname.startsWith('/notifications');

    const navItemClass = "flex flex-col items-center justify-center w-full h-full text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors relative tap-highlight-transparent";
    const activeIconClass = "text-[var(--primary-color)]";

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 w-full h-[60px] bg-[var(--bg-card)]/95 backdrop-blur-lg border-t border-[var(--border-color)] z-[100] grid grid-cols-5 items-center pb-safe">
                {/* Home */}
                <NavLink to="/" className={navItemClass}>
                    <Home size={24} className={isHomeActive ? activeIconClass : ''} strokeWidth={isHomeActive ? 2.5 : 2} />
                </NavLink>

                {/* Search Modal Trigger */}
                <button onClick={() => setIsSearchModalOpen(true)} className={navItemClass}>
                    <Search size={24} strokeWidth={2} />
                </button>

                {/* Center Post Button */}
                <div className="flex justify-center -mt-6">
                    <NavLink
                        to="/submit"
                        className="bg-[var(--bg-canvas)] rounded-full p-2.5 shadow-lg border border-[var(--border-color)] hover:scale-105 active:scale-95 transition-all"
                        aria-label="Create Post"
                    >
                        <div className="bg-gradient-to-tr from-[var(--primary-color)] to-purple-600 rounded-full p-2.5 text-white shadow-inner">
                            <PlusCircle size={28} className="drop-shadow-sm" strokeWidth={2.5} />
                        </div>
                    </NavLink>
                </div>

                {/* Messages */}
                <NavLink to="/messages" className={navItemClass}>
                    <div className="relative">
                        <MessageSquare size={24} className={isMessagesActive ? activeIconClass : ''} strokeWidth={isMessagesActive ? 2.5 : 2} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] shadow-sm">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </div>
                </NavLink>

                {/* Notifications */}
                <NavLink to="/notifications" className={navItemClass}>
                    <Bell size={24} className={isNotificationsActive ? activeIconClass : ''} strokeWidth={isNotificationsActive ? 2.5 : 2} />
                </NavLink>
            </div>

            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
            />
        </>
    );
}
