import { useEffect, useState } from 'react';
import { pointsService, PointsBalance, PointsHistoryEntry } from '../../../services/pointsService';

const OPERATION_ICONS: Record<string, string> = {
    login: '🔑',
    posts: '📝',
    comments: '💬',
    upvote: '👍',
    reblog: '🔄',
    delegation: '⚡',
    community: '🏘️',
    checking: '✅',
};

const OPERATION_LABELS: Record<string, string> = {
    login: 'Daily Login',
    posts: 'Post',
    comments: 'Comment',
    upvote: 'Upvote',
    reblog: 'Reblog',
    delegation: 'Delegation',
    community: 'Community Action',
    checking: 'Daily Check-in',
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PointsWalletProps {
    username: string;
}

export function PointsWallet({ username }: PointsWalletProps) {
    const communityId = import.meta.env.VITE_COMMUNITY_ID || '';

    const [pointsData, setPointsData] = useState<PointsBalance | null>(null);
    const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!username || !communityId) return;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [balanceRes, historyRes] = await Promise.allSettled([
                    pointsService.getUserPoints(username, communityId),
                    pointsService.getPointsHistory(username, communityId),
                ]);

                if (balanceRes.status === 'fulfilled' && balanceRes.value.length > 0) {
                    setPointsData(balanceRes.value[0]);
                }
                if (historyRes.status === 'fulfilled') {
                    setHistory(historyRes.value);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load points data');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [username, communityId]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]" />
                ))}
            </div>
        );
    }

    const totalPoints = (pointsData?.pointsBalance ?? 0) + (pointsData?.unclaimedPoints ?? 0);

    return (
        <div className="space-y-6">
            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Balance */}
                <div className="sm:col-span-2 bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)] rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Total Points Balance</p>
                    <p className="text-5xl font-bold">{totalPoints.toLocaleString()}</p>
                    <p className="text-xs opacity-70 mt-2">{communityId} community</p>
                </div>

                {/* Unclaimed */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 flex flex-col justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Unclaimed</p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">
                        {(pointsData?.unclaimedPoints ?? 0).toLocaleString()}
                    </p>
                    <button
                        disabled
                        className="mt-4 w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-[var(--border-color)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                        title="Coming soon"
                    >
                        Claim Rewards
                    </button>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    {error} — Points data may not be available yet for this account.
                </div>
            )}

            {/* No data state */}
            {!error && !pointsData && (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="font-bold">No points yet</p>
                    <p className="text-sm mt-1">Start posting, commenting, and logging in daily to earn points.</p>
                </div>
            )}

            {/* Points Breakdown */}
            {pointsData && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-4">Earnings by Type</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(pointsData.points_by_type).map(([type, data]) => (
                            <div key={type} className="bg-[var(--bg-canvas)] rounded-xl p-3 border border-[var(--border-color)] text-center">
                                <div className="text-xl mb-1">{OPERATION_ICONS[type] || '⭐'}</div>
                                <div className="text-base font-bold text-[var(--text-primary)]">{data.points.toLocaleString()}</div>
                                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-tight mt-0.5">
                                    {OPERATION_LABELS[type] || type}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Coming Soon Actions */}
            <div className="grid grid-cols-3 gap-3">
                {['Redeem', 'Transfer', 'Community Perks'].map(label => (
                    <button
                        key={label}
                        disabled
                        className="py-3 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--text-secondary)] opacity-40 cursor-not-allowed"
                        title="Coming soon"
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--border-color)]">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">Earning History</h3>
                    </div>
                    <div className="divide-y divide-[var(--border-color)]">
                        {history.slice(0, 30).map(entry => (
                            <div key={entry._id} className="px-5 py-3 flex items-center justify-between hover:bg-[var(--bg-canvas)] transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{OPERATION_ICONS[entry.operationType] || '⭐'}</span>
                                    <div>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {OPERATION_LABELS[entry.operationType] || entry.operationType}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)]">{formatDate(entry.timestamp)}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-green-500">+{entry.pointsEarned}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
