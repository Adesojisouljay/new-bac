import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { UnifiedDataService, CommunityDetails } from '../../../services/unified';
import { Users, PlusCircle, ExternalLink, Globe, Search, ArrowRight } from 'lucide-react';
import { SearchModal } from './SearchModal';

interface GlobalSidebarProps {
    isStandalone?: boolean;
}

export function GlobalSidebar({ isStandalone = false }: GlobalSidebarProps) {
    const navigate = useNavigate();
    const { config } = useCommunity();
    const currentUsername = localStorage.getItem('hive_user');
    const [stats, setStats] = useState<any>(null);
    const [suggestedUsers, setSuggestedUsers] = useState<{ username: string; reputation: number; avatar_url: string }[]>([]);
    const [suggestedCommunities, setSuggestedCommunities] = useState<CommunityDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [initialSearchTab, setInitialSearchTab] = useState<'people' | 'communities'>('people');

    // Action States
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
    const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(new Set());

    useEffect(() => {
        async function loadSidebarData() {
            setLoading(true);
            try {
                // Determine if we should load user-specific states
                const globalsPromise = UnifiedDataService.getHiveGlobals();
                const usersPromise = UnifiedDataService.getSuggestedUsers(10); // Fetch a bit more to filter out already followed
                const communitiesPromise = UnifiedDataService.getTrendingCommunities(10);

                let followingPromise: Promise<string[]> = Promise.resolve([]);
                let subscriptionsPromise: Promise<string[]> = Promise.resolve([]);

                if (currentUsername) {
                    followingPromise = UnifiedDataService.getFollowing(currentUsername);
                    subscriptionsPromise = UnifiedDataService.getSubscriptions(currentUsername);
                }

                const [globals, users, communities, followingList, subscriptionsList] = await Promise.all([
                    globalsPromise,
                    usersPromise,
                    communitiesPromise,
                    followingPromise,
                    subscriptionsPromise
                ]);

                setStats(globals);

                // Initialize states
                const followingSet = new Set(followingList);
                const subscriptionsSet = new Set(subscriptionsList);
                setFollowedUsers(followingSet);
                setJoinedCommunities(subscriptionsSet);

                // Filter out already followed/joined from suggestions (optional, but good UX)
                // For now, we'll keep them but show the "Following" state, limiting to 5 visually
                setSuggestedUsers(users.slice(0, 5));
                setSuggestedCommunities(communities.slice(0, 5));

            } catch (error) {
                console.error('Failed to load global sidebar data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadSidebarData();
    }, [currentUsername]);

    const openSearch = (tab: 'people' | 'communities') => {
        setInitialSearchTab(tab);
        setIsSearchModalOpen(true);
    };

    const handleFollow = async (targetUser: string, isFollowing: boolean) => {
        if (!currentUsername) {
            alert("Please log in to follow users.");
            return;
        }

        setActionLoading(prev => ({ ...prev, [`follow_${targetUser}`]: true }));
        try {
            // If isFollowing is true, we want to unfollow (false pass to UnifiedDataService)
            const success = await UnifiedDataService.followUser(currentUsername, targetUser, !isFollowing);
            if (success) {
                setFollowedUsers(prev => {
                    const newSet = new Set(prev);
                    if (isFollowing) {
                        newSet.delete(targetUser);
                    } else {
                        newSet.add(targetUser);
                    }
                    return newSet;
                });
            }
        } finally {
            setActionLoading(prev => ({ ...prev, [`follow_${targetUser}`]: false }));
        }
    };

    const handleJoin = async (communityId: string, isJoined: boolean) => {
        if (!currentUsername) {
            alert("Please log in to join communities.");
            return;
        }

        setActionLoading(prev => ({ ...prev, [`join_${communityId}`]: true }));
        try {
            let success = false;
            if (isJoined) {
                success = await UnifiedDataService.unsubscribeCommunity(currentUsername, communityId);
            } else {
                success = await UnifiedDataService.subscribeCommunity(currentUsername, communityId);
            }

            if (success) {
                setJoinedCommunities(prev => {
                    const newSet = new Set(prev);
                    if (isJoined) {
                        newSet.delete(communityId);
                    } else {
                        newSet.add(communityId);
                    }
                    return newSet;
                });
            }
        } finally {
            setActionLoading(prev => ({ ...prev, [`join_${communityId}`]: false }));
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Who to Follow - Only on Global */}
            {!isStandalone && (
                <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-color)] shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] flex items-center gap-2">
                            <Users size={14} className="text-orange-500" />
                            Who to Follow
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex items-center gap-3 animate-pulse">
                                    <div className="w-10 h-10 bg-[var(--bg-canvas)] rounded-full" />
                                    <div className="flex-grow space-y-2">
                                        <div className="h-3 bg-[var(--bg-canvas)] rounded w-2/3" />
                                        <div className="h-2 bg-[var(--bg-canvas)] rounded w-1/3" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                {suggestedUsers.map(user => {
                                    const isFollowing = followedUsers.has(user.username);
                                    const isLoading = actionLoading[`follow_${user.username}`];

                                    return (
                                        <div key={user.username} className="flex items-center justify-between group">
                                            <Link to={`/@${user.username}`} className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={user.avatar_url}
                                                    alt={user.username}
                                                    className="w-10 h-10 rounded-full object-cover border border-[var(--border-color)] group-hover:border-[var(--primary-color)] transition-colors"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-black text-[var(--text-primary)] truncate group-hover:text-[var(--primary-color)] transition-colors">
                                                        @{user.username}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">
                                                        Rep: {user.reputation}
                                                    </span>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => handleFollow(user.username, isFollowing)}
                                                disabled={isLoading}
                                                className={`min-w-[70px] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing
                                                    ? 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 border border-[var(--border-color)] hover:border-rose-500/30'
                                                    : 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white border border-transparent'
                                                    }`}
                                            >
                                                {isLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                                            </button>
                                        </div>
                                    )
                                })}

                                <button
                                    onClick={() => openSearch('people')}
                                    className="w-full mt-2 py-3 px-4 flex items-center justifycenter gap-2 rounded-xl bg-[var(--bg-canvas)] border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]/50 transition-all group"
                                >
                                    <Search size={14} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Find more users</span>
                                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 2. Suggested Communities - Only on Global */}
            {!isStandalone && (
                <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-color)] shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] flex items-center gap-2">
                            <PlusCircle size={14} className="text-green-500" />
                            Suggested Communities
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex items-center gap-3 animate-pulse">
                                    <div className="w-10 h-10 bg-[var(--bg-canvas)] rounded-xl" />
                                    <div className="flex-grow space-y-2">
                                        <div className="h-3 bg-[var(--bg-canvas)] rounded w-2/3" />
                                        <div className="h-2 bg-[var(--bg-canvas)] rounded w-1/3" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                {suggestedCommunities.map(community => {
                                    const isJoined = joinedCommunities.has(community.id);
                                    const isLoading = actionLoading[`join_${community.id}`];

                                    return (
                                        <div key={community.id} className="flex items-center justify-between group">
                                            <Link to={config?.id === community.id ? "/" : `/c/${community.id}`} className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={community.avatar_url}
                                                    alt={community.title}
                                                    className="w-10 h-10 rounded-xl object-cover border border-[var(--border-color)] group-hover:border-[var(--primary-color)] transition-colors"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-black text-[var(--text-primary)] truncate group-hover:text-[var(--primary-color)] transition-colors">
                                                        {community.title}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">
                                                        {community.subscribers.toLocaleString()} Members
                                                    </span>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => handleJoin(community.id, isJoined)}
                                                disabled={isLoading}
                                                className={`min-w-[70px] px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${isJoined
                                                    ? 'border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500'
                                                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'
                                                    }`}
                                            >
                                                {isLoading ? '...' : isJoined ? 'Joined' : 'Join'}
                                            </button>
                                        </div>
                                    )
                                })}

                                <button
                                    onClick={() => openSearch('communities')}
                                    className="w-full mt-2 py-3 px-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-canvas)] border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]/50 transition-all group"
                                >
                                    <Search size={14} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Find more communities</span>
                                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Market Stats */}
            <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-color)] shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <Link to="/market" className="inline-flex items-center gap-2 group">
                        <Globe size={14} className="text-blue-500 group-hover:scale-110 transition-transform duration-300" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] transition-colors">
                            Market
                        </h3>
                    </Link>
                    <Link
                        to="/market"
                        className="px-3 py-1.5 rounded-lg bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white border border-transparent text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                    >
                        Buy / Sell
                    </Link>
                </div>

                <div className="space-y-4">
                    {/* HIVE Stats */}
                    <div className="flex items-center justify-between p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-color)]">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black text-[var(--text-secondary)] tracking-wider">HIVE Price</span>
                            <span className="text-lg font-black text-[var(--text-primary)] leading-tight">
                                {stats ? `$${parseFloat(stats.ticker?.latest || '0').toFixed(3)}` : '...'}
                            </span>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-[10px] font-black ${parseFloat(stats?.ticker?.percent_change || '0') >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {stats ? `${parseFloat(stats.ticker?.percent_change || '0') >= 0 ? '+' : ''}${parseFloat(stats.ticker?.percent_change || '0').toFixed(2)}%` : '...'}
                        </div>
                    </div>

                    {/* HBD Stats */}
                    <div className="flex items-center justify-between p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-color)]">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black text-[var(--text-secondary)] tracking-wider">HBD Price</span>
                            <span className="text-lg font-black text-[var(--text-primary)] leading-tight">
                                $1.000
                            </span>
                        </div>
                        <div className="px-2 py-1 rounded-md text-[10px] font-black bg-green-500/10 text-green-500">
                            STABLE
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--border-color)]/50 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-black text-[var(--text-secondary)] tracking-wider">Reward Fund</span>
                        <span className="text-xs font-black text-[var(--text-primary)]">
                            {stats ? `${Math.floor(parseFloat(stats.props?.total_reward_fund_hive || '0')).toLocaleString()} HIVE` : '...'}
                        </span>
                    </div>
                    {stats?.props?.hbd_interest_rate && (
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-black text-[var(--text-secondary)] tracking-wider">HBD APR</span>
                            <span className="text-xs font-black text-green-500">
                                {stats.props.hbd_interest_rate / 100}% Savings
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Ecosystem Navigation */}
            <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-color)] shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6 flex items-center gap-2">
                    <Globe size={14} className="text-purple-500" />
                    Hive Ecosystem
                </h3>

                <div className="space-y-3 mb-6">
                    <button
                        onClick={() => navigate('/governance/proposal')}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] group/nav hover:border-[var(--primary-color)]/30 transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                                <PlusCircle size={16} />
                            </div>
                            <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Proposals</span>
                        </div>
                        <ExternalLink size={14} className="text-[var(--text-secondary)]/30 group-hover/nav:text-[var(--primary-color)] transition-colors" />
                    </button>

                    <button
                        onClick={() => navigate('/governance/witness')}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] group/nav hover:border-[var(--primary-color)]/30 transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Users size={16} />
                            </div>
                            <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Witnesses</span>
                        </div>
                        <ExternalLink size={14} className="text-[var(--text-secondary)]/30 group-hover/nav:text-[var(--primary-color)] transition-colors" />
                    </button>
                </div>

                <div className="pt-6 border-t border-[var(--border-color)]/50">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-4">Explore DApps</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { name: 'PeakD', url: 'https://peakd.com', icon: '🏔️' },
                            { name: 'Ecency', url: 'https://ecency.com', icon: '🌊' },
                            { name: 'Splinterlands', url: 'https://splinterlands.com', icon: '⚔️' },
                            { name: 'HiveBlog', url: 'https://hive.blog', icon: '📝' }
                        ].map(dapp => (
                            <a
                                key={dapp.name}
                                href={dapp.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] hover:border-[var(--primary-color)]/50 transition-all"
                            >
                                <span className="text-sm">{dapp.icon}</span>
                                <span className="text-[10px] font-black text-[var(--text-primary)] truncate">{dapp.name}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                initialTab={initialSearchTab}
            />
        </div>
    );
}
