import { useState, useEffect, useCallback } from 'react';
import { NotificationService, HiveNotification } from '../../../services/notifications';

interface Web3ActivityFeedProps {
    username: string;
}

export function Web3ActivityFeed({ username }: Web3ActivityFeedProps) {
    const [activities, setActivities] = useState<HiveNotification[]>([]);
    const [loading, setLoading] = useState(true);

    const loadActivities = useCallback(async () => {
        setLoading(true);
        const localData = NotificationService.getLocalNotifications(username);
        const hiveLogData = await NotificationService.getWeb3History(username, 50);

        // Filter and merge with improved deduplication by txHash
        const combined = [...localData, ...hiveLogData]
            .filter(n => ['deposit', 'send'].includes(n.type))
            .filter((v, i, a) => {
                // Deduplicate by ID first
                const firstById = a.findIndex(t => t.id === v.id) === i;
                if (!firstById) return false;

                // Then deduplicate by txHash if available (prefers local which has better amounts/meta)
                if (v.txHash) {
                    const firstByHash = a.findIndex(t => t.txHash === v.txHash) === i;
                    return firstByHash;
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setActivities(combined);
        setLoading(false);
    }, [username]);

    useEffect(() => {
        loadActivities();
        window.addEventListener('local_notification_added', loadActivities);
        return () => window.removeEventListener('local_notification_added', loadActivities);
    }, [loadActivities]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'deposit': return '💰';
            case 'send': return '💸';
            default: return '🔔';
        }
    };

    const getExplorerUrl = (chain: string, hash?: string, address?: string) =>
        NotificationService.getExplorerUrl(chain, hash, address);

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]" />
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="py-12 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] opacity-60">
                <span className="text-3xl mb-2 block">⏳</span>
                <p className="text-sm text-[var(--text-secondary)]">No recent Web3 activities yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] px-2">Recent Activity</h3>
            <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-color)]">
                {activities.slice(0, 10).map((activity) => (
                    <div
                        key={activity.id}
                        className="p-4 flex items-center gap-4 hover:bg-[var(--bg-canvas)] transition-all group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
                            {getIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                                {activity.msg}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wider opacity-70">
                                    {new Date(activity.date.endsWith('Z') ? activity.date : activity.date + 'Z').toLocaleString()}
                                </p>
                                {(activity.txHash || activity.address) && (
                                    <a
                                        href={getExplorerUrl(activity.chain || '', activity.txHash, activity.address)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-[var(--primary-color)] font-bold hover:underline"
                                    >
                                        VIEW ON EXPLORER ↗
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="text-[10px] px-2 py-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold uppercase tracking-tighter">
                            {activity.type}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
