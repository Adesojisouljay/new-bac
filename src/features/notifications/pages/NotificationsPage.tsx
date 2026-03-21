import { useState, useEffect } from 'react';
import { NotificationService, HiveNotification } from '../../../services/notifications';
import { Link } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { UnifiedDataService } from '../../../services/unified';

export function NotificationsPage() {
    const { config } = useCommunity();
    const isGlobalInstance = !config || config.id === 'global';
    
    const [allNotifications, setAllNotifications] = useState<HiveNotification[]>([]);
    const [filteredNotifications, setFilteredNotifications] = useState<HiveNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtering, setFiltering] = useState(false);
    const [communityOnly, setCommunityOnly] = useState(!isGlobalInstance);
    const [username] = useState(localStorage.getItem('hive_user'));

    const fetchAllNotifications = async () => {
        if (!username) return;
        setLoading(true);
        const remoteData = await NotificationService.getNotifications(username, 50);
        const localData = NotificationService.getLocalNotifications(username);
        const hiveLogData = await NotificationService.getWeb3History(username, 50);

        // Merge and sort by date descending with improved deduplication
        const combined = [...localData, ...hiveLogData, ...remoteData]
            .filter((v, i, a) => {
                // Deduplicate by ID
                const firstById = a.findIndex(t => t.id === v.id) === i;
                if (!firstById) return false;

                // Deduplicate by txHash (prefers local/hive logs over generic remote ones)
                if (v.txHash) {
                    const firstByHash = a.findIndex(t => t.txHash === v.txHash) === i;
                    return firstByHash;
                }
                return true;
            })
            .sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

        setAllNotifications(combined);
        setLoading(false);

        // Mark as read by saving the latest ID
        if (combined.length > 0) {
            localStorage.setItem(`last_notification_${username}`, combined[0].id);
        }
    };

    useEffect(() => {
        let isMounted = true;
        
        const filterNotifications = async () => {
            if (!communityOnly || isGlobalInstance || !config?.id) {
                setFilteredNotifications(allNotifications);
                return;
            }
            
            setFiltering(true);
            const passed: HiveNotification[] = [];
            
            // Map 10 concurrent requests at a time to prevent rate limits while preserving speed
            const chunkSize = 10;
            for (let i = 0; i < allNotifications.length; i += chunkSize) {
                const chunk = allNotifications.slice(i, i + chunkSize);
                const results = await Promise.all(chunk.map(async (n) => {
                    // Always show generic transaction logs, we filter purely community Hive posts
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
                setFiltering(false);
            }
        };

        if (allNotifications.length > 0) {
            filterNotifications();
        } else {
            setFilteredNotifications([]);
        }

        return () => { isMounted = false; };
    }, [allNotifications, communityOnly, config?.id, isGlobalInstance]);

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">Notifications</h1>
                
                <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-card)] px-4 py-2 rounded-2xl border border-[var(--border-color)]">
                    {!isGlobalInstance && (
                        <label className="flex items-center gap-3 cursor-pointer">
                           <span className={`text-xs font-bold uppercase tracking-wider ${!communityOnly ? 'text-[var(--text-secondary)]' : 'text-[var(--primary-color)]'}`}>
                               {config?.name} Only
                           </span>
                           <div className="relative flex items-center">
                               <input type="checkbox" className="sr-only" checked={communityOnly} onChange={(e) => setCommunityOnly(e.target.checked)} disabled={filtering} />
                               <div className={`block w-10 h-6 rounded-full transition-colors ${communityOnly ? 'bg-[var(--primary-color)]' : 'bg-gray-600'}`}></div>
                               <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${communityOnly ? 'translate-x-4' : ''}`}></div>
                           </div>
                           <span className={`text-xs font-bold uppercase tracking-wider ${communityOnly ? 'text-[var(--text-secondary)]' : 'text-white'}`}>
                               Global
                           </span>
                        </label>
                    )}
                    <button
                        onClick={fetchAllNotifications}
                        disabled={loading || filtering}
                        className="p-2 rounded-full hover:bg-[var(--bg-canvas)] transition-colors text-[var(--text-secondary)] hover:text-white disabled:opacity-50"
                        title="Refresh"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {(loading || filtering) ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-[var(--bg-card)] flex gap-4 p-6 rounded-3xl border border-[var(--border-color)]">
                            <div className="w-10 h-10 bg-[var(--bg-canvas)] rounded-full animate-pulse" />
                            <div className="flex-1 space-y-3">
                                <div className="h-4 bg-[var(--bg-canvas)] rounded w-3/4 animate-pulse" />
                                <div className="h-3 bg-[var(--bg-canvas)] rounded w-1/4 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-20 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
                    <span className="text-5xl mb-4 block">📭</span>
                    <p className="text-[var(--text-secondary)]">No notifications to show</p>
                </div>
            ) : (
                <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] divide-y divide-[var(--border-color)] overflow-hidden">
                    {filteredNotifications.map((n) => (
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
                                    {(n.txHash || n.address) && (
                                        <a
                                            href={NotificationService.getExplorerUrl(n.chain || '', n.txHash, n.address)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-[10px] text-[var(--primary-color)] font-bold hover:underline"
                                        >
                                            VIEW ON EXPLORER ↗
                                        </a>
                                    )}
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
