import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Post } from '../../../services/unified';
import { transactionService } from '../../wallet/services/transactionService';
import { ThumbsUp, ThumbsDown, MessageSquare, Repeat } from 'lucide-react';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCommunity } from '../../community/context/CommunityContext';
import { pointsService } from '../../../services/pointsService';

interface PostCardProps {
    post: Post;
}

export function PostCard({ post }: PostCardProps) {
    const { showNotification, showConfirm } = useNotification();
    const { config } = useCommunity();
    const community = config?.id || 'hive-106130';
    const payout = (parseFloat(post.pending_payout_value || '0') + parseFloat(post.total_payout_value || '0') + parseFloat(post.curator_payout_value || '0')).toFixed(2);

    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false); // Should check if user already voted in active_votes
    const [downvoting, setDownvoting] = useState(false);
    const [downvoted, setDownvoted] = useState(false);
    const [reblogging, setReblogging] = useState(false);
    const [reblogged, setReblogged] = useState(false);

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
        else setVoting(false);

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
        <article className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-xl hover:border-[var(--primary-color)]/30 transition-all duration-300 overflow-hidden flex flex-col md:flex-row group">
            {/* Thumbnail */}
            <div className="md:w-56 h-48 md:h-auto flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
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
                                <Link to={`/@${post.author}`} className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--primary-color)] transition-colors leading-tight">
                                    {post.author} <span className="text-[var(--text-secondary)] font-normal ml-0.5">({post.author_reputation || 25})</span>
                                </Link>
                                <span className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-tight">{formatRelativeTime(post.created)}</span>
                            </div>
                        </div>
                    </div>

                    <Link to={`/post/${post.author}/${post.permlink}`}>
                        <h2 className="text-xl font-black mb-3 text-[var(--text-primary)] line-clamp-2 leading-tight group-hover:text-[var(--primary-color)] transition-colors">
                            {post.title}
                        </h2>
                    </Link>

                    <p className="text-[var(--text-secondary)] text-sm line-clamp-2 mb-6 leading-relaxed">
                        {post.body.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                    </p>
                </div>

                {/* Footer Action Bar (Modern Pill Style) */}
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]/50">
                    <div className="flex items-center gap-2">
                        {/* Vote Pill */}
                        <div className="flex items-center bg-[var(--bg-canvas)] rounded-full border border-[var(--border-color)] p-1">
                            <button
                                onClick={(e) => { e.preventDefault(); handleVote(10000); }}
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
                            <span className="px-3 text-xs font-bold text-[var(--text-primary)]">{post.active_votes?.length || 0}</span>
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
                    </div>

                    <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)] mb-0.5">Earnings</div>
                        <div className="text-sm font-black text-[var(--primary-color)]">
                            ${payout}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
