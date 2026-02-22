import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UnifiedDataService, Post } from '../../../services/unified';
import { PostCard } from '../../feed/components/PostCard';
import { CommentCard } from '../components/CommentCard';
import { WalletView } from '../components/WalletView';
import { useCommunity } from '../../community/context/CommunityContext';
import { MapPin, Globe, Calendar, Rss, Shield } from 'lucide-react';

export default function ProfilePage() {
    const params = useParams();
    const rawUsername = params.username;
    const section = params.section;
    const { config } = useCommunity();

    // Handle @ prefix from URL (React Router v6 doesn't support partial matching like @:username)
    const username = rawUsername?.startsWith('@') ? rawUsername.substring(1) : rawUsername;

    console.log("ProfilePage Params:", { rawUsername, username, section });

    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);

    // valid tabs - Prioritize the community tab for platform focus
    const validTabs = ['community', 'blog', 'posts', 'comments', 'replies', 'wallet'];
    const activeTab = (section && validTabs.includes(section)) ? section : 'community';

    const [feed, setFeed] = useState<Post[]>([]);
    const [wallet, setWallet] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [contentLoading, setContentLoading] = useState(false);
    const [coverError, setCoverError] = useState(false);
    const [currentUser] = useState<string | null>(localStorage.getItem('hive_user'));

    const [isFollowing, setIsFollowing] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!username) return;

        // Fetch Profile Data
        const fetchProfile = async () => {
            setLoading(true);
            const data = await UnifiedDataService.getProfile(username, currentUser || undefined);
            setProfile(data);
            if (data?.metadata?.context) {
                setIsFollowing(data.metadata.context.followed);
                setIsMuted(data.metadata.context.muted);
            }
            setLoading(false);
        };

        fetchProfile();
    }, [username, currentUser]);

    const handleFollow = async () => {
        if (!currentUser) {
            alert('Please login to follow users');
            return;
        }
        setActionLoading(true);
        const success = await UnifiedDataService.followUser(currentUser, username!, isFollowing);
        if (success) {
            setIsFollowing(!isFollowing);
            // Optimistically update stats if we want, but usually better to wait for indexer
        }
        setActionLoading(false);
    };

    const handleMute = async () => {
        if (!currentUser) {
            alert('Please login to mute users');
            return;
        }
        setActionLoading(true);
        const success = await UnifiedDataService.muteUser(currentUser, username!, isMuted);
        if (success) {
            setIsMuted(!isMuted);
        }
        setActionLoading(false);
    };

    const [historyLoading, setHistoryLoading] = useState(false);

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Fetch Content (Feed or Wallet) when tab or username changes
    useEffect(() => {
        if (!username) return;

        const fetchContent = async () => {
            setContentLoading(true);
            setHasMore(true); // Reset hasMore on tab change
            setFeed([]); // Clear previous feed to avoid flicker

            if (activeTab === 'wallet') {
                if (!wallet || wallet.username !== username) { // Fetch if not loaded or user changed
                    const [walletData, history] = await Promise.all([
                        UnifiedDataService.getWallet(username),
                        UnifiedDataService.getAccountHistory(username)
                    ]);
                    setWallet({ ...walletData, history, username }); // Store username to invalidate on change
                }
            } else if (activeTab === 'community') {
                if (config?.id) {
                    const data = await UnifiedDataService.getUserCommunityPosts(username, config.id);
                    setFeed(data);
                    if (data.length < 20) setHasMore(false);
                }
            } else {
                const data = await UnifiedDataService.getUserFeed(username, activeTab as 'blog' | 'posts' | 'comments' | 'replies');
                setFeed(data);
                if (data.length < 20) setHasMore(false);
            }

            setContentLoading(false);
        };

        fetchContent();
    }, [username, activeTab, config?.id]);

    // Infinite Scroll Handler
    useEffect(() => {
        const handleScroll = () => {
            if (
                window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000 &&
                !loadingMore &&
                hasMore &&
                activeTab !== 'wallet' &&
                !contentLoading
            ) {
                loadMorePosts();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loadingMore, hasMore, activeTab, contentLoading, feed]);

    const loadMorePosts = async () => {
        if (feed.length === 0 || loadingMore) return;

        setLoadingMore(true);
        const lastPost = feed[feed.length - 1];

        try {
            let newPosts: Post[] = [];

            if (activeTab === 'community') {
                if (config?.id) {
                    newPosts = await UnifiedDataService.getUserCommunityPosts(
                        username!,
                        config.id,
                        20,
                        lastPost.author,
                        lastPost.permlink
                    );
                }
            } else {
                newPosts = await UnifiedDataService.getUserFeed(
                    username!,
                    activeTab as 'blog' | 'posts' | 'comments' | 'replies',
                    20,
                    lastPost.author,
                    lastPost.permlink
                );
            }

            if (newPosts.length === 0) {
                setHasMore(false);
            } else {
                setFeed(prev => [...prev, ...newPosts]);
                if (newPosts.length < 19) setHasMore(false); // < 19 because one is sliced off usually
            }
        } catch (error) {
            console.error("Failed to load more posts:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleLoadMoreHistory = async () => {
        if (!wallet?.history || historyLoading) return;

        const lastTx = wallet.history[wallet.history.length - 1];
        if (!lastTx) return;

        setHistoryLoading(true);
        // Start from last ID - 1 to get next page
        const moreHistory = await UnifiedDataService.getAccountHistory(username!, lastTx.id - 1, 20);

        if (moreHistory.length > 0) {
            setWallet((prev: any) => ({
                ...prev,
                history: [...prev.history, ...moreHistory]
            }));
        }
        setHistoryLoading(false);
    };

    const handleTabChange = (tab: string) => {
        navigate(`/@${username}/${tab}`);
    };

    if (!username) return <div>User not found</div>;
    if (loading && !profile) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading profile...</div>;

    const avatar = profile?.avatar_url || `https://images.hive.blog/u/${username}/avatar/large`;
    const hasCover = profile?.cover_url && !coverError;

    return (
        <div className="max-w-[1400px] mx-auto pb-12 px-4 md:px-6">
            {/* Header Section */}
            <div className="relative mb-8 group">
                {/* Cover Image or Gradient */}
                <div className={`h-64 md:h-80 rounded-xl overflow-hidden ${!hasCover ? 'bg-gradient-to-r from-[var(--primary-color)] to-[var(--secondary-color)]' : 'bg-gray-200 dark:bg-gray-800'} relative`}>
                    {hasCover ? (
                        <img
                            src={profile.cover_url}
                            alt="Cover"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            onError={() => setCoverError(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                            <span className="text-9xl">👤</span>
                        </div>
                    )}

                    {/* Gradient Overlay for text readability if no glass card used, but we use glass card */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                </div>

                {/* Glassmorphism Profile Card Overlay */}
                <div className="absolute bottom-0 left-0 w-full md:w-auto md:max-w-2xl md:bottom-8 md:left-8 p-4 md:p-0">
                    <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl p-6 text-white shadow-2xl">
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                            {/* Avatar */}
                            <div className="relative">
                                <img
                                    src={avatar}
                                    alt={username}
                                    className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white/20 shadow-lg object-cover"
                                />
                                <div className="absolute -bottom-2 -right-2 bg-[var(--primary-color)] text-white text-xs font-bold px-2 py-1 rounded-full border border-white/20">
                                    {profile?.reputation || 25}
                                </div>
                            </div>

                            {/* Details */}
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                                    {profile?.name || username}
                                </h1>
                                <p className="text-white/70 font-medium">@{username}</p>
                            </div>

                            {/* Actions (Desktop) */}
                            {currentUser !== username && (
                                <div className="hidden md:flex flex-col gap-2">
                                    <button
                                        onClick={handleFollow}
                                        disabled={actionLoading}
                                        className={`px-6 py-2 rounded-full font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 min-w-[120px] ${isFollowing
                                                ? 'bg-white/10 text-white border border-white/20 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-500 group'
                                                : 'bg-white text-black hover:bg-gray-200'
                                            }`}
                                    >
                                        {isFollowing ? (
                                            <>
                                                <span className="group-hover:hidden">Following</span>
                                                <span className="hidden group-hover:inline">Unfollow</span>
                                            </>
                                        ) : 'Follow'}
                                    </button>
                                    <button
                                        onClick={handleMute}
                                        disabled={actionLoading}
                                        className={`px-6 py-2 rounded-full font-bold transition-all backdrop-blur-md border min-w-[120px] ${isMuted
                                                ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                                                : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                                            }`}
                                    >
                                        {isMuted ? 'Muted' : 'Mute'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--border-color)] mb-6 sticky top-16 bg-[var(--bg-canvas)]/95 backdrop-blur z-10 transition-colors duration-300">
                <div className="max-w-4xl mx-auto flex gap-8 px-4 md:px-8 overflow-x-auto no-scrollbar">
                    {validTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            className={`pb-3 border-b-2 transition-colors capitalize whitespace-nowrap ${activeTab === tab
                                ? 'border-[var(--primary-color)] text-[var(--text-primary)] font-bold'
                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            {tab === 'community' ? (config?.name || 'Community') : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Section with Sidebar */}
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Main Feed */}
                    <div className="lg:col-span-8 space-y-6">
                        {activeTab === 'wallet' ? (
                            <WalletView
                                wallet={wallet}
                                history={wallet?.history || []}
                                username={username}
                                loading={contentLoading}
                                onLoadMore={handleLoadMoreHistory}
                                loadingHistory={historyLoading}
                            />
                        ) : contentLoading ? (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                                ))}
                            </div>
                        ) : feed.length === 0 ? (
                            <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
                                No content found in this section.
                            </div>
                        ) : activeTab === 'comments' || activeTab === 'replies' ? (
                            feed.map(post => <CommentCard key={post.id} post={post} />)
                        ) : (
                            <>
                                {feed.map(post => <PostCard key={post.id} post={post} />)}
                                {loadingMore && (
                                    <div className="py-4 text-center text-sm text-[var(--text-secondary)]">
                                        Loading more posts...
                                    </div>
                                )}
                                {!hasMore && feed.length > 0 && (
                                    <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                                        You've reached the end.
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* About Card */}
                        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-6 border border-[var(--border-color)]">
                            <h3 className="font-bold text-[var(--text-primary)] mb-4">About {profile?.name || username}</h3>
                            {profile?.metadata?.profile?.about ? (
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 whitespace-pre-wrap text-sm">
                                    {profile.metadata.profile.about}
                                </p>
                            ) : (
                                <p className="text-sm text-[var(--text-secondary)] italic mb-6">No bio provided.</p>
                            )}

                            <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
                                {profile?.metadata?.profile?.location && (
                                    <div className="flex items-start gap-3">
                                        <MapPin size={18} className="text-[var(--text-secondary)] mt-0.5" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Location</span>
                                            <span className="text-sm text-[var(--text-primary)]">{profile.metadata.profile.location}</span>
                                        </div>
                                    </div>
                                )}

                                {profile?.metadata?.profile?.website && (
                                    <div className="flex items-start gap-3">
                                        <Globe size={18} className="text-[var(--text-secondary)] mt-0.5" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Website</span>
                                            <a
                                                href={profile.metadata.profile.website.startsWith('http') ? profile.metadata.profile.website : `https://${profile.metadata.profile.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-[var(--primary-color)] hover:underline break-all"
                                            >
                                                {profile.metadata.profile.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {profile?.created && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={18} className="text-[var(--text-secondary)] mt-0.5" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Joined</span>
                                            <span className="text-sm text-[var(--text-primary)]">
                                                {new Date(profile.created).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-3">
                                    <Rss size={18} className="text-[var(--text-secondary)] mt-0.5" />
                                    <div className="flex flex-col">
                                        <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">RSS Feed</span>
                                        <a
                                            href={`https://hive.blog/@${username}/feed`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-[var(--primary-color)] hover:underline"
                                        >
                                            Subscribe
                                        </a>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center py-2 px-3 bg-[var(--bg-canvas)] rounded-lg mt-4 border border-[var(--border-color)]">
                                    <div className="text-center flex-1">
                                        <span className="block text-xs text-[var(--text-secondary)] uppercase font-bold">Followers</span>
                                        <span className="text-lg font-bold text-[var(--text-primary)]">{profile?.stats?.followers?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="w-px h-8 bg-[var(--border-color)]" />
                                    <div className="text-center flex-1">
                                        <span className="block text-xs text-[var(--text-secondary)] uppercase font-bold">Following</span>
                                        <span className="text-lg font-bold text-[var(--text-primary)]">{profile?.stats?.following?.toLocaleString() || 0}</span>
                                    </div>
                                </div>

                                {profile?.metadata?.profile?.communities && profile.metadata.profile.communities.length > 0 && (
                                    <div className="pt-6 border-t border-[var(--border-color)] mt-6">
                                        <h4 className="text-xs text-[var(--text-secondary)] uppercase font-bold mb-4 flex items-center gap-2">
                                            <Shield size={14} className="text-[var(--primary-color)]" />
                                            Moderator of these communities
                                        </h4>
                                        <div className="space-y-3">
                                            {profile.metadata.profile.communities.map((comm: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-3 group cursor-pointer hover:bg-[var(--bg-canvas)] p-2 rounded-lg transition-all">
                                                    <img
                                                        src={`https://images.hive.blog/u/${comm}/avatar/small`}
                                                        alt={comm}
                                                        className="w-8 h-8 rounded-full bg-gray-200 border border-[var(--border-color)]"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/hive-106130/avatar/small'; }}
                                                    />
                                                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--primary-color)]">{comm}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
