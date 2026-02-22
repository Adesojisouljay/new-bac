import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Post, UnifiedDataService } from '../../../services/unified';
import { transactionService } from '../../wallet/services/transactionService';
import { CommentBox } from '../../feed/components/CommentBox';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { useNotification } from '../../../contexts/NotificationContext';

interface CommentCardProps {
    post: Post;
    parentAuthor?: string;
}

export function CommentCard({ post, parentAuthor }: CommentCardProps) {
    const { showNotification } = useNotification();
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [downvoting, setDownvoting] = useState(false);
    const [downvoted, setDownvoted] = useState(false);
    const [showReplyBox, setShowReplyBox] = useState(false);
    const [showReplies, setShowReplies] = useState(false);
    const [replies, setReplies] = useState<Post[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [replyCount, setReplyCount] = useState(post.children || 0);

    // Initialize voting state from post data
    useEffect(() => {
        const rawUsername = localStorage.getItem('hive_user');
        if (rawUsername && post.active_votes && Array.isArray(post.active_votes)) {
            const username = rawUsername.toLowerCase();
            const vote = post.active_votes.find((v: any) => v.voter?.toLowerCase() === username);
            if (vote) {
                // percent/weight/rshares check
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
    }, [post, post.active_votes]);

    const payout = (parseFloat(post.pending_payout_value || '0') + parseFloat(post.total_payout_value || '0') + parseFloat(post.curator_payout_value || '0')).toFixed(3);

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
        }, (_data) => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        if (isDownvote) setDownvoting(false);
        else setVoting(false);

        if (result.success) {
            if (isDownvote) setDownvoted(true);
            else setVoted(true);
            showNotification(isDownvote ? "Downvoted successfully" : "Upvoted successfully", 'success');
        } else {
            showNotification("Vote failed: " + result.error, 'error');
        }
    };

    const toggleReplies = async () => {
        if (showReplies) {
            setShowReplies(false);
            return;
        }

        setShowReplies(true);
        if (replies.length === 0) {
            setLoadingReplies(true);
            const fetched = await UnifiedDataService.getComments(post.author, post.permlink);
            setReplies(fetched);
            setLoadingReplies(false);
        }
    };

    return (
        <article className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm hover:shadow-md transition-shadow mb-4">
            <div className="flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <Link to={`/@${post.author}`}>
                        <img
                            src={`https://images.hive.blog/u/${post.author}/avatar/small`}
                            alt={post.author}
                            className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"
                        />
                    </Link>
                </div>

                <div className="flex-grow min-w-0">
                    {/* Header */}
                    <div className="flex items-baseline gap-2 mb-1">
                        <Link to={`/@${post.author}`} className="font-bold text-[var(--text-primary)] hover:underline">
                            @{post.author} ({post.author_reputation || 25})
                        </Link>
                        <span className="text-xs text-[var(--text-secondary)]">• {formatRelativeTime(post.created)}</span>
                    </div>

                    {/* Context / Replying to */}
                    {parentAuthor && (
                        <div className="text-xs text-[var(--text-secondary)] mb-2">
                            Replying to <Link to={`/@${parentAuthor}`} className="hover:underline">@{parentAuthor}</Link>
                        </div>
                    )}

                    {/* Body */}
                    <div className="prose prose-sm max-w-none text-[var(--text-primary)] mb-3 dark:prose-invert">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                            {post.body.replace(/\n/g, '  \n')}
                        </ReactMarkdown>
                    </div>

                    {/* Footer Stats / Actions */}
                    <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mb-2">
                        <span className="font-medium text-[var(--primary-color)]">
                            ${payout}
                        </span>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleVote(10000)}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors ${voted ? 'text-red-500' : ''}`}
                                title="Upvote"
                            >
                                {voting ? (
                                    <div className="animate-spin h-3 w-3 border-2 border-red-500 rounded-full border-t-transparent" />
                                ) : (
                                    <ThumbsUp size={14} fill={voted ? "currentColor" : "none"} />
                                )}
                            </button>
                            <span>{post.active_votes?.length || 0}</span>
                            <button
                                onClick={() => handleVote(-10000)}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors ${downvoted ? 'text-red-500' : ''}`}
                                title="Downvote"
                            >
                                {downvoting ? <div className="animate-spin h-3 w-3 border-2 border-red-500 rounded-full border-t-transparent" /> : <ThumbsDown size={14} />}
                            </button>
                        </div>

                        <button
                            onClick={() => setShowReplyBox(!showReplyBox)}
                            className="flex items-center gap-1 hover:text-[var(--primary-color)] transition-colors"
                        >
                            Reply
                        </button>

                        {replyCount > 0 && (
                            <button
                                onClick={toggleReplies}
                                className="flex items-center gap-1 hover:text-[var(--primary-color)] transition-colors"
                            >
                                {showReplies ? 'Hide' : `View ${replyCount}`} Replies
                            </button>
                        )}
                    </div>

                    {/* Reply Box */}
                    {showReplyBox && (
                        <div className="mt-4">
                            <CommentBox
                                parentAuthor={post.author}
                                parentPermlink={post.permlink}
                                onSuccess={() => {
                                    setShowReplyBox(false);
                                    // Optionally refresh replies or increment count
                                    // For now just toggle threads open so user sees it if we implemented optimistic add
                                    setReplyCount(c => c + 1);
                                    toggleReplies();
                                }}
                            />
                        </div>
                    )}

                    {/* Nested Replies */}
                    {showReplies && (
                        <div className="mt-4 pl-4 border-l-2 border-[var(--border-color)]">
                            {loadingReplies && <div className="text-sm text-gray-500">Loading replies...</div>}
                            {replies.map(reply => (
                                <CommentCard key={reply.id} post={reply} parentAuthor={post.author} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}


