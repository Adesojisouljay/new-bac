import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { NotificationService, HiveNotification } from '../../../services/notifications';

interface NotificationDropdownProps {
    username: string;
}

export function NotificationDropdown({ username }: NotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<HiveNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const lastCheckedId = localStorage.getItem(`last_notification_${username}`);

    const fetchNotifications = async () => {
        setLoading(true);
        const remoteData = await NotificationService.getNotifications(username, 10);
        const localData = NotificationService.getLocalNotifications(username);
        const hiveLogData = await NotificationService.getWeb3History(username, 50);

        // Merge and sort by date descending with improved deduplication
        const combined = [...localData, ...hiveLogData, ...remoteData]
            .filter((v, i, a) => {
                // Deduplicate by ID
                const firstById = a.findIndex(t => t.id === v.id) === i;
                if (!firstById) return false;

                // Deduplicate by txHash (prefers local which is earlier in the array)
                if (v.txHash) {
                    const firstByHash = a.findIndex(t => t.txHash === v.txHash) === i;
                    return firstByHash;
                }
                return true;
            })
            .sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ).slice(0, 30);

        setNotifications(combined);
        setUnreadCount(NotificationService.getUnreadCount(combined, lastCheckedId));
        setLoading(false);
    };

    useEffect(() => {
        if (username) {
            fetchNotifications();

            const handleLocalChange = () => fetchNotifications();
            window.addEventListener('local_notification_added', handleLocalChange);

            const interval = setInterval(() => {
                fetchNotifications();
            }, 30000);

            return () => {
                window.removeEventListener('local_notification_added', handleLocalChange);
                clearInterval(interval);
            };
        }
    }, [username, lastCheckedId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!isOpen) {
            setIsOpen(true);
            if (notifications.length > 0) {
                localStorage.setItem(`last_notification_${username}`, notifications[0].id);
                setUnreadCount(0);
            }
        } else {
            setIsOpen(false);
        }
    };

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

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="p-2 rounded-full hover:bg-[var(--bg-card)] transition-colors relative group"
                title="Notifications"
            >
                <span className="text-xl group-hover:scale-110 transition-transform">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[var(--bg-canvas)]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-canvas)]/50">
                        <h3 className="font-bold text-[var(--text-primary)]">Notifications</h3>
                        <Link to="/notifications" className="text-xs text-[var(--primary-color)] hover:underline" onClick={() => setIsOpen(false)}>
                            View All
                        </Link>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {loading && notifications.length === 0 ? (
                            <div className="p-10 text-center text-[var(--text-secondary)]">
                                <div className="animate-spin mb-2">⏳</div>
                                <p className="text-xs">Loading...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-10 text-center text-[var(--text-secondary)]">
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border-color)]">
                                {notifications.map((n) => (
                                    <Link
                                        key={n.id}
                                        to={n.id.startsWith('local_') ? `/${username}/wallet` : `/post/${n.url}`}
                                        className="p-4 flex gap-3 hover:bg-[var(--bg-canvas)] transition-colors group"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <div className="text-2xl mt-1">{getTypeIcon(n.type)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[var(--text-primary)] leading-tight mb-1 group-hover:text-[var(--primary-color)] transition-colors">
                                                {n.msg}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider flex items-center gap-2">
                                                {new Date(n.date + 'Z').toLocaleString()}
                                                {(n.txHash || n.address) && (
                                                    <a
                                                        href={NotificationService.getExplorerUrl(n.chain || '', n.txHash, n.address)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-[var(--primary-color)] hover:underline"
                                                    >
                                                        VIEW ↗
                                                    </a>
                                                )}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
