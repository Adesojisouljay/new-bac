import { useState } from 'react';

interface UnlockModalProps {
    username: string;
    onUnlock: () => Promise<void>;
}

export function UnlockModal({ username, onUnlock }: UnlockModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUnlock = async () => {
        setLoading(true);
        setError(null);
        try {
            await onUnlock();
        } catch (err: any) {
            setError(err.message || 'Failed to unlock wallet');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-6 animate-in fade-in duration-500">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-4xl shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--primary-color)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                🔒
            </div>

            <div className="space-y-2 max-w-sm">
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">Wallet Locked</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                    Sign a message with Hive Keychain to securely unlock your Web3 wallets for <span className="font-bold text-[var(--text-primary)]">@{username}</span>.
                </p>
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-bold text-red-500 animate-in shake-x duration-300">
                    {error}
                </div>
            )}

            <button
                onClick={handleUnlock}
                disabled={loading}
                className="group relative px-10 py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[var(--primary-color)]/25 disabled:opacity-60 flex items-center gap-3"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Unlocking...</span>
                    </>
                ) : (
                    <>
                        <span>Unlock with Keychain</span>
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </>
                )}
            </button>

            <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold opacity-50">
                Identity-Bound Encryption • Non-Custodial
            </p>
        </div>
    );
}
