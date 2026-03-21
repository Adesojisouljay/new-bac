import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { NotificationService, HiveNotification } from '../../../services/notifications';
import { useCommunity } from '../../community/context/CommunityContext';
import { UnifiedDataService } from '../../../services/unified';

interface NotificationDropdownProps {
    username: string;
}

export function NotificationDropdown({ username }: NotificationDropdownProps) {
    const { config } = useCommunity();
    const isGlobalInstance = !config || config.id === 'global';

    const [isOpen, setIsOpen] = useState(false);
    const [allNotifications, setAllNotifications] = useState<HiveNotification[]>([]);
    const [filteredNotifications, setFilteredNotifications] = useState<HiveNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [filtering, setFiltering] = useState(false);
    const [communityOnly, setCommunityOnly] = useState(!isGlobalInstance);
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
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 30);

        setAllNotifications(combined);
        setLoading(false);
    };

    useEffect(() => {
        let isMounted = true;
        
        const filterNotifications = async () => {
            if (!communityOnly || isGlobalInstance || !config?.id) {
                setFilteredNotifications(allNotifications);
                setUnreadCount(NotificationService.getUnreadCount(allNotifications, lastCheckedId));
                return;
            }
            
            setFiltering(true);
            const passed: HiveNotification[] = [];
            
            const chunkSize = 10;
            for (let i = 0; i < allNotifications.length; i += chunkSize) {
                const chunk = allNotifications.slice(i, i + chunkSize);
                const results = await Promise.all(chunk.map(async (n) => {
                    if (n.id.startsWith('local_') || n.id.startsWith('hive_')) return n;
                    if (n.url) {
                        try {
                            const parts = n.url.split('/');
                            if (parts.length >= 2) {
                                let author = parts[0].replace('@', '');
                                let permlink = parts[1];
                                const post = await UnifiedDataService.getPost(author, permlink).catch(() => null);
                                if (post && post.community === config.id) return n;
                            }
                        } catch(e) {}
                    }
                    return null;
                }));
                passed.push(...(results.filter(Boolean) as HiveNotification[]));
            }
            
            if (isMounted) {
                setFilteredNotifications(passed);
                setUnreadCount(NotificationService.getUnreadCount(passed, lastCheckedId));
                setFiltering(false);
            }
        };

        if (allNotifications.length > 0) {
            filterNotifications();
        } else {
            setFilteredNotifications([]);
            setUnreadCount(0);
        }

        return () => { isMounted = false; };
    }, [allNotifications, communityOnly, config?.id, isGlobalInstance, lastCheckedId]);

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
            if (filteredNotifications.length > 0) {
                localStorage.setItem(`last_notification_${username}`, filteredNotifications[0].id);
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
                    <div className="p-3 flex flex-col gap-2 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/50">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[var(--text-primary)]">Notifications</h3>
                            <Link to="/notifications" className="text-xs text-[var(--primary-color)] hover:underline" onClick={() => setIsOpen(false)}>
                                View All
                            </Link>
                        </div>
                        {!isGlobalInstance && (
                            <label className="flex items-center gap-2 cursor-pointer self-start">
                               <span className={`text-[10px] font-bold uppercase tracking-wider ${!communityOnly ? 'text-[var(--text-secondary)]' : 'text-[var(--primary-color)]'}`}>
                                   {config?.name}
                               </span>
                               <div className="relative flex items-center">
                                   <input type="checkbox" className="sr-only" checked={communityOnly} onChange={(e) => setCommunityOnly(e.target.checked)} disabled={filtering} />
                                   <div className={`block w-6 h-3 rounded-full transition-colors ${communityOnly ? 'bg-[var(--primary-color)]' : 'bg-gray-600'}`}></div>
                                   <div className={`absolute left-0.5 top-0.5 bg-white w-2 h-2 rounded-full transition-transform ${communityOnly ? 'translate-x-3' : ''}`}></div>
                               </div>
                               <span className={`text-[10px] font-bold uppercase tracking-wider ${communityOnly ? 'text-[var(--text-secondary)]' : 'text-white'}`}>
                                   Global
                               </span>
                            </label>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {(loading || filtering) && filteredNotifications.length === 0 ? (
                            <div className="p-10 text-center text-[var(--text-secondary)]">
                                <div className="animate-spin mb-2 w-5 h-5 border-2 border-[var(--primary-color)] border-t-transparent mx-auto rounded-full"></div>
                                <p className="text-xs">Loading...</p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="p-10 text-center text-[var(--text-secondary)]">
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border-color)]">
                                {filteredNotifications.map((n) => (
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
