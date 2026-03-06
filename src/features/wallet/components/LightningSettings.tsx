import { useState, useEffect } from 'react';
import { Zap, Shield, RefreshCw, CheckCircle2, Loader2, Settings, Lock } from 'lucide-react';
import { lightningService, SatsWalletInfo } from '../../../services/lightningService';
import { useNotification } from '../../../contexts/NotificationContext';

interface LightningSettingsProps {
    username: string;
}

export function LightningSettings({ username }: LightningSettingsProps) {
    const { showNotification } = useNotification();
    const [wallet, setWallet] = useState<SatsWalletInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Form states for onboarding/settings
    const [autoSwap, setAutoSwap] = useState(false);
    const [threshold, setThreshold] = useState(1000);
    const [targetToken, setTargetToken] = useState('HIVE');

    useEffect(() => {
        loadWallet();
    }, [username]);

    const loadWallet = async () => {
        setLoading(true);
        try {
            const data = await lightningService.getOrCreateWallet(username);

            // If the backend returned a brand new wallet (with raw inkey), we must onboard
            if ((data as any).isNew) {
                setWallet(data);
                setIsOnboarding(true);
                setAutoSwap(false);
            } else {
                setWallet(data);
                setAutoSwap(data.autoSwap ?? false);
                setThreshold(data.config?.swapThreshold || 1000);
                setTargetToken(data.config?.targetToken || 'HIVE');
            }
        } catch (err: any) {
            console.error('Failed to load Lightning wallet:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOnboard = async () => {
        if (!wallet || !isOnboarding) return;
        setIsUpdating(true);
        try {
            const rawInkey = (wallet as any).inkey;
            await lightningService.saveWallet(username, wallet.walletId, rawInkey, autoSwap);
            showNotification('Lightning wallet secured and activated! ⚡', 'success');
            setIsOnboarding(false);
            loadWallet();
        } catch (err: any) {
            showNotification(err.message || 'Failed to secure wallet', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center gap-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl animate-pulse">
                <Loader2 className="animate-spin text-[var(--primary-color)]" size={32} />
                <p className="text-sm text-[var(--text-secondary)]">Syncing Lightning Wallet...</p>
            </div>
        );
    }

    if (isOnboarding) {
        return (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-r from-[#f7931a] to-[#f7b01a] p-8 text-white">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                            <Zap size={28} fill="currentColor" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight">Activate Lightning</h3>
                            <p className="text-white/80 text-sm font-medium">Native Bitcoin Sats • Instant • Zero Fees</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]">
                            <Shield className="text-[var(--primary-color)] shrink-0" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-[var(--text-primary)]">Keychain Protected</h4>
                                <p className="text-xs text-[var(--text-secondary)]">Your Lightning keys will be encrypted using your Hive identity. Only you can unlock them.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]">
                            <RefreshCw className="text-blue-500 shrink-0" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-[var(--text-primary)]">Automated Swaps</h4>
                                <p className="text-xs text-[var(--text-secondary)]">Enable auto-swap to have your Sats automatically converted to HIVE and sent to your account.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]">
                            <div>
                                <h4 className="text-sm font-bold text-[var(--text-primary)]">Enable Auto-Swap</h4>
                                <p className="text-[10px] text-[var(--text-secondary)]">Convert received tips to HIVE automatically</p>
                            </div>
                            <button
                                onClick={() => setAutoSwap(!autoSwap)}
                                className={`w-12 h-6 rounded-full transition-all relative ${autoSwap ? 'bg-green-500' : 'bg-[var(--border-color)]'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoSwap ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        {autoSwap && (
                            <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 block ml-1">Threshold (Sats)</label>
                                        <input
                                            type="number"
                                            value={threshold}
                                            onChange={(e) => setThreshold(Number(e.target.value))}
                                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 block ml-1">Target Asset</label>
                                        <select
                                            value={targetToken}
                                            onChange={(e) => setTargetToken(e.target.value)}
                                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none"
                                        >
                                            <option value="HIVE">HIVE</option>
                                            <option value="HBD">HBD</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleOnboard}
                        disabled={isUpdating}
                        className="w-full py-4 bg-[var(--primary-color)] text-white font-black rounded-2xl shadow-xl shadow-[var(--primary-color)]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isUpdating ? 'Securing Vault...' : 'Activate & Secure Wallet ⚡'}
                        {!isUpdating && <Shield size={18} />}
                    </button>

                    <p className="text-[10px] text-center text-[var(--text-secondary)] px-4">
                        By activating, your unique Lightning address will be <span className="text-[var(--text-primary)] font-bold">{username}@sovraniche.com</span>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#f7931a]/10 text-[#f7931a] rounded-xl flex items-center justify-center">
                        <Zap size={22} fill="currentColor" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-[var(--text-primary)]">Lightning Wallet</h3>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">{username}@sovraniche.com</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle2 size={12} />
                    Active
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)] space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        <Lock size={12} />
                        Security Status
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
                            <Shield size={18} />
                        </div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">Keychain Encrypted</p>
                    </div>
                </div>

                <div className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)] space-y-3 shadow-inner">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        <RefreshCw size={12} />
                        Auto-Swap
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{autoSwap ? 'Enabled' : 'Disabled'}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${autoSwap ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {autoSwap ? `→ ${targetToken}` : 'Manual'}
                        </span>
                    </div>
                </div>
            </div>

            <button
                onClick={() => setIsOnboarding(true)}
                className="w-full py-3.5 bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-2xl hover:bg-[var(--bg-card)] transition-all flex items-center justify-center gap-2 group"
            >
                <Settings size={18} className="group-hover:rotate-45 transition-transform" />
                Manage Lightning Settings
            </button>
        </div>
    );
}
