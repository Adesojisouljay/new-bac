import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { UnifiedDataService, Post, CommunityDetails } from '../../../services/unified';
import { CommunityHeader } from '../../community/components/CommunityHeader';
import { CommunitySidebar } from '../../community/components/CommunitySidebar';
import { CommunityLeadership } from '../../community/components/CommunityLeadership';
import { SubscriberList } from '../../community/components/SubscriberList';
import { ActivityList } from '../../community/components/ActivityList';
import { Subscriber, Activity } from '../../../services/unified';
import { StoryBar } from '../../stories/components/StoryBar';
import { GlobalSidebar } from '../components/GlobalSidebar';
import { TopicSidebar } from '../components/TopicSidebar';
import { PostCard } from '../components/PostCard';

export default function FeedPage() {
    const { config } = useCommunity();
    const navigate = useNavigate();
    const { sort: sortParam, tag: tagParam } = useParams();
    const location = useLocation();

    // Derive active tab from path (look for the keyword anywhere to handle community params)
    const activeTab = location.pathname.includes('/about') ? 'about' :
        location.pathname.includes('/subscribers') ? 'subscribers' :
            location.pathname.includes('/activities') ? 'activities' : 'posts';

    // Sort mapping: map url sort to API sort
    // trending -> trending, new -> created, hot -> hot
    const getSortFromParam = (param: string | undefined): 'created' | 'trending' | 'hot' | 'promoted' | 'payout' | 'muted' => {
        if (param === 'new') return 'created';
        if (param === 'hot') return 'hot';
        if (param === 'promoted') return 'promoted';
        if (param === 'payout') return 'payout';
        if (param === 'muted') return 'muted';
        if (param === 'friends') return 'trending';
        return 'trending'; // default
    };

    const sort: 'created' | 'trending' | 'hot' | 'promoted' | 'payout' | 'muted' = getSortFromParam(sortParam);

    // Derive effective tag: use tagParam first, then check sortParam if it's 'friends', else 'global'
    const feedTag = config ? (config.id === 'global' ? (tagParam || (sortParam === 'friends' ? 'friends' : 'global')) : config.id) : 'global';

    // Community Data State
    const [community, setCommunity] = useState<CommunityDetails | null>(null);

    // Feed State
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    // Subscribers State
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [lastSubscriber, setLastSubscriber] = useState<string | undefined>(undefined);
    const [subscribersLoading, setSubscribersLoading] = useState(false);

    // Activities State
    const [activities, setActivities] = useState<Activity[]>([]);
    const [lastActivityId, setLastActivityId] = useState<number | undefined>(undefined);
    const [activitiesLoading, setActivitiesLoading] = useState(false);

    // Fetch Community Details
    useEffect(() => {
        async function fetchDetails() {
            if (!config) return;

            // If global mode and we have a tag, try to fetch community details for that tag
            // Otherwise if not global, fetch for the config.id (unless tag is a special sort or friends)
            const isSpecialTag = ['friends', 'payout', 'muted', 'promoted'].includes(tagParam || '') || ['friends', 'payout', 'muted', 'promoted'].includes(sortParam || '');
            const targetId = (config.id === 'global' && tagParam && !isSpecialTag) ? tagParam :
                (config.id !== 'global' ? config.id : null);

            if (targetId && targetId !== 'global') {
                const details = await UnifiedDataService.getCommunityDetails(targetId);
                setCommunity(details);
            } else {
                setCommunity(null);
            }
        }
        fetchDetails();
    }, [config, tagParam, sortParam]);

    const [excludeReblogs, setExcludeReblogs] = useState(false);
    const [user] = useState<string | null>(localStorage.getItem('hive_user'));

    // Dropdown States
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [showReblogFilters, setShowReblogFilters] = useState(false);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (!target.closest('.filters-dropdown') && !target.closest('.reblog-dropdown')) {
                setShowMoreFilters(false);
                setShowReblogFilters(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initial Feed Load
    useEffect(() => {
        async function loadFeed() {
            if (!config) return;

            setLoading(true);
            setError(null);
            try {
                let data: Post[] = [];
                if (sort === 'trending' && feedTag === 'friends' && user) {
                    data = await UnifiedDataService.getFollowingFeed(user, 20);
                } else {
                    data = await UnifiedDataService.getCommunityFeed(feedTag, sort, 20);
                }

                setPosts(data);
                setHasMore(data.length >= 19); // Bridge limit check
            } catch (err) {
                console.error("Failed to load feed", err);
                setError("Failed to load community feed. Please try again.");
            } finally {
                setLoading(false);
            }
        }

        // Only reload feed if we are on the posts tab (optional optimization, but good for UX to keep it fresh)
        if (activeTab === 'posts') {
            setPosts([]);
            setHasMore(true);
            loadFeed();
        } else if (activeTab === 'subscribers') {
            setSubscribers([]);
            setLastSubscriber(undefined);
            setHasMore(true);
            loadSubscribers();
        } else if (activeTab === 'activities') {
            setActivities([]);
            setLastActivityId(undefined);
            setHasMore(true);
            loadActivities();
        }
    }, [config, sort, activeTab, tagParam]);

    async function loadActivities() {
        if (!config) return;
        setActivitiesLoading(true);
        try {
            const data = await UnifiedDataService.getCommunityActivities(config.id, 20);
            setActivities(data);
            setHasMore(data.length >= 20);
            if (data.length > 0) setLastActivityId(data[data.length - 1].id);
        } catch (err) {
            console.error("Failed to load activities", err);
        } finally {
            setActivitiesLoading(false);
        }
    }

    async function loadSubscribers() {
        if (!config) return;
        setSubscribersLoading(true);
        try {
            const data = await UnifiedDataService.getCommunitySubscribers(config.id, 50);
            setSubscribers(data);
            setHasMore(data.length >= 50);
            if (data.length > 0) setLastSubscriber(data[data.length - 1].user);
        } catch (err) {
            console.error("Failed to load subscribers", err);
        } finally {
            setSubscribersLoading(false);
        }
    }

    const loadMore = useCallback(async () => {
        if (!config || loading || isFetchingMore || !hasMore || posts.length === 0) return;

        const lastPost = posts[posts.length - 1];
        if (!lastPost) return;

        setIsFetchingMore(true);
        try {
            const feedTag = config.id === 'global' ? (tagParam || 'global') : config.id;

            let newData: Post[] = [];
            if (sort === 'trending' && feedTag === 'friends' && user) {
                newData = await UnifiedDataService.getFollowingFeed(user, 20, lastPost.author, lastPost.permlink);
            } else {
                newData = await UnifiedDataService.getCommunityFeed(
                    feedTag,
                    sort,
                    20,
                    lastPost.author,
                    lastPost.permlink
                );
            }

            if (newData.length === 0) {
                setHasMore(false);
            } else {
                setPosts(prev => {
                    const newPosts = newData.filter(n => !prev.some(p => p.id === n.id));
                    if (newPosts.length === 0) return prev;
                    return [...prev, ...newPosts];
                });

                if (newData.length < 19) setHasMore(false);
            }
        } catch (err) {
            console.error("Failed to load more posts", err);
        } finally {
            setIsFetchingMore(false);
        }
    }, [config, loading, isFetchingMore, hasMore, posts, sort, tagParam, user]);

    const loadMoreSubscribers = useCallback(async () => {
        if (!config || subscribersLoading || isFetchingMore || !hasMore || !lastSubscriber) return;

        setIsFetchingMore(true);
        try {
            const newData = await UnifiedDataService.getCommunitySubscribers(config.id, 50, lastSubscriber);

            if (newData.length === 0) {
                setHasMore(false);
            } else {
                setSubscribers(prev => [...prev, ...newData]);
                setLastSubscriber(newData[newData.length - 1].user);
                if (newData.length < 50) setHasMore(false);
            }
        } catch (err) {
            console.error("Failed to load more subscribers", err);
        } finally {
            setIsFetchingMore(false);
        }
    }, [config, subscribersLoading, isFetchingMore, hasMore, lastSubscriber]);

    const loadMoreActivities = useCallback(async () => {
        if (!config || activitiesLoading || isFetchingMore || !hasMore || lastActivityId === undefined) return;

        setIsFetchingMore(true);
        try {
            const newData = await UnifiedDataService.getCommunityActivities(config.id, 20, lastActivityId);

            if (newData.length === 0) {
                setHasMore(false);
            } else {
                setActivities(prev => {
                    const filtered = newData.filter(n => !prev.some(p => p.id === n.id));
                    if (filtered.length === 0) return prev;
                    return [...prev, ...filtered];
                });
                setLastActivityId(newData[newData.length - 1].id);
                if (newData.length < 20) setHasMore(false);
            }
        } catch (err) {
            console.error("Failed to load more activities", err);
        } finally {
            setIsFetchingMore(false);
        }
    }, [config, activitiesLoading, isFetchingMore, hasMore, lastActivityId]);

    // Filter posts locally for reblogs
    const displayedPosts = excludeReblogs
        ? posts.filter(p => !p.reblogged_by || p.reblogged_by.length === 0)
        : posts;


    // Sentinel ref for infinite scroll
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const currentSentinel = sentinelRef.current;
        if (!currentSentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isFetchingMore && !loading && !subscribersLoading && !activitiesLoading) {
                if (activeTab === 'posts') loadMore();
                else if (activeTab === 'subscribers') loadMoreSubscribers();
                else if (activeTab === 'activities') loadMoreActivities();
            }
        }, {
            rootMargin: '400px',
        });

        observer.observe(currentSentinel);

        return () => {
            if (currentSentinel) observer.unobserve(currentSentinel);
        };
    }, [hasMore, isFetchingMore, loading, loadMore, activeTab, subscribersLoading, activitiesLoading, loadMoreSubscribers, loadMoreActivities]);

    if (!config) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading configuration...</div>;

    const isGlobal = config.id === 'global';

    return (
        <div className="max-w-[1400px] mx-auto pb-12 px-4 md:px-8">

            {/* 1. Community Header (Banner & Stats) */}
            {!isGlobal && (
                <div>
                    {community ? (
                        <CommunityHeader
                            community={community}
                        />
                    ) : (
                        // Skeleton Header
                        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse mb-6" />
                    )}
                </div>
            )}

            <div className={`grid grid-cols-1 ${!isGlobal ? 'lg:grid-cols-4 xl:grid-cols-12' : 'lg:grid-cols-12'} gap-8`}>

                {/* Left Column - Sidebar (Community or Topics) */}
                <div className={`${!isGlobal ? 'lg:col-span-1 xl:col-span-3 lg:block' : 'hidden xl:block xl:col-span-2'} order-2 lg:order-1 ${activeTab !== 'about' ? 'hidden' : 'block'}`}>
                    {isGlobal ? (
                        <TopicSidebar />
                    ) : community ? (
                        <CommunitySidebar community={community} showCreatePost={false} />
                    ) : (
                        <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                    )}
                </div>

                {/* Center Column - Main Feed */}
                <div className={`${!isGlobal ? 'lg:col-span-2 xl:col-span-6' : 'lg:col-span-12 xl:col-span-7'} order-1 lg:order-2`}>

                    {activeTab === 'posts' && (
                        <>
                            <StoryBar />
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-black text-[var(--text-primary)] leading-tight uppercase tracking-tight">
                                        {isGlobal ? (community?.title || (tagParam === 'friends' ? 'Friends Feed' : (tagParam ? `#${tagParam}` : 'Global Feed'))) : (community?.title || 'Community')}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1 w-8 bg-[var(--primary-color)] rounded-full" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Discovery Gateway</span>
                                    </div>
                                </div>

                                {/* Desktop Navigation Area */}
                                <div className="hidden md:flex items-center gap-4">
                                    {/* Tabs + More Dropdown */}
                                    <div className="flex items-center bg-[var(--bg-canvas)] p-1 rounded-xl border border-[var(--border-color)]">
                                        {[
                                            { id: 'trending', label: 'Trending' },
                                            { id: 'hot', label: 'Hot' },
                                            { id: 'new', label: 'New' }
                                        ].map(s => {
                                            const isActive = sort === (s.id === 'new' ? 'created' : s.id) &&
                                                !['friends', 'payout', 'muted'].includes(tagParam || '') &&
                                                !['friends', 'payout', 'muted'].includes(sortParam || '');
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        const path = isGlobal
                                                            ? `/posts/${s.id}${tagParam && tagParam !== 'friends' && !['payout', 'muted'].includes(tagParam) ? `/${tagParam}` : ''}`
                                                            : `/c/${config.id}/posts/${s.id}`;
                                                        navigate(path);
                                                    }}
                                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-white dark:bg-gray-800 text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                                >
                                                    {s.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="relative filters-dropdown">
                                        <button
                                            onClick={() => {
                                                setShowMoreFilters(!showMoreFilters);
                                                setShowReblogFilters(false);
                                            }}
                                            className={`px-4 py-2 flex items-center gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] transition-all active:scale-[0.98] ${['friends', 'payout', 'muted'].includes(tagParam || '') ||
                                                ['friends', 'payout', 'muted'].includes(sortParam || '')
                                                ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                                                : 'text-[var(--text-secondary)] hover:border-[var(--primary-color)]/30'
                                                }`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {tagParam === 'friends' || sortParam === 'friends' ? 'Friends' :
                                                    tagParam === 'payout' || sortParam === 'payout' ? 'Payouts' :
                                                        tagParam === 'muted' || sortParam === 'muted' ? 'Muted' : 'More'}
                                            </span>
                                            <svg className={`w-4 h-4 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {showMoreFilters && (
                                            <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl transition-all z-10 p-1">
                                                {user && (
                                                    <button
                                                        onClick={() => {
                                                            navigate('/posts/friends');
                                                            setShowMoreFilters(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${tagParam === 'friends' ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                    >
                                                        Friends
                                                    </button>
                                                )}
                                                {[
                                                    { id: 'payout', label: 'Payouts' },
                                                    { id: 'muted', label: 'Muted' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            const path = isGlobal ? `/posts/${opt.id}` : `/c/${config.id}/posts/${opt.id}`;
                                                            navigate(path);
                                                            setShowMoreFilters(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${sort === opt.id || tagParam === opt.id ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Desktop Reblog Toggle */}
                                    <div className="relative reblog-dropdown">
                                        <button
                                            onClick={() => {
                                                setShowReblogFilters(!showReblogFilters);
                                                setShowMoreFilters(false);
                                            }}
                                            className="px-4 py-2 flex items-center gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary-color)]/30 transition-all active:scale-[0.98]"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {excludeReblogs ? 'Exclude reblog' : 'Include reblog'}
                                            </span>
                                            <svg className={`w-4 h-4 transition-transform ${showReblogFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {showReblogFilters && (
                                            <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl transition-all z-10 p-1">
                                                <button
                                                    onClick={() => {
                                                        setExcludeReblogs(false);
                                                        setShowReblogFilters(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${!excludeReblogs ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                >
                                                    Include reblog
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setExcludeReblogs(true);
                                                        setShowReblogFilters(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${excludeReblogs ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                >
                                                    Exclude reblog
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Combined Navigation Area */}
                            <div className="flex md:hidden items-center gap-2 mb-2 w-full">
                                {/* Mobile Navigation: Unified "Feed" Dropdown */}
                                <div className="relative filters-dropdown flex-1">
                                    <button
                                        onClick={() => {
                                            setShowMoreFilters(!showMoreFilters);
                                            setShowReblogFilters(false);
                                        }}
                                        className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary-color)]/30 transition-all active:scale-[0.98] ${['friends', 'payout', 'muted'].includes(tagParam || '') || ['friends', 'payout', 'muted'].includes(sortParam || '')
                                            ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                                            : ''
                                            }`}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {sortParam === 'trending' || (!sortParam && !tagParam) ? 'Trending' :
                                                sortParam === 'hot' ? 'Hot' :
                                                    sortParam === 'new' ? 'New' :
                                                        tagParam === 'friends' || sortParam === 'friends' ? 'Friends' :
                                                            tagParam === 'payout' || sortParam === 'payout' ? 'Payouts' :
                                                                tagParam === 'muted' || sortParam === 'muted' ? 'Muted' : 'Feed'}
                                        </span>
                                        <svg className={`w-4 h-4 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {showMoreFilters && (
                                        <div className="absolute left-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl transition-all z-10 p-1">
                                            {user && (
                                                <button
                                                    onClick={() => {
                                                        navigate('/posts/friends');
                                                        setShowMoreFilters(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${tagParam === 'friends' || sortParam === 'friends' ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                >
                                                    Friends
                                                </button>
                                            )}
                                            {[
                                                { id: 'trending', label: 'Trending' },
                                                { id: 'hot', label: 'Hot' },
                                                { id: 'new', label: 'New' },
                                                { id: 'payout', label: 'Payouts' },
                                                { id: 'muted', label: 'Muted' }
                                            ].map(opt => {
                                                const isCurrent = (opt.id === 'trending' && (sortParam === 'trending' || (!sortParam && !tagParam))) ||
                                                    (opt.id === 'hot' && sortParam === 'hot') ||
                                                    (opt.id === 'new' && sortParam === 'new') ||
                                                    (opt.id === 'payout' && (sort === 'payout' || tagParam === 'payout')) ||
                                                    (opt.id === 'muted' && (sort === 'muted' || tagParam === 'muted'));

                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            const path = isGlobal ? `/posts/${opt.id}` : `/c/${config.id}/posts/${opt.id}`;
                                                            navigate(path);
                                                            setShowMoreFilters(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${isCurrent ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Mobile Reblog Toggle */}
                                <div className="relative reblog-dropdown flex-1">
                                    <button
                                        onClick={() => {
                                            setShowReblogFilters(!showReblogFilters);
                                            setShowMoreFilters(false);
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary-color)]/30 transition-all active:scale-[0.98]"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {excludeReblogs ? 'Exclude' : 'Include'}
                                        </span>
                                        <svg className={`w-4 h-4 transition-transform ${showReblogFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {showReblogFilters && (
                                        <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl transition-all z-10 p-1">
                                            <button
                                                onClick={() => {
                                                    setExcludeReblogs(false);
                                                    setShowReblogFilters(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${!excludeReblogs ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                            >
                                                Include reblog
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setExcludeReblogs(true);
                                                    setShowReblogFilters(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${excludeReblogs ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                            >
                                                Exclude reblog
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* Loading State */}
                            {loading && posts.length === 0 && (
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-48 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] animate-pulse" />
                                    ))}
                                </div>
                            )}

                            {/* Error State */}
                            {error && (
                                <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-900 mb-6">
                                    {error}
                                </div>
                            )}

                            {/* Posts List */}
                            {displayedPosts.length > 0 && (
                                <div className="space-y-6">
                                    {displayedPosts.map((post) => (
                                        <PostCard key={post.id} post={post} />
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {!loading && !error && posts.length === 0 && (
                                <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-xl border border-dashed border-[var(--border-color)]">
                                    No posts found for this community tag.
                                </div>
                            )}

                            {/* Sentinel & Loading Indicator */}
                            {/* Only show sentinel if we have content to scroll against */}
                            {posts.length > 0 && (
                                <>
                                    <div ref={sentinelRef} className="h-4 w-full pointer-events-none opacity-0" />
                                    {(hasMore || isFetchingMore) && (
                                        <div className="py-8 text-center flex justify-center">
                                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--primary-color)] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                                                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:0,0,0,0)]">Loading...</span>
                                            </div>
                                        </div>
                                    )}
                                    {!hasMore && !isFetchingMore && (
                                        <div className="py-8 text-center text-[var(--text-secondary)] text-sm">You've reached the end</div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {activeTab === 'about' && community && (
                        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-8 border border-[var(--border-color)]">
                            <h2 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">About {community.title}</h2>
                            <div className="prose max-w-none text-[var(--text-secondary)]">
                                <p className="whitespace-pre-wrap">{community.description || community.about}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'subscribers' && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Community Subscribers</h2>
                            </div>
                            <SubscriberList subscribers={subscribers} loading={subscribersLoading} />

                            {/* Infinite Scroll Sentinel for Subscribers */}
                            {subscribers.length > 0 && (
                                <>
                                    <div ref={sentinelRef} className="h-4 w-full pointer-events-none opacity-0" />
                                    {isFetchingMore && (
                                        <div className="py-8 text-center flex justify-center">
                                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--primary-color)] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                                                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:0,0,0,0)]">Loading...</span>
                                            </div>
                                        </div>
                                    )}
                                    {!hasMore && !isFetchingMore && (
                                        <div className="py-8 text-center text-[var(--text-secondary)] text-sm">You've reached the end</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'activities' && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Community Activities</h2>
                            </div>
                            <ActivityList activities={activities} loading={activitiesLoading} />

                            {/* Load More Button for Activities */}
                            {activities.length > 0 && hasMore && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMoreActivities}
                                        disabled={isFetchingMore}
                                        className="px-8 py-3 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl font-bold hover:bg-[var(--primary-color)] hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {isFetchingMore ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                Loading...
                                            </div>
                                        ) : 'Load More Activities'}
                                    </button>
                                </div>
                            )}

                            {!hasMore && activities.length > 0 && !isFetchingMore && (
                                <div className="py-8 text-center text-[var(--text-secondary)] text-sm">You've reached the end</div>
                            )}
                        </div>
                    )}

                </div>

                {/* Right Column - Leadership / Global Sidebar */}
                <div className={`lg:col-span-1 xl:col-span-3 order-3 space-y-6 ${activeTab !== 'about' ? 'hidden lg:block' : 'block'}`}>
                    {isGlobal ? (
                        <GlobalSidebar />
                    ) : community ? (
                        <>
                            {!['activities', 'about'].includes(activeTab) && (
                                <button
                                    onClick={() => navigate('/submit')}
                                    className="w-full py-3 bg-[var(--primary-color)] text-white rounded-lg font-bold shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 mb-6"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Create Post
                                </button>
                            )}
                            <CommunityLeadership community={community} />
                        </>
                    ) : (
                        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                    )}
                </div>

            </div>
        </div >
    );
}
