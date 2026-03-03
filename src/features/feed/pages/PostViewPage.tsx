import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UnifiedDataService, Post } from '../../../services/unified';
import HiveMarkdown from '../../../components/HiveMarkdown';
import { CommentBox } from '../components/CommentBox';
import { CommentCard } from '../../profiles/components/CommentCard';
import { VoteSlider } from '../components/VoteSlider';
import { VoterListModal } from '../components/VoterListModal';
import { ThumbsUp, Repeat, MessageSquare, Volume2, Clock, BookOpen, X, Search, ChevronLeft, Share, Bookmark, MoreHorizontal, History, Zap, DollarSign, Shield } from 'lucide-react';
import { transactionService } from '../../wallet/services/transactionService';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { useNotification } from '../../../contexts/NotificationContext';
import { ShareModal } from '../../../components/ShareModal';


export default function PostViewPage() {
    const { author, permlink } = useParams();
    const { showNotification, showConfirm } = useNotification();
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showVoters, setShowVoters] = useState(false);
    const [showPayoutDetails, setShowPayoutDetails] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showCrossPostModal, setShowCrossPostModal] = useState(false);
    const [showEditHistory, setShowEditHistory] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);

    const [scrollProgress, setScrollProgress] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [postVersions, setPostVersions] = useState<any[]>([]);
    const [communities, setCommunities] = useState<any[]>([]);
    const [communitySearch, setCommunitySearch] = useState('');
    const [isCrossPosting, setIsCrossPosting] = useState(false);
    const [loadingCommunities, setLoadingCommunities] = useState(false);
    const [authorPosts, setAuthorPosts] = useState<Post[]>([]);
    const [loadingAuthorPosts, setLoadingAuthorPosts] = useState(false);
    const [loadingMoreAuthorPosts, setLoadingMoreAuthorPosts] = useState(false);
    const [hasMoreAuthorPosts, setHasMoreAuthorPosts] = useState(true);
    const [suggestedPosts, setSuggestedPosts] = useState<Post[]>([]);
    const [loadingSuggestedPosts, setLoadingSuggestedPosts] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);

    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [showVoteSlider, setShowVoteSlider] = useState(false);
    const [reblogging, setReblogging] = useState(false);
    const [reblogged, setReblogged] = useState(false);
    const [isHoveringReblog, setIsHoveringReblog] = useState(false);

    useEffect(() => {
        if (loading) return;

        const isDesktop = window.innerWidth >= 1024;
        const scrollTarget = isDesktop ? mainContentRef.current : window;

        const handleScroll = () => {
            const el = isDesktop ? mainContentRef.current : document.documentElement;
            if (!el) return;

            // Scroll Progress
            const totalScroll = isDesktop ? (el as HTMLElement).scrollTop : window.scrollY;
            const windowHeight = isDesktop
                ? (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight
                : document.documentElement.scrollHeight - window.innerHeight;

            const scroll = windowHeight > 0 ? (totalScroll / windowHeight) : 0;
            setScrollProgress(scroll);

            // Show Scroll Top sooner
            if (totalScroll > 300) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        if (scrollTarget) {
            scrollTarget.addEventListener('scroll', handleScroll);
        }

        // Body lock for desktop
        if (isDesktop) {
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.speechSynthesis.cancel();
            if (scrollTarget) {
                scrollTarget.removeEventListener('scroll', handleScroll);
            }
            document.body.style.overflow = '';
        };
    }, [loading]);

    useEffect(() => {
        async function loadPostAndComments() {
            if (!author || !permlink) return;

            setLoading(true);
            setError(null);
            try {
                const observer = localStorage.getItem('hive_user') || '';
                const data = await UnifiedDataService.getPost(author, permlink, observer);
                if (data) {
                    setPost(data);

                } else {
                    setError("Post not found");
                }
            } catch (err) {
                console.error("Failed to load post", err);
                setError("Failed to load post. Please try again.");
            } finally {
                setLoading(false);
            }
        }

        loadPostAndComments();
    }, [author, permlink]);

    useEffect(() => {
        async function loadAuthorPosts() {
            if (!author || !post) return;
            setLoadingAuthorPosts(true);
            try {
                const posts = await UnifiedDataService.getUserFeed(author, 'posts', 6);
                // Filter out current post
                setAuthorPosts(posts.filter(p => p.permlink !== permlink).slice(0, 5));
                if (posts.length < 6) setHasMoreAuthorPosts(false);
            } catch (err) {
                console.error("Failed to load author posts", err);
            } finally {
                setLoadingAuthorPosts(false);
            }
        }
        loadAuthorPosts();
    }, [author, post, permlink]);

    const handleLoadMoreAuthorPosts = async () => {
        if (!author || loadingMoreAuthorPosts || !hasMoreAuthorPosts) return;
        setLoadingMoreAuthorPosts(true);
        try {
            const lastPost = authorPosts[authorPosts.length - 1];
            if (!lastPost) return;

            // Fetch more, limit 6. Since start_permlink includes the last post, we get 6 posts total
            const morePosts = await UnifiedDataService.getUserFeed(author, 'posts', 6, lastPost.author, lastPost.permlink);

            // Filter out the last post (which is the starting point) and the current post in view
            const filteredNew = morePosts.filter(p => p.permlink !== permlink && p.permlink !== lastPost.permlink);

            setAuthorPosts(prev => [...prev, ...filteredNew]);

            if (morePosts.length < 6) {
                setHasMoreAuthorPosts(false);
            }
        } catch (err) {
            console.error("Failed to load more author posts", err);
        } finally {
            setLoadingMoreAuthorPosts(false);
        }
    };

    useEffect(() => {
        async function loadSuggestedPosts() {
            setLoadingSuggestedPosts(true);
            try {
                // Fetch trending global posts for discovery
                const posts = await UnifiedDataService.getCommunityFeed('global', 'trending', 15);
                // Filter out current author's posts and current post to ensure diversity
                setSuggestedPosts(posts.filter(p => p.author !== author && p.permlink !== permlink).slice(0, 5));
            } catch (err) {
                console.error("Failed to load suggested posts", err);
            } finally {
                setLoadingSuggestedPosts(false);
            }
        }
        loadSuggestedPosts();
    }, [author, permlink]);

    useEffect(() => {
        if (!post) return;
        // SEO Metadata
        document.title = `${post.title} | Breakaway`;

        // Find first image for social preview if available
        const firstImg = post.body.match(/!\[.*?\]\((.*?)\)/)?.[1] ||
            post.body.match(/<img.*?src=["'](.*?)["']/)?.[1] ||
            `https://images.hive.blog/u/${post.author}/avatar/large`;

        // Update meta tags dynamically
        const metaTags = {
            'description': post.body.substring(0, 160).replace(/[#*`]/g, '') + '...',
            'og:title': post.title,
            'og:description': post.body.substring(0, 160).replace(/[#*`]/g, '') + '...',
            'og:image': firstImg,
            'twitter:card': 'summary_large_image',
            'twitter:title': post.title,
            'twitter:description': post.body.substring(0, 160).replace(/[#*`]/g, '') + '...',
            'twitter:image': firstImg
        };

        Object.entries(metaTags).forEach(([name, content]) => {
            let element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            if (!element) {
                element = document.createElement('meta');
                if (name.startsWith('og:')) element.setAttribute('property', name);
                else element.setAttribute('name', name);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        });

        return () => {
            document.title = 'Breakaway';
        };
    }, [post]);

    const handleVote = async (weight: number) => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to vote", 'warning');
            return;
        }

        if (!post) return;

        setVoting(true);

        const result = await transactionService.broadcast({
            type: 'vote',
            username,
            author: post.author,
            permlink: post.permlink,
            weight: weight
        }, (_data) => {
            showNotification(`Action required: Sign with HiveAuth mobile app.`, 'info');
        });

        setVoting(false);
        if (result.success) {
            setVoted(true);
            setShowVoteSlider(false);
            showNotification("Upvoted successfully", 'success');
        } else {
            setShowVoteSlider(false);
            showNotification("Vote failed: " + result.error, 'error');
        }
    };


    const handleReblog = async () => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to reblog", 'warning');
            return;
        }

        if (!post) return;

        const actionTitle = reblogged ? "Undo Reblog" : "Reblog Post";
        const actionMsg = reblogged
            ? "Are you sure you want to remove this post from your profile?"
            : "Are you sure you want to reblog this post to your profile?";

        const confirmed = await showConfirm(actionTitle, actionMsg);
        if (!confirmed) return;

        setReblogging(true);
        const result = await transactionService.broadcast({
            type: reblogged ? 'unreblog' : 'reblog',
            username,
            author: post.author,
            permlink: post.permlink
        }, () => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        setReblogging(false);
        if (result.success) {
            const newReblogged = !reblogged;
            setReblogged(newReblogged);
            showNotification(newReblogged ? "Reblogged successfully" : "Reblog removed successfully", 'success');
        } else {
            showNotification(`${reblogged ? 'Undo reblog' : 'Reblog'} failed: ` + result.error, 'error');
        }
    };

    const scrollToTop = () => {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop) {
            mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        showNotification("Link copied to clipboard!", 'success');
        setShowMoreMenu(false);
    };


    const toggleBookmark = () => {
        if (!post) return;
        const bookmarks = JSON.parse(localStorage.getItem('hive_bookmarks') || '[]');
        const postKey = `${post.author}/${post.permlink}`;

        if (isBookmarked) {
            const newBookmarks = bookmarks.filter((k: string) => k !== postKey);
            localStorage.setItem('hive_bookmarks', JSON.stringify(newBookmarks));
            setIsBookmarked(false);
            showNotification("Post removed from bookmarks", 'info');
        } else {
            bookmarks.push(postKey);
            localStorage.setItem('hive_bookmarks', JSON.stringify(bookmarks));
            setIsBookmarked(true);
            showNotification("Post bookmarked!", 'success');
        }
    };

    const fetchPostHistory = async () => {
        if (!post) return;
        try {
            const history = await UnifiedDataService.getPostHistory(post.author, post.permlink);
            setPostVersions(history);
            setShowEditHistory(true);
        } catch (err) {
            showNotification("Failed to fetch edit history", 'error');
        }
    };

    const handleCrossPost = async (targetCommunity: string) => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to cross-post", 'warning');
            return;
        }
        if (!post) return;

        setIsCrossPosting(true);
        try {
            const result = await transactionService.broadcast({
                type: 'cross_post',
                username,
                targetCommunity,
                originAuthor: post.author,
                originPermlink: post.permlink,
                originTitle: post.title
            });

            if (result.success) {
                showNotification(`Post cross-posted to ${targetCommunity}!`, 'success');
                setShowCrossPostModal(false);
            } else {
                showNotification("Cross-post failed: " + result.error, 'error');
            }
        } catch (err) {
            showNotification("An error occurred", 'error');
        } finally {
            setIsCrossPosting(false);
        }
    };

    const fetchCommunities = async (query: string = '') => {
        setLoadingCommunities(true);
        try {
            const list = await UnifiedDataService.listCommunities(query, 50);

            // Fallback for common communities if API returns nothing for empty search
            if ((!list || list.length === 0) && query === '') {
                setCommunities([
                    { id: 'hive-125125', name: 'hive-125125', title: 'Breakaway', subscribers: 5000 },
                    { id: 'hive-105017', name: 'hive-105017', title: 'Photography', subscribers: 8000 },
                    { id: 'hive-167922', name: 'hive-167922', title: 'LeoFinance', subscribers: 12000 },
                    { id: 'hive-148441', name: 'hive-148441', title: 'Gems', subscribers: 15000 },
                    { id: 'hive-120078', name: 'hive-120078', title: 'Natural Medicine', subscribers: 3000 }
                ]);
            } else {
                setCommunities(list || []);
            }
        } catch (err) {
            showNotification("Failed to load communities", 'error');
        } finally {
            setLoadingCommunities(false);
        }
    };

    // Initial load and debounced search for communities
    useEffect(() => {
        if (!showCrossPostModal) {
            setCommunities([]);
            setLoadingCommunities(false);
            return;
        }

        // Fetch immediately if search is empty (initial load)
        if (communitySearch === '') {
            fetchCommunities('');
            return;
        }

        const timer = setTimeout(() => {
            fetchCommunities(communitySearch);
        }, 500);

        return () => clearTimeout(timer);
    }, [communitySearch, showCrossPostModal]);

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareTitle = post?.title || '';


    // Check for existing vote when post loads
    useEffect(() => {
        if (post) {
            const rawUsername = localStorage.getItem('hive_user');
            if (rawUsername) {
                const username = rawUsername.toLowerCase();
                // Check votes
                if (post.active_votes && Array.isArray(post.active_votes)) {
                    const vote = post.active_votes.find((v: any) => v.voter?.toLowerCase() === username);
                    if (vote) {
                        const val = vote.percent || vote.weight || vote.rshares || 0;
                        if (val > 0) {
                            setVoted(true);
                        }
                    } else {
                        setVoted(false);
                    }
                }

                // Check reblogs
                const alreadyReblogged = !!(post.reblogged_by && Array.isArray(post.reblogged_by) &&
                    post.reblogged_by.some(u => u?.toLowerCase() === username));
                setReblogged(alreadyReblogged);
            } else {
                setReblogged(false);
                setVoted(false);
            }

            // Check bookmark status
            const bookmarks = JSON.parse(localStorage.getItem('hive_bookmarks') || '[]');
            setIsBookmarked(bookmarks.includes(`${post.author}/${post.permlink}`));
        }
    }, [post]);

    // Handle clicks outside dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMoreMenu) {
                const target = event.target as HTMLElement;
                if (!target.closest('.more-menu-container')) {
                    setShowMoreMenu(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMoreMenu]);

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
                <div className="h-12 bg-gray-200 rounded w-3/4" />
                <div className="h-6 bg-gray-200 rounded w-1/4" />
                <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-5/6" />
                </div>
            </div>
        );
    }

    const cleanTextForSpeech = (text: string) => {
        return text
            .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Keep link text, remove URL
            .replace(/<.*?>/g, '') // Remove HTML tags
            .replace(/#{1,6}\s/g, '') // Remove headers
            .replace(/[*_~`]/g, '') // Remove markdown formatting
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    };

    const handleListen = () => {
        if (!post) return;
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(post.body));
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        // Try to find a good voice (standard logic)
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    };

    const wordCount = post?.body ? post.body.split(/\s+/).filter(Boolean).length : 0;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    if (error || !post) {
        return (
            <div className="max-w-3xl mx-auto text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
                <p className="text-gray-600 mb-6">{error || "Post not found"}</p>
                <Link to="/" className="text-[var(--primary-color)] hover:underline">
                    &larr; Back to Feed
                </Link>
            </div>
        );
    }

    // Calculate payout details
    const parsePayout = (val?: string) => {
        if (!val) return 0;
        return parseFloat(val.split(' ')[0]);
    };

    const pendingPayout = parsePayout(post.pending_payout_value);
    const authorPayoutActual = parsePayout(post.author_payout_value);
    const curatorPayoutActual = parsePayout(post.curator_payout_value);
    const beneficiaryPayout = parsePayout(post.beneficiary_payout_value);

    // Total Payout Displayed
    const payout = pendingPayout > 0 ? pendingPayout : (authorPayoutActual + curatorPayoutActual + beneficiaryPayout);

    // Helper to safely parse Hive's UTC timestamps
    const parseHiveDate = (dateStr?: string) => {
        if (!dateStr) return null;
        // Append Z if it's a standard Hive timestamp missing the timezone indicator
        const isoString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateStr) ? dateStr + 'Z' : dateStr;
        return new Date(isoString);
    };

    // Status - refined logic for Hive
    const cashoutTimeDate = parseHiveDate(post.cashout_time);
    const cashoutTime = cashoutTimeDate ? cashoutTimeDate.getTime() : 0;
    const now = new Date().getTime();

    // Hive uses 1969-12-31T23:59:59Z for posts that have already been fully paid out
    const isPastCashout = cashoutTime > 0 && cashoutTime < now;
    const isPaidOut = isPastCashout || authorPayoutActual > 0 || curatorPayoutActual > 0;
    const isDeclined = post.max_accepted_payout?.startsWith('0.000');

    // Timing message
    let timingMsg = "";
    if (isDeclined) {
        timingMsg = "Rewards Declined";
    } else if (isPaidOut) {
        // Fallback to post creation if cashout_time is too old/reset
        const displayTime = (cashoutTime > 1000000000) ? post.cashout_time! : (post.created);
        timingMsg = `Paid ${formatRelativeTime(displayTime)}`;
    } else if (cashoutTime > 0) {
        timingMsg = `Payout ${formatRelativeTime(post.cashout_time!)}`;
    } else {
        timingMsg = "Payout soon";
    }

    // Breakdown calculation removed to match Ecency's literal RPC mapping

    // Extract tags and app
    const tags = post.json_metadata?.tags || [];
    const appSource = post.json_metadata?.app?.split('/')[0] || post.category;


    return (
        <div className="min-h-screen bg-[var(--bg-canvas)]">
            {/* READING PROGRESS BAR */}
            <div className="fixed top-0 left-0 w-full h-1 z-[100] bg-[var(--border-color)]/20">
                <div
                    className="h-full bg-gradient-to-r from-[var(--primary-color)] to-[#f43f5e] transition-all duration-150 ease-out"
                    style={{ width: `${scrollProgress * 100}%` }}
                />
            </div>

            <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-8 lg:pt-0 pb-32 lg:pb-0 lg:h-[calc(100vh-80px-48px)] lg:overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-12 items-start h-full">

                    {/* LEFT SIDEBAR: MORE FROM AUTHOR */}
                    <aside className="hidden lg:block h-full overflow-y-auto overscroll-contain scrollbar-hide pr-6 pt-8 pb-12 space-y-8 animate-in slide-in-from-left-8 duration-700">
                        <div className="flex flex-col gap-8">
                            <div className="bg-[var(--bg-card)] border border-[var(--border-color)]/30 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-xl">
                                <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-[var(--primary-color)] mb-6">Author Profile</h4>
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative mb-4 group">
                                        <img
                                            src={`https://images.hive.blog/u/${post?.author}/avatar/large`}
                                            alt={post?.author}
                                            className="w-24 h-24 rounded-full border-4 border-[var(--bg-canvas)] shadow-2xl group-hover:scale-105 transition-transform"
                                        />
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-[var(--bg-card)] shadow-lg" />
                                    </div>
                                    <Link to={`/@${post?.author}`} className="font-black text-xl text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors mb-1">
                                        @{post?.author}
                                    </Link>
                                    {/* Community Role Badge */}
                                    {post?.author_role && post.author_role !== 'guest' && post.author_role !== 'member' && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide mb-1 ${post.author_role === 'owner' ? 'bg-purple-500/15 text-purple-500 border border-purple-500/25' :
                                            post.author_role === 'admin' ? 'bg-red-500/15 text-red-500 border border-red-500/25' :
                                                'bg-blue-500/15 text-blue-500 border border-blue-500/25'
                                            }`}>
                                            <Shield size={10} />
                                            {post.author_role}
                                        </span>
                                    )}
                                    {post?.author_title && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 mb-1">
                                            {post.author_title}
                                        </span>
                                    )}
                                    <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-60 mb-6">
                                        Reputation {UnifiedDataService.formatReputation(post?.author_reputation)}
                                    </div>
                                    <Link
                                        to={`/@${post?.author}`}
                                        className="w-full py-3 rounded-2xl bg-[var(--primary-color)] text-white text-xs font-black shadow-lg shadow-[var(--primary-color)]/20 hover:opacity-90 transition-all text-center"
                                    >
                                        View Profile
                                    </Link>
                                </div>
                            </div>

                            {!loadingAuthorPosts && (authorPosts || [])?.length > 0 && (
                                <div className="space-y-6">
                                    <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-[var(--text-secondary)] px-4 opacity-40">Also by @{post?.author}</h4>
                                    <div className="space-y-4">
                                        {authorPosts?.map(p => {
                                            const thumb = p.json_metadata?.image?.[0] || `https://images.hive.blog/u/${p.author}/avatar/large`;
                                            return (
                                                <Link
                                                    key={p.permlink}
                                                    to={`/post/${p.author}/${p.permlink}`}
                                                    className="group flex gap-4 p-3 rounded-3xl hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)]/30 transition-all"
                                                >
                                                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--bg-canvas)] border border-[var(--border-color)]/30 shrink-0">
                                                        <img src={thumb} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                    </div>
                                                    <div className="min-w-0 flex flex-col justify-center">
                                                        <h5 className="text-[11px] font-bold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--primary-color)] transition-colors">{p.title}</h5>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>

                                    {hasMoreAuthorPosts && (
                                        <div className="pt-2 px-2">
                                            <button
                                                onClick={handleLoadMoreAuthorPosts}
                                                disabled={loadingMoreAuthorPosts}
                                                className="w-full py-2.5 rounded-xl border border-[var(--border-color)]/50 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]/30 hover:bg-[var(--bg-canvas)] transition-all flex items-center justify-center gap-2"
                                            >
                                                {loadingMoreAuthorPosts ? (
                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                ) : "Load More"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* DESKTOP SIDEBAR SCROLL TO TOP */}
                        {showScrollTop && (
                            <button
                                onClick={scrollToTop}
                                className="hidden lg:flex flex-col items-center gap-2 pt-6 mt-6 border-t border-[var(--border-color)]/20 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all animate-in fade-in slide-in-from-bottom-4"
                            >
                                <ChevronLeft size={20} className="rotate-90" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Back to top</span>
                            </button>
                        )}
                    </aside>

                    {/* CENTER COLUMN: MAIN CONTENT */}
                    <main
                        ref={mainContentRef}
                        className="min-w-0 h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-hide lg:pb-32 lg:pt-8 relative group/main"
                    >
                        <Link to="/" className="inline-flex items-center gap-2 mb-12 text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all group px-4 lg:px-0">
                            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                            Back to Discovery
                        </Link>

                        {/* Editorial Header */}
                        <header className="mb-16 text-center max-w-3xl mx-auto px-4">
                            {post?.community_title && (
                                <Link
                                    to={`/c/${post?.community}`}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary-color)]/5 border border-[var(--primary-color)]/10 text-[var(--primary-color)] text-[10px] font-bold uppercase tracking-widest mb-8 hover:bg-[var(--primary-color)]/10 transition-all shadow-sm"
                                >
                                    <Repeat size={12} />
                                    {post?.community_title}
                                </Link>
                            )}

                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-10 text-[var(--text-primary)] leading-[1.1] tracking-tight">
                                {post?.title}
                            </h1>

                            <div className="flex flex-col items-center gap-6">
                                {/* Author Info - Mobile/Tablet Only */}
                                <div className="flex items-center gap-4 p-2 pl-2 pr-6 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl shadow-black/5 hover:border-[var(--primary-color)]/30 transition-all group lg:hidden">
                                    <img
                                        src={`https://images.hive.blog/u/${post?.author}/avatar/small`}
                                        alt={post?.author}
                                        className="w-12 h-12 rounded-full border-2 border-[var(--bg-canvas)] shadow-md group-hover:scale-105 transition-transform"
                                    />
                                    <div className="text-left">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Link to={`/@${post?.author}`} className="block font-black text-sm text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors">
                                                @{post?.author}
                                            </Link>
                                            {/* Community Role Badge */}
                                            {post?.author_role && post.author_role !== 'guest' && post.author_role !== 'member' && (
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${post.author_role === 'owner' ? 'bg-purple-500/15 text-purple-500 border border-purple-500/25' :
                                                    post.author_role === 'admin' ? 'bg-red-500/15 text-red-500 border border-red-500/25' :
                                                        'bg-blue-500/15 text-blue-500 border border-blue-500/25'
                                                    }`}>
                                                    <Shield size={8} />
                                                    {post.author_role}
                                                </span>
                                            )}
                                            {post?.author_title && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20">
                                                    {post.author_title}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-secondary)] font-bold opacity-60 uppercase tracking-tighter">
                                            Reputation {UnifiedDataService.formatReputation(post?.author_reputation)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--text-secondary)] py-2 border-y border-[var(--border-color)]/50 px-8">
                                    <span className="flex items-center gap-2"><Clock size={12} /> {readTime} min read</span>
                                    <span className="opacity-20">|</span>
                                    <span className="flex items-center gap-2"><BookOpen size={12} /> {wordCount} words</span>
                                    <span className="opacity-20 hidden md:inline">|</span>
                                    <span className="hidden md:inline">{post?.created ? formatRelativeTime(post.created) : ''}</span>
                                </div>
                            </div>
                        </header>

                        {/* Main Content Card */}
                        <article className="max-w-3xl mx-auto bg-[var(--bg-card)] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-[var(--border-color)] overflow-hidden mb-16">
                            <div className="p-8 md:p-14">
                                <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-black prose-a:text-[var(--primary-color)] prose-img:rounded-3xl shadow-image">
                                    <HiveMarkdown
                                        content={post?.body || ''}
                                        components={{
                                            img: ({ src, alt, ...props }: any) => (
                                                <div className="my-8 group relative rounded-2xl overflow-hidden cursor-zoom-in" onClick={() => setSelectedImage(src)}>
                                                    <img
                                                        src={src}
                                                        alt={alt || ''}
                                                        className="rounded-2xl shadow-xl border border-[var(--border-color)] max-w-full h-auto mx-auto group-hover:scale-[1.01] transition-all bg-[var(--bg-canvas)]"
                                                        loading="lazy"
                                                        {...props}
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white">
                                                            <Search size={20} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }}
                                    />
                                </div>

                                {/* Tags Section */}
                                {(tags || [])?.length > 0 && (
                                    <div className="mt-16 pt-8 border-t border-[var(--border-color)]/50">
                                        <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-6 opacity-40">Categorized under</div>
                                        <div className="flex flex-wrap gap-3">
                                            {tags?.map((tag: string) => (
                                                <Link
                                                    key={tag}
                                                    to={`/posts/trending/${tag}`}
                                                    className="px-5 py-2 bg-[var(--bg-canvas)]/50 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--primary-color)] border border-[var(--border-color)] hover:border-transparent rounded-2xl text-[11px] font-black transition-all shadow-sm active:scale-95"
                                                >
                                                    {tag}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Footer Metadata */}
                                <div className="mt-12 flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] opacity-50">
                                    <div className="flex items-center gap-2">
                                        <span>Published via</span>
                                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] uppercase text-[9px] tracking-wider">{appSource}</span>
                                    </div>
                                    <span>ID: {post?.id}</span>
                                </div>
                            </div>
                        </article>

                        {/* MOBILE ONLY: MORE FROM AUTHOR AT BOTTOM */}
                        {!loadingAuthorPosts && (authorPosts || [])?.length > 0 && (
                            <div className="lg:hidden mb-16 space-y-8 px-4">
                                <h4 className="text-xl font-black text-[var(--text-primary)]">More from @{post?.author}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {authorPosts?.map(p => {
                                        const thumb = p.json_metadata?.image?.[0] || `https://images.hive.blog/u/${p.author}/avatar/large`;
                                        return (
                                            <Link
                                                key={p.permlink}
                                                to={`/post/${p.author}/${p.permlink}`}
                                                className="group block p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)]/30"
                                            >
                                                <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-[var(--bg-canvas)] border border-[var(--border-color)]/20">
                                                    <img src={thumb} alt={p.title} className="w-full h-full object-cover" />
                                                </div>
                                                <h5 className="font-bold text-sm text-[var(--text-primary)] line-clamp-2">{p.title}</h5>
                                            </Link>
                                        );
                                    })}
                                </div>
                                {hasMoreAuthorPosts && (
                                    <button
                                        onClick={handleLoadMoreAuthorPosts}
                                        disabled={loadingMoreAuthorPosts}
                                        className="w-full mt-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm font-bold text-[var(--text-primary)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]/50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loadingMoreAuthorPosts ? (
                                            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        ) : "Load More Posts"}
                                    </button>
                                )}
                            </div>
                        )}

                        <div id="comments" className="max-w-3xl mx-auto px-4 lg:px-0">
                            <PostComments author={post?.author || ''} permlink={post?.permlink || ''} />
                        </div>
                    </main>

                    {/* RIGHT SIDEBAR: SUGGESTED POSTS */}
                    <aside className="hidden lg:block h-full overflow-y-auto overscroll-contain scrollbar-hide pl-6 pt-8 pb-12 space-y-8 animate-in slide-in-from-right-8 duration-700">
                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)]/30 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-xl">
                            <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-[var(--primary-color)] mb-8 flex items-center gap-2">
                                <Zap size={14} fill="currentColor" />
                                Suggested
                            </h4>

                            {!loadingSuggestedPosts ? (
                                <div className="space-y-8">
                                    {suggestedPosts?.map(p => {
                                        const thumb = p.json_metadata?.image?.[0] || `https://images.hive.blog/u/${p.author}/avatar/large`;
                                        return (
                                            <Link
                                                key={p.id}
                                                to={`/post/${p.author}/${p.permlink}`}
                                                className="group block"
                                            >
                                                <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-4 bg-[var(--bg-canvas)] border border-[var(--border-color)]/30 relative">
                                                    <img
                                                        src={thumb}
                                                        alt={p.title}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <img
                                                        src={`https://images.hive.blog/u/${p.author}/avatar/small`}
                                                        alt={p.author}
                                                        className="w-5 h-5 rounded-full ring-1 ring-[var(--border-color)]"
                                                    />
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] transition-colors truncate">@{p.author}</span>
                                                </div>
                                                <h5 className="text-xs font-black text-[var(--text-primary)] leading-tight line-clamp-2 group-hover:text-[var(--primary-color)] transition-colors">
                                                    {p.title}
                                                </h5>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-600 dark:text-green-400">
                                                        <DollarSign size={10} />
                                                        {parseFloat(p.pending_payout_value || '0').toFixed(2)}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{formatRelativeTime(p.created)}</span>
                                                </div>
                                            </Link>
                                        );
                                    })}

                                    <Link
                                        to="/"
                                        className="block text-center pt-4 border-t border-[var(--border-color)]/20 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors"
                                    >
                                        Explore More &rarr;
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-pulse">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="space-y-4">
                                            <div className="aspect-[16/9] bg-[var(--bg-canvas)] rounded-2xl" />
                                            <div className="h-2 bg-[var(--bg-canvas)] rounded w-3/4" />
                                            <div className="h-2 bg-[var(--bg-canvas)] rounded w-1/2" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tag Cloud Utility */}
                        {(tags || [])?.length > 5 && (
                            <div className="bg-[var(--bg-card)]/30 border border-[var(--border-color)]/10 rounded-3xl p-6 backdrop-blur-sm">
                                <h4 className="text-[9px] uppercase tracking-[0.2em] font-black text-[var(--text-secondary)] mb-4 opacity-40">Related Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                    {tags?.slice(0, 8).map((tag: string) => (
                                        <Link
                                            key={tag}
                                            to={`/posts/trending/${tag}`}
                                            className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors"
                                        >
                                            #{tag}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>

                {/* FLOATING ACTION BAR */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[50] w-[90%] max-w-xl animate-in slide-in-from-bottom-8 duration-500 lg:group-hover/main:opacity-100 lg:transition-opacity">
                    <div className="bg-[var(--bg-card)]/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-2 flex items-center justify-between gap-2 overflow-visible">

                        {/* Left Group: Interactions */}
                        <div className="flex items-center gap-1 pl-2">
                            {/* Upvote */}
                            <div className="relative">
                                {showVoteSlider && (
                                    <VoteSlider
                                        onVote={handleVote}
                                        onClose={() => setShowVoteSlider(false)}
                                        isVoting={voting}
                                    />
                                )}
                                <button
                                    onClick={() => setShowVoteSlider(!showVoteSlider)}
                                    disabled={voting || voted}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${voted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'hover:bg-[var(--primary-color)]/10 text-[var(--text-primary)]'}`}
                                >
                                    {voting ? <div className="animate-spin h-5 w-5 border-2 border-current rounded-full border-t-transparent" /> : <ThumbsUp size={20} fill={voted ? "currentColor" : "none"} />}
                                </button>
                            </div>

                            {/* Payout Display */}
                            <div
                                className="relative group/payout px-4 py-2 rounded-full hover:bg-[var(--bg-canvas)]/50 transition-colors cursor-help"
                                onMouseEnter={() => setShowPayoutDetails(true)}
                                onMouseLeave={() => setShowPayoutDetails(false)}
                            >
                                <div className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-1.5">
                                    <DollarSign size={14} />
                                    {payout.toFixed(2)}
                                </div>
                                <div className="text-[9px] uppercase tracking-tighter opacity-40 font-bold -mt-0.5">{isPaidOut ? 'Final' : 'Pending'}</div>

                                {/* Refined Toolkit */}
                                {showPayoutDetails && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[280px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95 fade-in z-[60] backdrop-blur-xl">
                                        <div className="text-center mb-6">
                                            <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-1 opacity-60">{isPaidOut ? 'Final Payout' : 'Pending Payout'}</div>
                                            <div className="text-3xl font-black text-[var(--text-primary)]">${isPaidOut ? payout.toFixed(3) : pendingPayout.toFixed(3)}</div>
                                            <div className="text-[10px] text-[var(--primary-color)] font-bold mt-2 bg-[var(--primary-color)]/10 py-1.5 px-4 rounded-full inline-block tracking-wide">
                                                {timingMsg}
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]/30">
                                            {isPaidOut ? (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold opacity-60 uppercase tracking-wider">Author</span>
                                                        <span className="text-sm font-black text-[var(--text-primary)]">${authorPayoutActual.toFixed(3)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold opacity-60 uppercase tracking-wider">Curators</span>
                                                        <span className="text-sm font-black text-[var(--text-primary)]">${curatorPayoutActual.toFixed(3)}</span>
                                                    </div>
                                                    {beneficiaryPayout > 0 && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold opacity-60 uppercase tracking-wider">Beneficiaries</span>
                                                            <span className="text-sm font-black text-[var(--text-primary)]">${beneficiaryPayout.toFixed(3)}</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center">
                                                    <div className="text-[10px] italic text-[var(--text-secondary)] leading-relaxed opacity-60 px-2 pb-1">
                                                        Detailed split of Author, Curator, and Beneficiary rewards will be available after the 7-day payout window.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Voter Count Action */}
                            <button
                                onClick={() => setShowVoters(true)}
                                className="group relative px-4 py-2 rounded-full hover:bg-[var(--bg-canvas)]/50 transition-colors flex flex-col items-center"
                            >
                                <div className="text-sm font-black text-[var(--text-primary)]">{post.active_votes?.length || 0}</div>
                                <div className="text-[9px] uppercase tracking-tighter opacity-40 font-bold -mt-0.5">Voters</div>
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-white/10 dark:bg-white/5" />

                        {/* Right Group: Utility Actions */}
                        <div className="flex items-center gap-1 pr-2">
                            {/* Listen Button */}
                            <button
                                onClick={handleListen}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isSpeaking ? 'bg-[var(--primary-color)] text-white' : 'hover:bg-[var(--primary-color)]/10 text-[var(--text-secondary)]'}`}
                                title="Listen to post"
                            >
                                {isSpeaking ? <div className="flex gap-0.5 items-end h-4 pb-0.5"><div className="w-1 bg-white animate-pulse" style={{ height: '60%' }}></div><div className="w-1 bg-white animate-pulse" style={{ height: '100%' }}></div><div className="w-1 bg-white animate-pulse" style={{ height: '40%' }}></div></div> : <Volume2 size={20} />}
                            </button>

                            {/* Share */}
                            <button
                                onClick={() => setShowShareModal(true)}
                                className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-[var(--primary-color)]/10 text-[var(--text-secondary)] transition-all"
                                title="Share"
                            >
                                <Share size={20} />
                            </button>

                            {/* Scroll to Top - Dynamic */}
                            {showScrollTop && (
                                <button
                                    onClick={scrollToTop}
                                    className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-[var(--primary-color)]/10 text-[var(--primary-color)] transition-all animate-in zoom-in spin-in-90 duration-300"
                                    title="Scroll to Top"
                                >
                                    <ChevronLeft size={20} className="rotate-90" />
                                </button>
                            )}

                            {/* More Options */}
                            <div className="relative more-menu-container">
                                <button
                                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showMoreMenu ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'hover:bg-[var(--primary-color)]/10 text-[var(--text-secondary)]'}`}
                                >
                                    <MoreHorizontal size={20} />
                                </button>

                                {showMoreMenu && (
                                    <div className="absolute bottom-full right-0 mb-4 w-56 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in backdrop-blur-xl z-[60]">
                                        <div className="p-3 grid grid-cols-1 gap-1">
                                            <button
                                                onClick={() => {
                                                    toggleBookmark();
                                                    setShowMoreMenu(false);
                                                }}
                                                className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[var(--bg-canvas)] transition-all group"
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isBookmarked ? 'bg-yellow-500/10 text-yellow-500' : 'bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] group-hover:bg-[var(--primary-color)]/10 group-hover:text-[var(--primary-color)]'}`}>
                                                    <Bookmark size={16} fill={isBookmarked ? "currentColor" : "none"} />
                                                </div>
                                                <span className="text-xs font-black text-[var(--text-primary)]">{isBookmarked ? 'Saved' : 'Save post'}</span>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setShowMoreMenu(false);
                                                    setCommunitySearch('');
                                                    setShowCrossPostModal(true);
                                                }}
                                                className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[var(--bg-canvas)] transition-all group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] group-hover:bg-[var(--primary-color)]/10 group-hover:text-[var(--primary-color)] flex items-center justify-center transition-colors">
                                                    <Repeat size={16} />
                                                </div>
                                                <span className="text-xs font-black text-[var(--text-primary)]">Cross post</span>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setShowMoreMenu(false);
                                                    setShowEditHistory(true);
                                                    fetchPostHistory();
                                                }}
                                                className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[var(--bg-canvas)] transition-all group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] group-hover:bg-[var(--primary-color)]/10 group-hover:text-[var(--primary-color)] flex items-center justify-center transition-colors">
                                                    <History size={16} />
                                                </div>
                                                <span className="text-xs font-black text-[var(--text-primary)]">Edit History</span>
                                            </button>

                                            <div className="h-px bg-[var(--border-color)] my-1 mx-4" />

                                            <button
                                                onClick={() => {
                                                    setShowMoreMenu(false);
                                                    handleReblog();
                                                }}
                                                onMouseEnter={() => setIsHoveringReblog(true)}
                                                onMouseLeave={() => setIsHoveringReblog(false)}
                                                disabled={reblogging}
                                                className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[var(--bg-canvas)] transition-all group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] group-hover:bg-[var(--primary-color)]/10 group-hover:text-[var(--primary-color)] flex items-center justify-center transition-colors">
                                                    {reblogging ? (
                                                        <div className="animate-spin h-3 w-3 border-2 border-current rounded-full border-t-transparent" />
                                                    ) : (
                                                        <Repeat size={16} className={reblogged ? 'text-red-500' : ''} />
                                                    )}
                                                </div>
                                                <span className={`text-xs font-black ${reblogged ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                                                    {reblogged ? (isHoveringReblog ? 'Undo Reblog?' : 'Reblogged') : 'Reblog'}
                                                </span>
                                            </button>

                                            <button className="flex items-center gap-3 px-4 py-3 rounded-2xl opacity-40 cursor-not-allowed group">
                                                <div className="w-8 h-8 rounded-lg bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] flex items-center justify-center">
                                                    <Zap size={16} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">Promote</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div >
                </div >
            </div >

            {/* LIGHTBOX */}
            {
                selectedImage && (
                    <div
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-20 animate-in fade-in duration-300 pointer-events-auto"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors bg-white/10 p-4 rounded-full backdrop-blur-md">
                            <X size={24} />
                        </button>
                        <img
                            src={selectedImage}
                            alt="Lightbox"
                            className="max-w-full max-h-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )
            }



            {/* Voters Modal */}
            {post && showVoters && <VoterListModal post={post} payout={payout} onClose={() => setShowVoters(false)} />}

            {/* Share Modal - Premium Style */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                url={shareUrl}
                title={shareTitle}
            />

            {
                showCrossPostModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
                            onClick={() => setShowCrossPostModal(false)}
                        />
                        <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in">
                            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-canvas)]/50">
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">Cross-post</h3>
                                <button
                                    onClick={() => setShowCrossPostModal(false)}
                                    className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors text-[var(--text-secondary)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                                    <input
                                        type="text"
                                        placeholder="Search communities..."
                                        value={communitySearch}
                                        onChange={(e) => setCommunitySearch(e.target.value)}
                                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                    />
                                </div>

                                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold px-1">
                                    {communitySearch ? 'Search Results' : 'Recommended Communities'}
                                </p>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                    {loadingCommunities ? (
                                        <div className="py-12 flex flex-col items-center gap-3 text-[var(--text-secondary)]">
                                            <div className="animate-spin h-6 w-6 border-2 border-[var(--primary-color)] rounded-full border-t-transparent" />
                                            <span className="text-xs font-medium">Searching blockchain...</span>
                                        </div>
                                    ) : !communities || communities.length === 0 ? (
                                        <div className="py-12 text-center text-[var(--text-secondary)] italic text-sm">
                                            {communitySearch ? `No communities found for "${communitySearch}"` : 'Loading communities...'}
                                        </div>
                                    ) : (
                                        communities.map(community => (
                                            <button
                                                key={community.name || community.id}
                                                onClick={() => handleCrossPost(community.name || community.id.toString())}
                                                disabled={isCrossPosting}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-canvas)]/30 hover:bg-[var(--primary-color)]/5 border border-[var(--border-color)] hover:border-[var(--primary-color)]/30 transition-all group text-left"
                                            >
                                                <img
                                                    src={`https://images.hive.blog/u/${community.name || community.id}/avatar/small`}
                                                    alt={community.title}
                                                    className="w-10 h-10 rounded-lg border border-[var(--border-color)] shadow-sm bg-white"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-color)] transition-colors truncate">
                                                        {community.title}
                                                    </div>
                                                    <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2">
                                                        <span className="font-bold">@{community.id || community.name}</span>
                                                        <span className="opacity-30">•</span>
                                                        <span>{community.subscribers?.toLocaleString()} subscribers</span>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-[var(--primary-color)]/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Repeat size={14} className="text-[var(--primary-color)]" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                                {isCrossPosting && (
                                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-10 animate-in fade-in">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="animate-spin h-10 w-10 border-4 border-[var(--primary-color)] rounded-full border-t-transparent" />
                                            <span className="text-sm font-bold text-[var(--text-primary)]">Broadcasting Cross-post...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit History Modal */}
            {
                showEditHistory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
                            onClick={() => setShowEditHistory(false)}
                        />
                        <div className="relative w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 fade-in overflow-hidden">
                            <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/50 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Edit History</h3>
                                <button
                                    onClick={() => setShowEditHistory(false)}
                                    className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors text-[var(--text-secondary)]"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--bg-canvas)]/10">
                                {postVersions.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--text-secondary)] italic">No history found.</div>
                                ) : (
                                    <div className="space-y-6">
                                        {postVersions.map((version, idx) => (
                                            <div key={idx} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
                                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-color)]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)] flex items-center justify-center font-bold text-xs ring-1 ring-[var(--primary-color)]/20">
                                                            v{postVersions.length - idx}
                                                        </div>
                                                        <span className="text-sm font-bold text-[var(--text-primary)]">{formatRelativeTime(version.timestamp)}</span>
                                                    </div>
                                                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold opacity-40">#{version.v}</span>
                                                </div>
                                                <div className="text-sm text-[var(--text-primary)] line-clamp-4 opacity-80 leading-relaxed italic">
                                                    {version.body.substring(0, 300)}...
                                                </div>
                                                <div className="mt-4 flex justify-end">
                                                    <button className="text-[10px] font-bold text-[var(--primary-color)] hover:underline uppercase tracking-widest">Compare &rarr;</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

