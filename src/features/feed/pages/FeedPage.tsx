import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { UnifiedDataService, Post, CommunityDetails } from '../../../services/unified';
import { PostCard } from '../components/PostCard';
import { CommunityHeader } from '../../community/components/CommunityHeader';
import { CommunitySidebar } from '../../community/components/CommunitySidebar';
import { CommunityLeadership } from '../../community/components/CommunityLeadership';
import { SubscriberList } from '../../community/components/SubscriberList';
import { ActivityList } from '../../community/components/ActivityList';
import { Subscriber, Activity } from '../../../services/unified';
import { StoryBar } from '../../stories/components/StoryBar';

export default function FeedPage() {
    const { config } = useCommunity();
    const navigate = useNavigate();
    const { sort: sortParam } = useParams();
    const location = useLocation();

    // Derive active tab from path (look for the keyword anywhere to handle community params)
    const activeTab = location.pathname.includes('/about') ? 'about' :
        location.pathname.includes('/subscribers') ? 'subscribers' :
            location.pathname.includes('/activities') ? 'activities' : 'posts';

    // Sort mapping: map url sort to API sort
    // trending -> trending, new -> created, hot -> hot
    const getSortFromParam = (param: string | undefined): 'created' | 'trending' | 'hot' => {
        if (param === 'new') return 'created';
        if (param === 'hot') return 'hot';
        return 'trending'; // default
    };

    const sort = getSortFromParam(sortParam);

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
            const details = await UnifiedDataService.getCommunityDetails(config.id);
            setCommunity(details);
        }
        fetchDetails();
    }, [config]);

    // Initial Feed Load
    useEffect(() => {
        async function loadFeed() {
            if (!config) return;

            setLoading(true);
            setError(null);
            try {
                const data = await UnifiedDataService.getCommunityFeed(config.id, sort, 20);
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
    }, [config, sort, activeTab]);

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
            const newData = await UnifiedDataService.getCommunityFeed(
                config.id,
                sort,
                20,
                lastPost.author,
                lastPost.permlink
            );

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
    }, [config, loading, isFetchingMore, hasMore, posts, sort]);

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
    }, [hasMore, isFetchingMore, loading, loadMore, activeTab]);

    if (!config) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading community configuration...</div>;

    return (
        <div className="max-w-[1400px] mx-auto pb-12 px-4 md:px-8">

            {/* 1. Community Header (Banner & Stats) */}
            <div className="mt-6">
                {community ? (
                    <CommunityHeader
                        community={community}
                    />
                ) : (
                    // Skeleton Header
                    <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse mb-6" />
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-12 gap-8">

                {/* Left Column - Sidebar (XL: 3 columns) */}
                <div className={`lg:col-span-1 xl:col-span-3 order-2 lg:order-1 ${activeTab !== 'about' ? 'hidden lg:block' : 'block'}`}>
                    {community ? (
                        <CommunitySidebar community={community} showCreatePost={false} />
                    ) : (
                        <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                    )}
                </div>

                {/* Center Column - Main Feed (XL: 6 columns) */}
                <div className="lg:col-span-2 xl:col-span-6 order-1 lg:order-2">

                    {activeTab === 'posts' && (
                        <>
                            <StoryBar />
                            {/* Sort Controls */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Community Posts</h2>
                                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-1 rounded-lg flex text-sm font-medium shadow-sm">
                                    <button
                                        onClick={() => navigate('/posts/new')}
                                        className={`px-3 py-1.5 rounded-md transition-colors ${sort === 'created' ? 'bg-[var(--primary-color)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        New
                                    </button>
                                    <button
                                        onClick={() => navigate('/posts/trending')}
                                        className={`px-3 py-1.5 rounded-md transition-colors ${sortParam === 'trending' || !sortParam ? 'bg-[var(--primary-color)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Trending
                                    </button>
                                    <button
                                        onClick={() => navigate('/posts/hot')}
                                        className={`px-3 py-1.5 rounded-md transition-colors ${sort === 'hot' ? 'bg-[var(--primary-color)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Hot
                                    </button>
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
                            {posts.length > 0 && (
                                <div className="space-y-6">
                                    {posts.map((post) => (
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

                {/* Right Column - Leadership (XL: 3 columns) */}
                <div className={`lg:col-span-1 xl:col-span-3 order-3 space-y-6 ${activeTab !== 'about' ? 'hidden lg:block' : 'block'}`}>
                    {community ? (
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
        </div>
    );
}
