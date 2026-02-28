import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Post } from '../../../services/unified';
import { transactionService } from '../../wallet/services/transactionService';
import { ThumbsUp, ThumbsDown, MessageSquare, Repeat, Shield } from 'lucide-react';
import { VoteSlider } from './VoteSlider';
import { VoterListModal } from './VoterListModal';
import { ModerationActionsModal } from '../../community/components/ModerationActionsModal';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCommunity } from '../../community/context/CommunityContext';
import { pointsService } from '../../../services/pointsService';

interface PostCardProps {
    post: Post;
    viewerRole?: string; // caller passes the logged-in user's own role in this community
}

export function PostCard({ post, viewerRole }: PostCardProps) {
    const { showNotification, showConfirm } = useNotification();
    const { config } = useCommunity();
    const community = config?.id || 'hive-106130';

    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [downvoting, setDownvoting] = useState(false);
    const [downvoted, setDownvoted] = useState(false);
    const [reblogging, setReblogging] = useState(false);
    const [reblogged, setReblogged] = useState(false);
    const [showVoteSlider, setShowVoteSlider] = useState(false);
    const [showPayoutDetails, setShowPayoutDetails] = useState(false);
    const [showVoters, setShowVoters] = useState(false);
    const [showModerationModal, setShowModerationModal] = useState(false);

    // Strip markdown for clean preview
    const stripMarkdown = (text: string) => {
        if (!text) return '';
        return text
            .replace(/<[^>]*>?/gm, '') // HTML tags
            .replace(/!\[.*?\]\(.*?\)/g, '') // Images ![alt](url)
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Links [text](url) -> text
            .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold **text** -> text
            .replace(/(\*|_)(.*?)\1/g, '$2') // Italic *text* -> text
            .replace(/^#+\s/gm, '') // Headers # Header -> Header
            .replace(/^>\s/gm, '') // Blockquotes > Quote -> Quote
            .replace(/(http|https):\/\/[^\s]+/g, '') // Raw URLs
            .replace(/\s+/g, ' ') // Collapse whitespace
            .trim();
    };

    // Calculate payout details
    const parsePayout = (val?: string) => {
        if (!val) return 0;
        return parseFloat(val.split(' ')[0]);
    };

    const pendingPayout = parsePayout(post.pending_payout_value);
    const authorPayoutActual = parsePayout(post.author_payout_value || post.total_payout_value);
    const curatorPayoutActual = parsePayout(post.curator_payout_value);
    const beneficiaryPayout = parsePayout(post.beneficiary_payout_value);

    // Total Payout Displayed
    const payoutAmount = pendingPayout > 0 ? pendingPayout : (authorPayoutActual + curatorPayoutActual + beneficiaryPayout);

    // Helper to safely parse Hive's UTC timestamps
    const parseHiveDate = (dateStr?: string) => {
        if (!dateStr) return null;
        // Append Z if it's a standard Hive timestamp missing the timezone indicator
        const isoString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateStr) ? dateStr + 'Z' : dateStr;
        return new Date(isoString);
    };

    // Status tracking
    const cashoutTimeDate = parseHiveDate(post.cashout_time);
    const cashoutTime = cashoutTimeDate ? cashoutTimeDate.getTime() : 0;
    const now = new Date().getTime();

    const isPastCashout = cashoutTime > 0 && cashoutTime < now;
    const isPaidOut = isPastCashout || authorPayoutActual > 0 || curatorPayoutActual > 0;
    const isDeclined = post.max_accepted_payout?.startsWith('0.000');

    // Timing message
    let timingMsg = "";
    if (isDeclined) {
        timingMsg = "Rewards Declined";
    } else if (isPaidOut) {
        const displayTime = (cashoutTime > 1000000000) ? post.cashout_time! : (post.created);
        timingMsg = `Paid ${formatRelativeTime(displayTime)}`;
    } else if (cashoutTime > 0) {
        timingMsg = `Payout ${formatRelativeTime(post.cashout_time!)}`;
    } else {
        timingMsg = "Payout soon";
    }

    useEffect(() => {
        const rawUsername = localStorage.getItem('hive_user');
        if (rawUsername) {
            const username = rawUsername.toLowerCase();
            // Check votes
            if (post.active_votes && Array.isArray(post.active_votes)) {
                const vote = post.active_votes.find((v: any) => v.voter?.toLowerCase() === username);
                if (vote) {
                    const val = vote.percent || vote.weight || vote.rshares || 0;
                    if (val < 0) {
                        setDownvoted(true);
                        setVoted(false);
                    } else if (val > 0) {
                        setVoted(true);
                        setDownvoted(false);
                    }
                } else {
                    setVoted(false);
                    setDownvoted(false);
                }
            }

            // Check reblogs
            if (post.reblogged_by && Array.isArray(post.reblogged_by)) {
                setReblogged(post.reblogged_by.some(u => u?.toLowerCase() === username));
            }
        }
    }, [post]);

    // Parse JSON metadata safely to get thumbnail
    let thumbnail = 'https://placehold.co/600x400?text=No+Image';
    try {
        if (post.json_metadata) {
            const meta = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata;
            if (meta.image && meta.image.length > 0) {
                thumbnail = meta.image[0];
            }
        }
    } catch (e) {
        // metadata parsing failed or no image
    }

    const handleVote = async (weight: number) => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to vote", 'warning');
            return;
        }

        const isDownvote = weight < 0;
        if (isDownvote) setDownvoting(true);
        else setVoting(true);

        const result = await transactionService.broadcast({
            type: 'vote',
            username,
            author: post.author,
            permlink: post.permlink,
            weight: weight
        }, () => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        if (isDownvote) setDownvoting(false);
        else {
            setVoting(false);
            setShowVoteSlider(false);
        }

        if (result.success) {
            if (isDownvote) setDownvoted(true);
            else {
                setVoted(true);
                // Award upvote points (fire-and-forget)
                const username = localStorage.getItem('hive_user');
                if (username) pointsService.awardPoints(username, community, 'upvote', community);
            }
            showNotification(isDownvote ? "Downvoted successfully" : "Upvoted successfully", 'success');
        } else {
            showNotification("Vote failed: " + result.error, 'error');
        }
    };

    const handleReblog = async () => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to reblog", 'warning');
            return;
        }

        const confirmed = await showConfirm("Reblog Post", "Are you sure you want to reblog this post to your profile?");
        if (!confirmed) return;

        setReblogging(true);
        const result = await transactionService.broadcast({
            type: 'reblog',
            username,
            author: post.author,
            permlink: post.permlink
        }, () => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        setReblogging(false);
        if (result.success) {
            setReblogged(true);
            showNotification("Reblogged successfully", 'success');
            // Award reblog points (fire-and-forget)
            const username = localStorage.getItem('hive_user');
            if (username) pointsService.awardPoints(username, community, 'reblog', community);
        } else {
            showNotification("Reblog failed: " + result.error, 'error');
        }
    };

    return (
        <article className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-xl hover:border-[var(--primary-color)]/30 transition-all duration-300 flex flex-col md:flex-row group">
            {/* Thumbnail */}
            <div className="md:w-56 h-48 md:h-auto flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative overflow-hidden rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
                <Link to={`/post/${post.author}/${post.permlink}`} className="block h-full w-full">
                    <img
                        src={thumbnail}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=No+Image'; }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </Link>

                {/* Community Badge Overlay (Top Right of Image) - More Subtle Design */}
                {post.community && config?.id === 'global' && (
                    <Link
                        to={`/c/${post.community}`}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-xl text-white text-[9px] font-black uppercase tracking-[0.1em] border border-white/10 hover:bg-[var(--primary-color)] hover:border-[var(--primary-color)] transition-all"
                    >
                        {post.community}
                    </Link>
                )}
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col justify-between flex-grow">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <img
                                src={`https://images.hive.blog/u/${post.author}/avatar/small`}
                                alt={post.author}
                                className="w-8 h-8 rounded-full border-2 border-[var(--bg-canvas)] shadow-sm"
                            />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Link to={`/@${post.author}`} className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors leading-tight">
                                        {post.author} <span className="text-[var(--text-secondary)] font-normal ml-0.5">({post.author_reputation || 25})</span>
                                    </Link>
                                    {/* Community Role Badge */}
                                    {post.author_role && post.author_role !== 'guest' && post.author_role !== 'member' && (
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${post.author_role === 'owner' ? 'bg-purple-500/15 text-purple-500 border border-purple-500/25' :
                                            post.author_role === 'admin' ? 'bg-red-500/15 text-red-500 border border-red-500/25' :
                                                'bg-blue-500/15 text-blue-500 border border-blue-500/25'
                                            }`}>
                                            <Shield size={8} />
                                            {post.author_role}
                                        </span>
                                    )}
                                    {/* Custom Title Badge (if set by community) */}
                                    {post.author_title && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20">
                                            {post.author_title}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-tight">
                                    <span>{formatRelativeTime(post.created)}</span>
                                    {/* Community context — only show in global/following feeds */}
                                    {post.community && post.community_title && (
                                        <>
                                            <span className="opacity-30">·</span>
                                            <span className="opacity-60">in</span>
                                            <Link
                                                to={`/c/${post.community}`}
                                                className="text-[var(--primary-color)] font-bold hover:underline normal-case truncate max-w-[120px]"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {post.community_title}
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Link to={`/post/${post.author}/${post.permlink}`}>
                        <h2 className="text-xl font-black mb-3 text-[var(--text-primary)] line-clamp-2 leading-tight group-hover:text-[var(--primary-color)] transition-colors">
                            {post.title}
                        </h2>
                    </Link>

                    <p className="text-[var(--text-secondary)] text-sm line-clamp-2 mb-6 leading-relaxed">
                        {stripMarkdown(post.body).substring(0, 150)}...
                    </p>
                </div>

                {/* Footer Action Bar (Modern Pill Style) */}
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]/50">
                    <div className="flex items-center gap-2">
                        {/* Vote Pill */}
                        <div className="flex items-center bg-[var(--bg-canvas)] rounded-full border border-[var(--border-color)] p-1 relative">
                            {showVoteSlider && (
                                <VoteSlider
                                    onVote={handleVote}
                                    onClose={() => setShowVoteSlider(false)}
                                    isVoting={voting}
                                />
                            )}
                            <button
                                onClick={(e) => { e.preventDefault(); setShowVoteSlider(!showVoteSlider); }}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-1.5 rounded-full transition-all ${voted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'hover:bg-red-500/10 hover:text-red-500 text-[var(--text-secondary)]'}`}
                                title="Upvote"
                            >
                                {voting ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" />
                                ) : (
                                    <ThumbsUp size={16} fill={voted ? "currentColor" : "none"} />
                                )}
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); setShowVoters(true); }}
                                className="px-3 text-xs font-bold text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors"
                            >
                                {post.active_votes?.length || 0}
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); handleVote(-10000); }}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-1.5 rounded-full transition-all ${downvoted ? 'bg-gray-700 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)]'}`}
                                title="Downvote"
                            >
                                {downvoting ? <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" /> : <ThumbsDown size={14} />}
                            </button>
                        </div>

                        {/* Reblog/Reply Pills */}
                        <button
                            onClick={(e) => { e.preventDefault(); handleReblog(); }}
                            disabled={reblogging || reblogged}
                            className={`flex items-center gap-2 h-9 px-4 rounded-full border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-bold transition-all ${reblogged ? 'bg-[var(--primary-color)] text-white' : 'hover:border-[var(--primary-color)] text-[var(--text-secondary)]'}`}
                        >
                            {reblogging ? <div className="animate-spin h-3 w-3 border-2 border-current rounded-full border-t-transparent" /> : <Repeat size={14} />}
                            <span className="hidden sm:inline">Reblog</span>
                        </button>

                        <Link
                            to={`/post/${post.author}/${post.permlink}#comments`}
                            className="flex items-center gap-2 h-9 px-4 rounded-full border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--primary-color)] transition-all"
                        >
                            <MessageSquare size={14} />
                            <span>{post.children}</span>
                        </Link>

                        {/* Mod Actions button — only for mods/admins/owners of this community */}
                        {post.community && (() => {
                            const currentUser = localStorage.getItem('hive_user');
                            const isMod = currentUser && (viewerRole === 'mod' || viewerRole === 'admin' || viewerRole === 'owner');
                            return isMod ? (
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModerationModal(true); }}
                                    title="Moderation actions"
                                    className="flex items-center gap-2 h-9 px-3 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs font-bold text-purple-500 hover:bg-purple-500/20 transition-all"
                                >
                                    <Shield size={13} />
                                    <span className="hidden sm:inline">Mod</span>
                                </button>
                            ) : null;
                        })()}
                    </div>

                    <div className="text-right relative">
                        <div
                            className="cursor-help relative group"
                            onMouseEnter={() => setShowPayoutDetails(true)}
                            onMouseLeave={() => setShowPayoutDetails(false)}
                        >
                            <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)] mb-0.5">Earnings</div>
                            <div className="text-sm font-black text-[var(--primary-color)]">
                                ${payoutAmount.toFixed(2)}
                            </div>

                            {/* Payout Details Popup */}
                            {showPayoutDetails && (
                                <div className="absolute bottom-full right-0 mb-2 w-[240px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl p-4 animate-in zoom-in-95 fade-in z-[60] backdrop-blur-xl text-left cursor-default"
                                    onMouseEnter={() => setShowPayoutDetails(true)}
                                    onMouseLeave={() => setShowPayoutDetails(false)}
                                >
                                    <div className="text-center mb-4">
                                        <div className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-1 opacity-60">{isPaidOut ? 'Final Payout' : 'Pending Payout'}</div>
                                        <div className="text-2xl font-black text-[var(--text-primary)]">${isPaidOut ? payoutAmount.toFixed(3) : pendingPayout.toFixed(3)}</div>
                                        <div className="text-[9px] text-[var(--primary-color)] font-bold mt-1.5 bg-[var(--primary-color)]/10 py-1.5 px-3 rounded-full inline-block tracking-wide">
                                            {timingMsg}
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-4 border-t border-[var(--border-color)]/30">
                                        {isPaidOut ? (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Author</span>
                                                    <span className="text-xs font-black text-[var(--text-primary)]">${authorPayoutActual.toFixed(3)}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Curators</span>
                                                    <span className="text-xs font-black text-[var(--text-primary)]">${curatorPayoutActual.toFixed(3)}</span>
                                                </div>
                                                {beneficiaryPayout > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Beneficiaries</span>
                                                        <span className="text-xs font-black text-[var(--text-primary)]">${beneficiaryPayout.toFixed(3)}</span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center">
                                                <div className="text-[9px] italic text-[var(--text-secondary)] leading-relaxed opacity-60 px-2 pb-1">
                                                    Detailed split of Author, Curator, and Beneficiary rewards will be available after the 7-day payout window.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Voters Modal */}
            {showVoters && <VoterListModal post={post} payout={payoutAmount} onClose={() => setShowVoters(false)} />}
            {/* Moderation Modal */}
            {showModerationModal && post.community && (
                <ModerationActionsModal
                    isOpen={showModerationModal}
                    onClose={() => setShowModerationModal(false)}
                    community={post.community}
                    communityTitle={post.community_title}
                    userRole={viewerRole || 'guest'}
                    postAuthor={post.author}
                    postPermlink={post.permlink}
                />
            )}
        </article>
    );
}
