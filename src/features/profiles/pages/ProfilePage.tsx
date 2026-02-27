import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UnifiedDataService, Post } from '../../../services/unified';
import { PostCard } from '../../feed/components/PostCard';
import { CommentCard } from '../components/CommentCard';
import { WalletView } from '../components/WalletView';
import { useCommunity } from '../../community/context/CommunityContext';
import { MapPin, Globe, Calendar, Rss, Shield, Search, ChevronDown, X } from 'lucide-react';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [showMoreTabs, setShowMoreTabs] = useState(false);
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
            setSearchQuery(''); // Clear previous search queries

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
        setSearchQuery(''); // Reset search on tab change
        setIsSearchExpanded(false);
        setShowMoreTabs(false);
        navigate(`/@${username}/${tab}`);
    };

    // Client-side text search over the currently loaded feed (posts/comments)
    const filteredFeed = useMemo(() => {
        if (!searchQuery.trim()) return feed;
        const lowerQuery = searchQuery.toLowerCase();
        return feed.filter(post =>
            post.title?.toLowerCase().includes(lowerQuery) ||
            post.body?.toLowerCase().includes(lowerQuery)
        );
    }, [feed, searchQuery]);

    if (!username) return <div>User not found</div>;
    if (loading && !profile) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading profile...</div>;

    const hasCover = profile?.cover_url && !coverError;

    return (
        <div className="max-w-[1400px] mx-auto pb-12 px-4 md:px-8 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column - Profile Sidebar */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Unified Profile Card */}
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                        {/* Shorter Cover Image */}
                        <div className={`h-32 relative ${!hasCover ? 'bg-gradient-to-r from-[var(--primary-color)] to-[var(--secondary-color)]' : 'bg-gray-200 dark:bg-gray-800'}`}>
                            {hasCover ? (
                                <img
                                    src={profile?.cover_url}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                    onError={() => setCoverError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-20">
                                    <span className="text-5xl">👤</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>

                        {/* Profile Info */}
                        <div className="px-6 pb-6 relative">
                            {/* Floating Avatar */}
                            <div className="absolute -top-12 left-6">
                                <div className="relative">
                                    <img
                                        src={`https://images.hive.blog/u/${username?.toLowerCase()}/avatar/large`}
                                        alt={username}
                                        className="w-24 h-24 rounded-full border-4 border-[var(--bg-card)] shadow-md object-cover bg-[var(--bg-canvas)]"
                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://images.hive.blog/u/hive-106130/avatar/large`; }}
                                    />
                                    <div className="absolute bottom-0 right-0 bg-[var(--primary-color)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[var(--bg-card)] shadow-sm">
                                        {profile?.reputation || 25}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-14">
                                <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">
                                    {profile?.name || username}
                                </h1>
                                <p className="text-sm font-medium text-[var(--text-secondary)] mb-4">@{username}</p>

                                {/* Bio */}
                                {profile?.metadata?.profile?.about ? (
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 whitespace-pre-wrap">
                                        {profile.metadata.profile.about}
                                    </p>
                                ) : (
                                    <p className="text-sm text-[var(--text-secondary)] italic mb-6">No bio provided.</p>
                                )}

                                {/* Action Buttons */}
                                {currentUser !== username && (
                                    <div className="flex flex-col gap-2 mb-6">
                                        <button
                                            onClick={handleFollow}
                                            disabled={actionLoading}
                                            className={`w-full py-2 rounded-lg font-bold transition-all text-sm ${isFollowing
                                                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                                                : 'bg-[var(--primary-color)] text-white hover:brightness-110 shadow-sm'
                                                }`}
                                        >
                                            {isFollowing ? 'Unfollow' : 'Follow'}
                                        </button>
                                        <button
                                            onClick={handleMute}
                                            disabled={actionLoading}
                                            className={`w-full py-2 rounded-lg font-bold transition-all text-sm border ${isMuted
                                                ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'
                                                : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-canvas)]'
                                                }`}
                                        >
                                            {isMuted ? 'Unmute' : 'Mute'}
                                        </button>
                                    </div>
                                )}

                                {/* Stats Block */}
                                <div className="flex justify-between items-center py-3 border-y border-[var(--border-color)] mb-4">
                                    <div className="text-center flex-1">
                                        <span className="block text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">Followers</span>
                                        <span className="text-sm font-bold text-[var(--text-primary)]">{profile?.stats?.followers?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="w-px h-6 bg-[var(--border-color)]" />
                                    <div className="text-center flex-1">
                                        <span className="block text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">Following</span>
                                        <span className="text-sm font-bold text-[var(--text-primary)]">{profile?.stats?.following?.toLocaleString() || 0}</span>
                                    </div>
                                </div>

                                {/* Extra Details */}
                                <div className="space-y-3">
                                    {profile?.metadata?.profile?.location && (
                                        <div className="flex items-start gap-3">
                                            <MapPin size={16} className="text-[var(--text-secondary)] mt-0.5" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Location</span>
                                                <span className="text-sm text-[var(--text-primary)]">{profile.metadata.profile.location}</span>
                                            </div>
                                        </div>
                                    )}

                                    {profile?.metadata?.profile?.website && (
                                        <div className="flex items-start gap-3">
                                            <Globe size={16} className="text-[var(--text-secondary)] mt-0.5" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Website</span>
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
                                            <Calendar size={16} className="text-[var(--text-secondary)] mt-0.5" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Joined</span>
                                                <span className="text-sm text-[var(--text-primary)]">
                                                    {new Date(profile.created).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3">
                                        <Rss size={16} className="text-[var(--text-secondary)] mt-0.5" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">RSS Feed</span>
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
                                </div>

                                {/* Moderated Communities */}
                                {profile?.metadata?.profile?.communities && profile.metadata.profile.communities.length > 0 && (
                                    <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
                                        <h4 className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                                            <Shield size={14} className="text-[var(--primary-color)]" />
                                            Moderator of:
                                        </h4>
                                        <div className="space-y-2">
                                            {profile.metadata.profile.communities.map((comm: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 group cursor-pointer hover:bg-[var(--bg-canvas)] p-1.5 rounded-lg transition-all rounded">
                                                    <img
                                                        src={`https://images.hive.blog/u/${comm}/avatar/small`}
                                                        alt={comm}
                                                        className="w-6 h-6 rounded-full bg-gray-200 border border-[var(--border-color)]"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/hive-106130/avatar/small'; }}
                                                    />
                                                    <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-color)]">{comm}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Navigation Tabs & Main Content Feed */}
                <div className="lg:col-span-9 space-y-6">
                    {/* Floating Glass Navigation Tabs & Search */}
                    <div className="sticky top-[84px] z-20 mb-2 flex items-center justify-end gap-2 md:justify-between w-full h-[52px]">
                        {/* Mobile & Desktop Tabs Group */}
                        <div className={`flex items-center gap-2 transition-all duration-300 ${isSearchExpanded ? 'w-0 opacity-0 overflow-hidden md:w-auto md:opacity-100' : 'w-full opacity-100 mr-auto'}`}>
                            {/* Desktop Tabs (All visible) */}
                            <div className="hidden md:inline-flex gap-1 md:gap-2 p-1.5 bg-[var(--bg-card)]/80 backdrop-blur-xl rounded-2xl border border-[var(--border-color)] shadow-sm overflow-x-auto no-scrollbar whitespace-nowrap">
                                {validTabs.map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => handleTabChange(tab)}
                                        className={`px-4 md:px-5 py-2 md:py-2.5 rounded-xl transition-all capitalize whitespace-nowrap text-xs md:text-sm font-medium ${activeTab === tab
                                            ? 'bg-[var(--primary-color)] text-white shadow-md font-bold'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
                                            }`}
                                    >
                                        {tab === 'community' ? (config?.name || 'Community') : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Mobile Tabs (Limited + Dropdown) */}
                            <div className="md:hidden flex items-center gap-1 p-1.5 bg-[var(--bg-card)]/80 backdrop-blur-xl rounded-2xl border border-[var(--border-color)] shadow-sm flex-nowrap w-fit">
                                {/* Primary Mobile Tabs */}
                                {['blog', 'posts'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => handleTabChange(tab)}
                                        className={`px-4 py-2 rounded-xl transition-all capitalize whitespace-nowrap text-xs font-medium ${activeTab === tab
                                            ? 'bg-[var(--primary-color)] text-white shadow-md font-bold'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}

                                {/* Mobile More Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowMoreTabs(!showMoreTabs)}
                                        className={`px-3 py-2 flex items-center gap-1 rounded-xl transition-all capitalize whitespace-nowrap text-xs font-medium ${['comments', 'replies', 'wallet', 'community'].includes(activeTab)
                                            ? 'bg-[var(--primary-color)] text-white shadow-md font-bold'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
                                            }`}
                                    >
                                        {['comments', 'replies', 'wallet', 'community'].includes(activeTab) ? (activeTab === 'community' ? config?.name || 'Community' : activeTab) : 'More'}
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${showMoreTabs ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showMoreTabs && (
                                        <div className="absolute left-0 mt-2 w-40 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl transition-all z-30 p-1 flex flex-col gap-1">
                                            {['comments', 'replies', 'wallet', ...(config?.id === 'global' ? [] : ['community'])].map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => handleTabChange(tab)}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all capitalize ${activeTab === tab ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'}`}
                                                >
                                                    {tab === 'community' ? (config?.name || 'Community') : tab}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Expanding Search Bar */}
                        {activeTab !== 'wallet' && (
                            <div className={`flex items-center shrink-0 bg-[var(--bg-card)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl transition-all duration-300 shadow-sm ${isSearchExpanded ? 'w-full md:w-64 px-4 py-2 opacity-100 h-full' : 'w-[48px] h-[48px] justify-center opacity-80 hover:opacity-100'}`}>
                                <button
                                    onClick={() => setIsSearchExpanded(true)}
                                    className={`text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors ${isSearchExpanded ? 'shrink-0' : 'w-full h-full flex items-center justify-center'}`}
                                >
                                    <Search size={18} />
                                </button>
                                {isSearchExpanded && (
                                    <>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder={`Search ${activeTab}...`}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onBlur={() => { if (!searchQuery) setIsSearchExpanded(false) }}
                                            className="w-full bg-transparent border-none outline-none text-sm text-[var(--text-primary)] ml-3 placeholder:text-[var(--text-secondary)]"
                                        />
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                setIsSearchExpanded(false);
                                            }}
                                            className="shrink-0 p-1 ml-1 text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:bg-[var(--bg-canvas)] rounded-full transition-colors"
                                            aria-label="Close search"
                                        >
                                            <X size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Feed Output */}
                    <div className="mt-4">
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
                                    <div key={i} className="h-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl" />
                                ))}
                            </div>
                        ) : filteredFeed.length === 0 ? (
                            <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-sm">
                                <span className="text-4xl block mb-4">📭</span>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">No content found</h3>
                                <p className="text-sm">{searchQuery ? `No matches found for "${searchQuery}"` : "There is nothing to display in this section yet."}</p>
                            </div>
                        ) : activeTab === 'comments' || activeTab === 'replies' ? (
                            <div className="space-y-4">
                                {filteredFeed.map(post => <CommentCard key={post.id} post={post} />)}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredFeed.map(post => <PostCard key={post.id} post={post} />)}
                                {loadingMore && !searchQuery && (
                                    <div className="py-4 text-center text-sm font-medium text-[var(--text-secondary)] animate-pulse">
                                        Loading more...
                                    </div>
                                )}
                                {!hasMore && filteredFeed.length > 0 && !searchQuery && (
                                    <div className="py-8 text-center text-sm font-medium text-[var(--text-secondary)]">
                                        You've reached the end.
                                    </div>
                                )}
                                {searchQuery && hasMore && (
                                    <div className="py-8 text-center text-sm font-medium text-[var(--text-secondary)]">
                                        Clear search to load more posts...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
