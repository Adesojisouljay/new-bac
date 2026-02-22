import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface UserDropdownProps {
    username: string;
    onLogout: () => void;
    onAddAccount: () => void;
    onOnboard: () => void;
}

export function UserDropdown({ username, onLogout, onAddAccount, onOnboard }: UserDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const close = () => setIsOpen(false);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 rounded-lg transition-colors"
            >
                <img
                    src={`https://images.hive.blog/u/${username}/avatar/small`}
                    alt={username}
                    className="h-8 w-8 rounded-full bg-gray-200 border border-[var(--border-color)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)] hidden md:block">{username}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border-color)] py-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">

                    {/* Active user header */}
                    <div className="px-4 py-3 border-b border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-secondary)]">Signed in as</p>
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">@{username}</p>
                    </div>

                    {/* Navigation Links */}
                    <div className="py-1">
                        <Link to={`/@${username}`} className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={close}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Profile
                        </Link>
                        <Link to={`/@${username}/wallet`} className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={close}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                            Wallet
                        </Link>
                        <Link to={`/@${username}/settings`} className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={close}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Settings
                        </Link>
                        <Link to="/governance/witness" className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={close}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            Governance
                        </Link>
                        <Link to="/analytics" className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={close}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            Analytics
                        </Link>
                        <Link to="/messages" className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={close}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Messages
                        </Link>
                    </div>

                    {/* Account Actions */}
                    <div className="border-t border-[var(--border-color)] mt-1 pt-1">
                        {/* Login as / Switch account */}
                        <button
                            onClick={() => { close(); onAddAccount(); }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                            Login as...
                        </button>

                        {/* Onboard New User */}
                        <button
                            onClick={() => { close(); onOnboard(); }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors text-left font-bold"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Onboard New User
                        </button>

                        {/* Sign out */}
                        <button
                            onClick={() => { close(); onLogout(); }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
