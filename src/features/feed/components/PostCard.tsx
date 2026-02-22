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
        <article className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col md:flex-row">
            {/* Thumbnail */}
            <div className="md:w-48 h-48 md:h-auto flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative">
                <Link to={`/post/${post.author}/${post.permlink}`} className="block h-full w-full">
                    <img
                        src={thumbnail}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=No+Image'; }}
                    />
                </Link>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col justify-between flex-grow">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <img
                            src={`https://images.hive.blog/u/${post.author}/avatar/small`}
                            alt={post.author}
                            className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700"
                        />
                        <Link to={`/@${post.author}`} className="font-medium text-sm text-[var(--text-primary)] hover:underline hover:text-[var(--primary-color)]">
                            @{post.author} ({post.author_reputation || 25})
                        </Link>
                        <span className="text-xs text-[var(--text-secondary)]">• {formatRelativeTime(post.created)}</span>
                    </div>

                    <Link to={`/post/${post.author}/${post.permlink}`}>
                        <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)] line-clamp-2 hover:text-[var(--primary-color)] transition-colors">
                            {post.title}
                        </h2>
                    </Link>

                    <p className="text-[var(--text-secondary)] text-sm line-clamp-3 mb-4">
                        {post.body.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                    </p>
                </div>

                {/* Footer Stats */}
                <div className="flex items-center justify-between text-sm text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-4 mt-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.preventDefault(); handleVote(10000); }}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors ${voted ? 'text-red-500' : ''}`}
                                title="Upvote"
                            >
                                {voting ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-red-500 rounded-full border-t-transparent" />
                                ) : (
                                    <ThumbsUp size={18} fill={voted ? "currentColor" : "none"} />
                                )}
                            </button>
                            <span>{post.active_votes?.length || 0}</span>
                            <button
                                onClick={(e) => { e.preventDefault(); handleVote(-10000); }}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors ${downvoted ? 'text-red-500' : ''}`}
                                title="Downvote"
                            >
                                {downvoting ? <div className="animate-spin h-4 w-4 border-2 border-red-500 rounded-full border-t-transparent" /> : <ThumbsDown size={18} />}
                            </button>
                        </div>

                        <button
                            onClick={(e) => { e.preventDefault(); handleReblog(); }}
                            disabled={reblogging || reblogged}
                            className={`flex items-center gap-1 hover:text-[var(--primary-color)] transition-colors ${reblogged ? 'text-[var(--primary-color)]' : ''}`}
                            title="Reblog"
                        >
                            {reblogging ? <div className="animate-spin h-4 w-4 border-2 border-[var(--primary-color)] rounded-full border-t-transparent" /> : <Repeat size={18} />}
                        </button>

                        <Link to={`/post/${post.author}/${post.permlink}#comments`} className="flex items-center gap-1 hover:text-[var(--primary-color)] transition-colors">
                            <MessageSquare size={18} />
                            <span>{post.children}</span>
                        </Link>
                    </div>

                    <span className="font-medium text-[var(--primary-color)]">
                        ${payout}
                    </span>
                </div>
            </div>
        </article>
    );
}