/**
 * Dedicated local component for rendering post comments 
 * with a clean, modern editorial layout.
 */
function PostComments({ author, permlink }: { author: string; permlink: string }) {
    const [comments, setComments] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();

    const fetchComments = async () => {
        setLoading(true);
        try {
            const data = await UnifiedDataService.getComments(author, permlink);
            setComments(data);
        } catch (err) {
            console.error("Failed to fetch comments:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [author, permlink]);

    return (
        <section className="mt-16 border-t border-[var(--border-color)]/30 pt-16">
            <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
                    <MessageSquare className="text-[var(--primary-color)]" size={24} />
                    Comments ({comments.length})
                </h3>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2rem] p-6 mb-12 shadow-sm">
                <CommentBox
                    parentAuthor={author}
                    parentPermlink={permlink}
                    onSuccess={() => {
                        showNotification("Comment published!", 'success');
                        fetchComments();
                    }}
                />
            </div>

            <div className="space-y-8">
                {loading ? (
                    <div className="space-y-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-[var(--text-secondary)]/10" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-4 bg-[var(--text-secondary)]/10 rounded w-1/4" />
                                    <div className="h-4 bg-[var(--text-secondary)]/10 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-20 bg-[var(--bg-canvas)]/30 rounded-[2rem] border border-dashed border-[var(--border-color)]">
                        <MessageSquare size={48} className="mx-auto text-[var(--text-secondary)] opacity-10 mb-4" />
                        <div className="text-[var(--text-secondary)] font-bold italic">No comments yet. Be the first to share your thoughts!</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {comments.map(comment => (
                            <CommentCard
                                key={comment.id}
                                post={comment}
                                parentAuthor={author}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

// Imports moved to top

