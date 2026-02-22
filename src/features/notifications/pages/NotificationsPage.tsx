import { useState, useEffect } from 'react';
import { NotificationService, HiveNotification } from '../../../services/notifications';
import { Link } from 'react-router-dom';

export function NotificationsPage() {
    const [notifications, setNotifications] = useState<HiveNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [username] = useState(localStorage.getItem('hive_user'));

    const fetchAllNotifications = async () => {
        if (!username) return;
        setLoading(true);
        const remoteData = await NotificationService.getNotifications(username, 50);
        const localData = NotificationService.getLocalNotifications(username);

        // Merge and sort by date descending
        const combined = [...localData, ...remoteData].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setNotifications(combined);
        setLoading(false);

        // Mark as read by saving the latest ID
        if (combined.length > 0) {
            localStorage.setItem(`last_notification_${username}`, combined[0].id);
        }
    };

    useEffect(() => {
        fetchAllNotifications();

        const handleLocalChange = () => fetchAllNotifications();
        window.addEventListener('local_notification_added', handleLocalChange);

        return () => {
            window.removeEventListener('local_notification_added', handleLocalChange);
        };
    }, [username]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'vote': return '👍';
            case 'mention': return '🆔';
            case 'reply': return '💬';
            case 'reblog': return '🔄';
            case 'follow': return '👤';
            case 'deposit': return '💰';
            case 'send': return '💸';
            default: return '🔔';
        }
    };

    if (!username) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <h1 className="text-2xl font-bold mb-4">Please login to view notifications</h1>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">Notifications</h1>
                <button
                    onClick={fetchAllNotifications}
                    className="p-2 rounded-full hover:bg-[var(--bg-card)] transition-colors"
                    title="Refresh"
                >
                    🔄
                </button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-[var(--bg-card)] h-24 rounded-2xl animate-pulse border border-[var(--border-color)]"></div>
                    ))}
                </div>
            ) : notifications.length === 0 ? (
                <div className="text-center py-20 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
                    <span className="text-5xl mb-4 block">📭</span>
                    <p className="text-[var(--text-secondary)]">No notifications to show</p>
                </div>
            ) : (
                <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] divide-y divide-[var(--border-color)] overflow-hidden">
                    {notifications.map((n) => (
                        <Link
                            key={n.id}
                            to={n.id.startsWith('local_') ? `/@${username}/wallet?tab=web3` : `/post/${n.url}`}
                            className="p-6 flex gap-4 hover:bg-[var(--bg-canvas)] transition-all group"
                        >
                            <div className="text-3xl mt-1 grayscale group-hover:grayscale-0 transition-all">{getTypeIcon(n.type)}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-lg text-[var(--text-primary)] leading-snug mb-2 group-hover:text-[var(--primary-color)] transition-colors">
                                    {n.msg}
                                </p>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                                        {new Date(n.date + 'Z').toLocaleString()}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold">
                                        SCORE: {n.score}
                                    </span>
                                </div>
                            </div>
                            <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[var(--primary-color)]">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
