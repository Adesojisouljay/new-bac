import { useEffect, useState } from 'react';
import { pointsService, PointsBalance, PointsHistoryEntry } from '../../../services/pointsService';
import { useCommunity } from '../../community/context/CommunityContext';

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
    const { config } = useCommunity();
    const communityId = config?.id || import.meta.env.VITE_COMMUNITY_ID || 'global';

    const [pointsData, setPointsData] = useState<PointsBalance | null>(null);
    const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
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

                if (balanceRes.status === 'fulfilled' && balanceRes.value) {
                    setPointsData(balanceRes.value);
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

    const handleClaim = async () => {
        if (!username || !communityId || !pointsData || pointsData.unclaimedPoints <= 0) return;

        setIsClaiming(true);
        try {
            const { toast } = await import('react-hot-toast');
            const res = await pointsService.claimPoints(username, communityId);

            if (res.success) {
                toast.success('Points claimed successfully!');
                // We fake-refresh the local state instantly for UX
                setPointsData(prev => prev ? {
                    ...prev,
                    totalPoints: (prev.totalPoints || 0) + (prev.unclaimedPoints || 0),
                    unclaimedPoints: 0
                } : null);

                // Refresh history in background
                pointsService.getPointsHistory(username, communityId).then(setHistory);
            } else {
                toast.error(res.message || 'Failed to claim points.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsClaiming(false);
        }
    };

    const totalPoints = (pointsData?.totalPoints ?? 0);

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
                        onClick={handleClaim}
                        disabled={isClaiming || (pointsData?.unclaimedPoints ?? 0) <= 0}
                        className={`mt-4 w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${(pointsData?.unclaimedPoints ?? 0) > 0
                            ? 'bg-gradient-to-r from-[var(--primary-color)] to-[var(--accent-color)] text-white shadow hover:scale-[1.02] active:scale-95 transition-all'
                            : 'border border-[var(--border-color)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed'
                            }`}
                    >
                        {isClaiming ? 'Claiming...' : 'Claim Rewards'}
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
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden mt-6">
                    <div className="px-5 py-4 border-b border-[var(--border-color)]">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">Earning History</h3>
                    </div>
                    <div className="divide-y divide-[var(--border-color)]">
                        {history.slice(0, 30).map(entry => (
                            <div key={entry._id} className="px-5 py-3 flex items-center justify-between hover:bg-[var(--bg-canvas)] transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{OPERATION_ICONS[entry.actionType] || '⭐'}</span>
                                    <div>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {OPERATION_LABELS[entry.actionType] || entry.actionType}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)]">{formatDate(entry.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={`text-sm font-bold ${entry.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {entry.points > 0 ? '+' : ''}{entry.points}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
