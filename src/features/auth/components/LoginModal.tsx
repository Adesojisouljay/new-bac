import { useState, useEffect } from 'react';
import { authService, StoredAccount } from '../services/authService';
import { QRCodeSVG } from 'qrcode.react';
import hiveauthLogo from '../../../assets/hiveauth-logo.svg';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (username: string, method: 'keychain' | 'hiveauth', preSigned?: any) => void;
    /** Currently active user (to exclude from "switch to" list) */
    activeUser?: string | null;
    /** All signed-in accounts */
    savedAccounts?: StoredAccount[];
    /** Called when user picks a saved account to switch to */
    onSwitch?: (username: string) => void;
    /** Called when user removes a saved account */
    onRemoveAccount?: (username: string) => void;
    /** Called to open native onboarding flow */
    onOpenOnboarding?: () => void;
}

type LoginMethod = 'keychain' | 'hiveauth';

export function LoginModal({
    isOpen,
    onClose,
    onLoginSuccess,
    activeUser,
    savedAccounts = [],
    onSwitch,
    onRemoveAccount,
    onOpenOnboarding
}: LoginModalProps) {
    const [isMobile, setIsMobile] = useState(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 1024);
    const isInAppBrowser = !!(window as any).hive_keychain;

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 1024);
        };
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [username, setUsername] = useState('');
    const [method, setMethod] = useState<LoginMethod>(() => {
        // Intelligent defaults for mobile vs desktop
        if (isInAppBrowser) return 'keychain';
        if (isMobile) return 'hiveauth';
        return (localStorage.getItem('hive_auth_method') as LoginMethod) || 'keychain';
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasQR, setHasQR] = useState<string | null>(null);


    // Show ALL logged-in accounts; active one gets a badge instead of a Switch button
    const allSavedAccounts = savedAccounts;

    useEffect(() => {
        if (!isOpen) {
            setHasQR(null);
            setError(null);
            setLoading(false);
            setUsername('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        const cleanUsername = username.trim().toLowerCase();
        setLoading(true);
        setError(null);

        if (method === 'keychain') {
            try {
                const result = await authService.login(cleanUsername);

                if (result.success) {
                    localStorage.setItem('hive_auth_method', 'keychain');
                    onLoginSuccess(cleanUsername, 'keychain', {
                        sig: result.result, // Keychain SDK returns sig in .result
                        message: result.message
                    });
                    onClose();
                } else {
                    setError(result.error || 'Login failed');
                }
            } catch (err: any) {
                setError(err.message || 'An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        } else {
            try {
                const result = await authService.loginWithHiveAuth(
                    cleanUsername,
                    ({ qr }) => {
                        setHasQR(qr);
                        // Auto-redirect to deeplink on mobile - do it IMMEDIATELY
                        if (isMobile) {
                            // Try multiple ways to trigger redirect
                            window.location.href = qr;
                            // Fallback for some browsers
                            setTimeout(() => {
                                if (document.hasFocus()) {
                                    window.open(qr, '_self');
                                }
                            }, 500);
                        }
                        setLoading(false);
                    }
                );

                if (result.success) {
                    const sessionData = {
                        username: cleanUsername,
                        token: result.result.token,
                        expire: result.result.expire,
                        key: result.session.key
                    };
                    localStorage.setItem('hive_auth_session', JSON.stringify(sessionData));
                    localStorage.setItem('hive_auth_method', 'hiveauth');

                    onLoginSuccess(cleanUsername, 'hiveauth', {
                        sig: result.result.challenge.sig,
                        message: result.challenge
                    });
                    onClose();
                } else {
                    setError(result.error || 'HiveAuth failed');
                    setHasQR(null);
                }
            } catch (err: any) {
                setError(err.message || 'HiveAuth error');
                setHasQR(null);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-4xl max-h-[90vh] bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col md:flex-row min-h-[500px] overflow-hidden">
                    {/* ── Left Side: Saved Accounts ── */}
                    {allSavedAccounts.length > 0 && (
                        <div className="w-full md:w-2/5 p-8 bg-[var(--bg-card)]/30 border-b md:border-b-0 md:border-r border-[var(--border-color)] flex flex-col min-h-0">
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Accounts</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Switch between your profiles</p>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {allSavedAccounts.map((acc: StoredAccount) => {
                                    const isActive = acc.username === activeUser;
                                    return (
                                        <div
                                            key={acc.username}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all group ${isActive ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 shadow-sm' : 'border-[var(--border-color)] hover:border-[var(--primary-color)]/50 hover:bg-[var(--primary-color)]/5'}`}
                                        >
                                            <img
                                                src={`https://images.hive.blog/u/${acc.username}/avatar/small`}
                                                alt={acc.username}
                                                className="h-10 w-10 rounded-full border border-[var(--border-color)] flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[var(--text-primary)] truncate">@{acc.username}</p>
                                                <p className="text-[10px] text-[var(--text-secondary)] capitalize opacity-70">{acc.method}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isActive ? (
                                                    <span className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green-500 bg-green-500/10 rounded-lg border border-green-500/20">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            onSwitch?.(acc.username);
                                                            onClose();
                                                        }}
                                                        className="px-3 py-1.5 text-[11px] font-bold bg-[var(--primary-color)] text-white rounded-xl hover:brightness-110 transition-all shadow-sm active:scale-95"
                                                    >
                                                        Switch
                                                    </button>
                                                )}
                                                {!isActive && (
                                                    <button
                                                        onClick={() => onRemoveAccount?.(acc.username)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                                                        title="Remove account"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Right Side: Login Form ── */}
                    <div className={`flex-1 p-8 flex flex-col ${allSavedAccounts.length === 0 ? 'mx-auto max-w-sm w-full' : ''}`}>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                                    Login
                                </h2>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Securely connect to your Hive account
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-[var(--bg-card)] rounded-full transition-colors border border-[var(--border-color)]/50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
                            <div className="flex flex-col justify-center min-h-full max-w-sm mx-auto w-full py-4">
                                {!hasQR ? (
                                    <form onSubmit={handleSubmit} className="space-y-6 w-full animate-in fade-in duration-300">
                                        {/* Method Switcher */}
                                        <div className="flex p-1.5 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setMethod('keychain')}
                                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${method === 'keychain' ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                            >
                                                Keychain
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMethod('hiveauth')}
                                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${method === 'hiveauth' ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                            >
                                                HiveAuth
                                            </button>
                                        </div>

                                        {isInAppBrowser && method === 'hiveauth' && (
                                            <div className="px-4 py-3 bg-[var(--primary-color)]/5 border border-[var(--primary-color)]/20 rounded-2xl text-[var(--primary-color)] text-xs font-semibold text-center animate-in fade-in slide-in-from-top-1">
                                                You're in the Keychain Browser!
                                                <button
                                                    type="button"
                                                    onClick={() => setMethod('keychain')}
                                                    className="ml-2 underline font-bold"
                                                >
                                                    Use Keychain method
                                                </button> for a faster login.
                                            </div>
                                        )}

                                        <div>
                                            <label htmlFor="username" className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2.5 ml-1 opacity-70">
                                                Hive Username
                                            </label>
                                            <div className="relative group">
                                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[var(--text-secondary)] group-focus-within:text-[var(--primary-color)] transition-colors font-semibold">@</span>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    id="username"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value)}
                                                    placeholder="username"
                                                    className="w-full pl-12 pr-5 py-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none text-xl shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="px-4 py-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-2xl animate-in slide-in-from-top-2 flex gap-3 items-center">
                                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {error}
                                            </div>
                                        )}

                                        {isMobile && !isInAppBrowser && method === 'keychain' && (
                                            <div className="px-4 py-3 bg-[var(--primary-color)]/5 border border-[var(--primary-color)]/20 rounded-2xl text-center">
                                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                                    Using a mobile browser?
                                                </p>
                                                <a
                                                    href={`keychain://browse/${window.location.hostname}${window.location.pathname}`}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-[var(--primary-color)] text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 100 100" fill="none">
                                                        <path d="M18 22 C10 12 4 26 10 36 C14 44 26 44 36 36 C28 28 22 22 18 22 Z" fill="#E31337" />
                                                        <path d="M34 38 C24 48 14 58 14 68 C14 76 22 80 30 72 C38 64 40 50 38 40 Z" fill="#E31337" />
                                                    </svg>
                                                    Open in Keychain Browser
                                                </a>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading || !username.trim()}
                                            className="w-full py-5 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[var(--primary-color)]/25 flex items-center justify-center gap-4 text-lg"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                <>
                                                    {method === 'keychain' ? (
                                                        <>
                                                            {/* Hive Keychain logo: key with red wing */}
                                                            <svg className="w-7 h-7" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                {/* Red wing */}
                                                                <path d="M18 22 C10 12 4 26 10 36 C14 44 26 44 36 36 C28 28 22 22 18 22 Z" fill="#E31337" />
                                                                <path d="M34 38 C24 48 14 58 14 68 C14 76 22 80 30 72 C38 64 40 50 38 40 Z" fill="#E31337" />
                                                                {/* Key ring / circle head */}
                                                                <circle cx="60" cy="34" r="20" stroke="white" strokeWidth="10" fill="none" />
                                                                {/* Key shaft */}
                                                                <line x1="74" y1="48" x2="88" y2="82" stroke="white" strokeWidth="9" strokeLinecap="round" />
                                                                {/* Key teeth */}
                                                                <line x1="80" y1="64" x2="88" y2="60" stroke="white" strokeWidth="7" strokeLinecap="round" />
                                                                <line x1="84" y1="74" x2="92" y2="70" stroke="white" strokeWidth="7" strokeLinecap="round" />
                                                            </svg>
                                                            <span>Continue with Keychain</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <img src={hiveauthLogo} alt="HiveAuth" className="w-7 h-7 object-contain brightness-0 invert" />
                                                            <span>{isMobile ? "Login with Keychain App" : "Generate QR Code"}</span>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    </form>
                                ) : (
                                    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300 w-full">
                                        <div className="p-6 bg-white rounded-3xl inline-block shadow-2xl mx-auto border-8 border-gray-50/50">
                                            <QRCodeSVG value={hasQR} size={180} level="H" />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                                                    {isMobile ? "Authorize in Keychain" : "Scan with Wallet"}
                                                </h3>
                                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[240px] mx-auto opacity-80">
                                                    {isMobile ? "Approve the request in your Keychain app." : "Open Keychain or any HAS compatible wallet to approve."}
                                                </p>
                                            </div>

                                            {isMobile && (
                                                <div className="animate-in slide-in-from-bottom-2 duration-300">
                                                    <a
                                                        href={hasQR}
                                                        className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary-color)] text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all text-sm"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 100 100" fill="none">
                                                            <path d="M18 22 C10 12 4 26 10 36 C14 44 26 44 36 36 C28 28 22 22 18 22 Z" fill="white" />
                                                            <path d="M34 38 C24 48 14 58 14 68 C14 76 22 80 30 72 C38 64 40 50 38 40 Z" fill="white" />
                                                        </svg>
                                                        Open Keychain App
                                                    </a>
                                                    <p className="text-[10px] text-[var(--text-secondary)] mt-2 opacity-60">
                                                        Didn't open automatically? Click the button above.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => setHasQR(null)}
                                            className="px-6 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-[var(--primary-color)] text-sm font-bold hover:bg-[var(--primary-color)] hover:text-white transition-all active:scale-95"
                                        >
                                            Try another method
                                        </button>

                                        <div className="flex items-center justify-center gap-3 pt-2">
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary-color)] opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--primary-color)]"></span>
                                            </span>
                                            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-70">Awaiting Approval</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-[var(--border-color)]/30">
                                <p className="text-xs text-center text-[var(--text-secondary)] opacity-80 mb-4">
                                    Don't have an account?
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={onOpenOnboarding}
                                        className="w-full py-3 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--primary-color)] font-bold rounded-2xl hover:bg-[var(--primary-color)]/5 transition-all text-sm flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Create Account Natively
                                    </button>
                                    <button
                                        onClick={() => {
                                            onOpenOnboarding?.();
                                            // Small delay to allow state inside OnboardingFlow to initialize if needed, 
                                            // though opening it with a flag is cleaner. 
                                            // For now, it will open the default step which has the "Already paid? Check status" link.
                                        }}
                                        className="w-full py-1 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all text-[11px] font-bold text-center uppercase tracking-wider"
                                    >
                                        Check registration status
                                    </button>
                                    <a
                                        href="https://signup.hive.io"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-medium text-center opacity-60"
                                    >
                                        Other Signup Methods
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
