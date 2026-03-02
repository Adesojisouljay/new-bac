import { Link } from 'react-router-dom';
import { useCommunity } from '../features/community/context/CommunityContext';
import { ThemeToggle } from './ThemeToggle';
import { UserDropdown } from './UserDropdown';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { LoginModal } from '../features/auth/components/LoginModal';
import { NotificationDropdown } from '../features/notifications/components/NotificationDropdown';
import { authService, accountManager, StoredAccount } from '../features/auth/services/authService';
import { pointsService } from '../services/pointsService';
import { OnboardingFlow } from '../features/auth/components/OnboardingFlow';
import { useChat } from '../contexts/ChatContext';
import { Search, Hexagon } from 'lucide-react';
import { SearchModal } from '../features/feed/components/SearchModal';
import { useConfig } from '../contexts/ConfigContext';

export function Navbar() {
    const { config } = useCommunity();
    const { config: dynamicConfig } = useConfig();
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [user, setUser] = useState<string | null>(accountManager.getActive());
    const [accounts, setAccounts] = useState<StoredAccount[]>(accountManager.getAll());
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [pointsQR, setPointsQR] = useState<string | null>(null);
    const { unreadCount } = useChat();

    const refreshAccounts = () => {
        setAccounts(accountManager.getAll());
        setUser(accountManager.getActive());
    };

    const handleLoginSuccess = async (username: string, method: 'keychain' | 'hiveauth', preSigned?: any) => {
        accountManager.add(username, method);
        refreshAccounts();
        setIsLoginModalOpen(false);
        setPointsQR(null);

        // 1. First, check if user is already delegated (Posting Authority)
        await authService.checkDelegation(username.toLowerCase());

        // 2. Silent login to Points backend using the Login signature we just got!
        const community = config?.id || 'hive-106130';
        const pointsSuccess = await pointsService.loginToPointsBackend(
            username,
            community,
            method,
            preSigned,
            (data: { qr: string; uuid: string }) => {
                // If silent auth fails and needs a prompt/QR (mostly for HAS Desktop)
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    window.location.href = data.qr;
                } else {
                    setPointsQR(data.qr);
                }
            }
        );

        if (pointsSuccess) {
            toast.success('Login Successful!');
        }
    };

    useEffect(() => {
        pointsService.resumePendingAuth((data: { qr: string; uuid: string }) => {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile && data.qr) {
                window.location.href = data.qr;
            } else if (data.qr) {
                setPointsQR(data.qr);
            }
        }).catch(console.error);
    }, []);

    const handleSwitch = (username: string) => {
        accountManager.setActive(username);
        refreshAccounts();
    };

    const handleRemoveAccount = (username: string) => {
        accountManager.remove(username);
        refreshAccounts();
    };

    const handleLogout = () => {
        accountManager.logout();
        refreshAccounts();
    };

    return (
        <>
            <header className="fixed top-0 w-full border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/80 backdrop-blur-md z-50 transition-colors duration-300">
                <div className="w-full max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between gap-8">
                    {/* Logo Section */}
                    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
                        {dynamicConfig?.hiveCommunityId === 'global' ? (
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--primary-color)] to-purple-600 flex items-center justify-center shadow-lg shadow-[var(--primary-color)]/20">
                                    <Hexagon size={20} className="text-white fill-white/20" />
                                </div>
                                <span className="font-bold text-xl text-[var(--text-primary)] hidden sm:block">Breakaway</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <img src={(!config?.logo || config.logo.includes('vite.svg')) ? `https://images.hive.blog/u/${config?.id}/avatar` : config.logo} alt={config?.name || 'Community'} className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] object-cover border border-[var(--border-color)]" />
                                <span className="font-bold text-xl text-[var(--text-primary)] hidden sm:block">{config?.name || 'Loading...'}</span>
                            </div>
                        )}
                    </Link>

                    {/* Central Search Bar */}
                    <div className="flex-grow max-w-md hidden md:block">
                        <button
                            onClick={() => setIsSearchModalOpen(true)}
                            className="w-full h-10 px-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex items-center gap-3 text-[var(--text-secondary)] hover:border-[var(--primary-color)]/50 transition-all group"
                        >
                            <Search size={18} className="group-hover:text-[var(--primary-color)] transition-colors" />
                            <span className="text-sm font-medium">Search the Hive...</span>
                        </button>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Mobile Search Icon (Hidden since it's on BottomNav) */}
                        <button
                            onClick={() => setIsSearchModalOpen(true)}
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors hidden"
                        >
                            <Search size={22} />
                        </button>

                        <ThemeToggle />

                        {user ? (
                            <div className="flex items-center gap-3">
                                {/* Desktop Only Controls */}
                                <div className="hidden md:flex items-center gap-3">
                                    <Link
                                        to="/submit"
                                        className="px-4 py-2 text-sm font-bold bg-[var(--primary-color)] text-white rounded-lg hover:brightness-110 transition-all shadow-sm hidden lg:block uppercase tracking-widest"
                                    >
                                        Post
                                    </Link>
                                    <NotificationDropdown username={user} />
                                    <Link to="/messages" className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors relative" title="Messages">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-canvas)] shadow-sm animate-in zoom-in duration-200">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                    <Link to={`/${user}/wallet`} className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors relative" title="Wallet">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                    </Link>
                                </div>
                                <UserDropdown
                                    username={user}
                                    onLogout={handleLogout}
                                    onAddAccount={() => setIsLoginModalOpen(true)}
                                    onOnboard={() => setIsOnboardingOpen(true)}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsLoginModalOpen(true)}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => setIsLoginModalOpen(true)}
                                    className="px-4 py-2 text-sm font-medium bg-[var(--primary-color)] text-white rounded-lg hover:brightness-110 transition-all shadow-sm"
                                >
                                    Sign Up
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
            />

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLoginSuccess={handleLoginSuccess}
                activeUser={user}
                savedAccounts={accounts}
                onSwitch={handleSwitch}
                onRemoveAccount={handleRemoveAccount}
                onOpenOnboarding={() => {
                    setIsLoginModalOpen(false);
                    setIsOnboardingOpen(true);
                }}
            />

            <OnboardingFlow
                isOpen={isOnboardingOpen}
                onClose={() => setIsOnboardingOpen(false)}
                creator={user || undefined}
            />
            {/* Points Auth QR Modal (Desktop Fallback) */}
            {pointsQR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--bg-card)] rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-[var(--border-color)] text-center animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-2">Authorize Points</h3>
                        <p className="text-[var(--text-secondary)] text-sm mb-6">
                            Please scan this QR code with your Hive wallet to enable One-Tap actions and points.
                        </p>

                        <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner">
                            <QRCodeSVG value={pointsQR} size={200} />
                        </div>

                        <button
                            onClick={() => setPointsQR(null)}
                            className="w-full py-3 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--border-color)] font-semibold transition-colors border border-[var(--border-color)]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
