import { useState, useEffect } from 'react';
import { authService, StoredAccount } from '../services/authService';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (username: string, method: 'keychain' | 'hiveauth', preSigned?: any) => void;
    activeUser: string | null;
    savedAccounts: StoredAccount[];
    onSwitch: (username: string) => void;
    onRemoveAccount: (username: string) => void;
    onOpenOnboarding: () => void;
}

type LoginStep = 'method' | 'keychain' | 'hiveauth' | 'qr' | 'success' | 'one-tap-setup';

export function LoginModal({
    isOpen,
    onClose,
    onLoginSuccess,
    activeUser,
    savedAccounts,
    onSwitch,
    onRemoveAccount,
    onOpenOnboarding
}: LoginModalProps) {
    const [step, setStep] = useState<LoginStep>('method');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [qrCode, setQrCode] = useState('');
    const [pendingUser, setPendingUser] = useState<string | null>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStep('method');
                setUsername('');
                setQrCode('');
                setPendingUser(null);
            }, 300);
        }
    }, [isOpen]);

    const handleKeychainLogin = async () => {
        if (!username) return;
        setLoading(true);
        const res = await authService.login(username);
        if (res.success) {
            onLoginSuccess(username, 'keychain', { sig: res.result, ts: (res as any).ts, message: res.message });
            setStep('success');
            setTimeout(onClose, 1500);
        } else {
            toast.error(res.error || 'Keychain login failed');
        }
        setLoading(false);
    };

    const handleHiveAuthLogin = async () => {
        if (!username) return;
        setLoading(true);
        setStep('qr');

        const res = await authService.loginWithHiveAuth(username, (data) => {
            setQrCode(data.qr);
        });

        if (res.success) {
            const isDelegated = await authService.checkDelegation(username.toLowerCase());

            if (!isDelegated) {
                setPendingUser(username);
                setStep('one-tap-setup');
            } else {
                onLoginSuccess(username, 'hiveauth', { sig: res.result, ts: (res as any).ts, message: res.challenge });
                setStep('success');
                setTimeout(onClose, 1500);
            }
        } else {
            toast.error(res.error || 'HiveAuth failed');
            setStep('hiveauth');
        }
        setLoading(false);
    };

    const handleAuthorizeOneTap = async () => {
        if (!pendingUser) return;
        setLoading(true);

        const res = await authService.authorizeRelay(pendingUser, 'hiveauth', (data) => {
            setQrCode(data.qr);
            setStep('qr');
        });

        if (res.success) {
            toast.success('One-Tap Posting enabled!');
            onLoginSuccess(pendingUser, 'hiveauth');
            setStep('success');
            setTimeout(onClose, 1500);
        } else {
            toast.error(res.error || 'Authorization failed');
            onLoginSuccess(pendingUser, 'hiveauth');
            onClose();
        }
        setLoading(false);
    };

    const renderStep = () => {
        switch (step) {
            case 'method':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">Choose your preferred login method</p>
                        </div>

                        {activeUser && (
                            <div className="p-4 bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={`https://images.hive.blog/u/${activeUser}/avatar`} className="w-10 h-10 rounded-full border-2 border-[var(--primary-color)]" alt="" />
                                    <div>
                                        <p className="text-xs font-bold text-[var(--primary-color)] uppercase tracking-widest">Active Session</p>
                                        <p className="font-bold text-[var(--text-primary)]">@{activeUser}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:brightness-110">Continue</button>
                            </div>
                        )}

                        <div className="grid gap-4">
                            <button
                                onClick={() => setStep('keychain')}
                                className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--primary-color)] transition-all flex items-center gap-4 text-left group"
                            >
                                <div className="w-12 h-12 bg-[#ff1212]/10 rounded-xl flex items-center justify-center group-hover:bg-[#ff1212]/20 transition-colors">
                                    <img src="https://hive-keychain.com/img/logo.png" className="w-8 h-8 object-contain" alt="Keychain" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-[var(--text-primary)]">Hive Keychain</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">Browser extension & Mobile App</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setStep('hiveauth')}
                                className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--primary-color)] transition-all flex items-center gap-4 text-left group"
                            >
                                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                    <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-[var(--text-primary)]">HiveAuth (HAS)</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">Login with any mobile wallet</p>
                                </div>
                            </button>
                        </div>

                        {savedAccounts.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">Switch Account</p>
                                <div className="grid gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                    {savedAccounts.filter(a => a.username !== activeUser).map(acc => (
                                        <div key={acc.username} className="p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex items-center justify-between group">
                                            <button onClick={() => { onSwitch(acc.username); onClose(); }} className="flex items-center gap-3 flex-grow">
                                                <img src={`https://images.hive.blog/u/${acc.username}/avatar`} className="w-8 h-8 rounded-full" alt="" />
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors">@{acc.username}</p>
                                                    <p className="text-[10px] text-[var(--text-secondary)] uppercase">{acc.method}</p>
                                                </div>
                                            </button>
                                            <button onClick={() => onRemoveAccount(acc.username)} className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-[var(--border-color)] text-center">
                            <p className="text-sm text-[var(--text-secondary)]">
                                New to Hive?{' '}
                                <button onClick={onOpenOnboarding} className="text-[var(--primary-color)] font-bold hover:underline">Create Account</button>
                            </p>
                        </div>
                    </div>
                );
            case 'keychain':
            case 'hiveauth':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] uppercase tracking-tight">{step === 'keychain' ? 'Keychain' : 'HiveAuth'} Login</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">Enter your Hive username to continue</p>
                        </div>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-bold">@</span>
                            <input
                                autoFocus
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                onKeyDown={(e) => e.key === 'Enter' && (step === 'keychain' ? handleKeychainLogin() : handleHiveAuthLogin())}
                                placeholder="username"
                                className="w-full pl-9 pr-4 py-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] outline-none transition-all font-medium text-lg"
                            />
                        </div>
                        <button
                            disabled={!username || loading}
                            onClick={step === 'keychain' ? handleKeychainLogin : handleHiveAuthLogin}
                            className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary-color)]/20 flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {step === 'keychain' ? 'Connect Keychain' : 'Authorize with HAS'}
                        </button>
                        <button onClick={() => setStep('method')} className="w-full text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">← Back to methods</button>
                    </div>
                );
            case 'qr':
                return (
                    <div className="space-y-6 pb-2 text-center animate-in fade-in zoom-in duration-300">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Sign Request</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">Approve this request in your wallet app</p>
                        </div>

                        <div className="mx-auto p-6 bg-white rounded-3xl w-fit shadow-xl shadow-black/5">
                            {qrCode ? (
                                <QRCodeSVG value={qrCode} size={200} />
                            ) : (
                                <div className="w-[200px] h-[200px] flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.href = qrCode}
                                className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:brightness-110 md:hidden shadow-lg shadow-[var(--primary-color)]/20"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Open in Wallet App
                            </button>
                            <p className="text-xs font-medium text-[var(--text-secondary)] px-4">
                                Waiting for @<span className="text-[var(--text-primary)] font-bold">{username}</span> to sign...
                            </p>
                            <button onClick={() => setStep('hiveauth')} className="text-sm font-bold text-red-400 hover:text-red-500 transition-colors">Cancel Request</button>
                        </div>
                    </div>
                );
            case 'one-tap-setup':
                return (
                    <div className="space-y-8 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-[var(--text-primary)]">Enable One-Tap Posting</h2>
                            <p className="text-[var(--text-secondary)] mt-3 leading-relaxed px-4">
                                Tired of opening Keychain for every upvote? Authorize our platform to broadcast posting actions on your behalf.
                            </p>
                        </div>

                        <ul className="space-y-3 px-2">
                            {[
                                { icon: '⚡', label: 'Instant upvotes & comments' },
                                { icon: '🔒', label: 'Platform NEVER sees your keys' },
                                { icon: '📱', label: 'Perfect mobile experience' }
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
                                    <span className="text-xl">{item.icon}</span>
                                    <span className="text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col gap-3">
                            <button
                                disabled={loading}
                                onClick={handleAuthorizeOneTap}
                                className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-[var(--primary-color)]/30 flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Enable & Start Posting
                            </button>
                            <button
                                onClick={() => {
                                    if (pendingUser) onLoginSuccess(pendingUser, 'hiveauth');
                                    onClose();
                                }}
                                className="w-full py-4 text-[var(--text-secondary)] font-bold text-sm hover:text-[var(--text-primary)] transition-colors"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                );
            case 'success':
                return (
                    <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-[var(--text-primary)]">Connected!</h3>
                            <p className="text-[var(--text-secondary)] mt-1 font-medium">Redirecting you to the Hive...</p>
                        </div>
                    </div>
                );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-[2.5rem] shadow-2xl overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {step !== 'success' && step !== 'qr' && (
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-full transition-all z-10">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
                <div className="p-10">
                    {renderStep()}
                </div>
            </div>
        </div>
    );
}
