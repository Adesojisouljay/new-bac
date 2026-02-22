import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UnifiedDataService, Post } from '../../../services/unified';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { CommentBox } from '../components/CommentBox';
import { CommentCard } from '../../profiles/components/CommentCard';
import { ThumbsUp, ThumbsDown, Repeat, MessageSquare } from 'lucide-react';
import { transactionService } from '../../wallet/services/transactionService';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { useNotification } from '../../../contexts/NotificationContext';

export default function PostViewPage() {
    const { author, permlink } = useParams();
    const { showNotification, showConfirm } = useNotification();
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [comments, setComments] = useState<Post[]>([]);

    // Interaction states
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [downvoting, setDownvoting] = useState(false);
    const [downvoted, setDownvoted] = useState(false);
    const [reblogging, setReblogging] = useState(false);
    const [reblogged, setReblogged] = useState(false);

    useEffect(() => {
        async function loadPostAndComments() {
            if (!author || !permlink) return;

            setLoading(true);
            setError(null);
            try {
                const data = await UnifiedDataService.getPost(author, permlink);
                if (data) {
                    setPost(data);

                    // Fetch comments
                    const commentsData = await UnifiedDataService.getComments(author, permlink);
                    setComments(commentsData);
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

    const handleVote = async (weight: number) => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to vote", 'warning');
            return;
        }

        if (!post) return;

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
            // HiveAuth QR data - might be better to show in a specialized modal later, 
            // but for now let's use notification or stay with existing pattern if HAS is used.
            // However, the prompt asks to remove ALL alerts.
            showNotification(`Action required: Sign with HiveAuth mobile app.`, 'info');
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

    const handleReblog = async () => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to reblog", 'warning');
            return;
        }

        if (!post) return;
        const confirmed = await showConfirm("Reblog Post", "Are you sure you want to reblog this post to your profile?");
        if (!confirmed) return;

        setReblogging(true);
        const result = await transactionService.broadcast({
            type: 'reblog',
            username,
            author: post.author,
            permlink: post.permlink
        }, (_data) => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        setReblogging(false);
        if (result.success) {
            setReblogged(true);
            showNotification("Reblogged successfully", 'success');
        } else {
            showNotification("Reblog failed: " + result.error, 'error');
        }
    };

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
        }
    }, [post]);

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

    // Calculate generic payout sum
    const payout =
        parseFloat(post.pending_payout_value || '0') +
        parseFloat(post.total_payout_value || '0') +
        parseFloat(post.curator_payout_value || '0');

    return (
        <div className="max-w-3xl mx-auto pb-12">
            <Link to="/" className="inline-block mb-6 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors">
                &larr; Back to Feed
            </Link>

            <article className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden mb-8">
                {/* Header */}
                <div className="p-8 border-b border-[var(--border-color)]">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-6 text-[var(--text-primary)] leading-tight">
                        {post.title}
                    </h1>

                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <img
                                src={`https://images.hive.blog/u/${post.author}/avatar/small`}
                                alt={post.author}
                                className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"
                            />
                            <div>
                                <Link to={`/@${post.author}`} className="font-bold text-[var(--text-primary)] hover:text-[var(--primary-color)] hover:underline block">
                                    @{post.author} ({post.author_reputation || 25})
                                </Link>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    {formatRelativeTime(post.created)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* content body */}
                <div className="p-8 prose prose-lg dark:prose-invert max-w-none text-[var(--text-primary)] hover:prose-a:text-[var(--primary-color)] prose-headings:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--primary-color)] prose-pre:bg-[var(--bg-canvas)] prose-pre:border prose-pre:border-[var(--border-color)]">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                        {post.body}
                    </ReactMarkdown>
                </div>

                {/* Footer Actions / Stats */}
                <div className="px-8 pb-8 pt-4 border-t border-[var(--border-color)] flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6 text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleVote(10000)}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors ${voted ? 'text-red-500 bg-red-500/10' : 'text-[var(--text-secondary)]'}`}
                                title="Upvote"
                            >
                                {voting ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-red-500 rounded-full border-t-transparent" />
                                ) : (
                                    <ThumbsUp size={20} fill={voted ? "currentColor" : "none"} />
                                )}
                            </button>

                            <span className="font-bold text-[var(--text-primary)]">{post.active_votes?.length || 0}</span>

                            <button
                                onClick={() => handleVote(-10000)}
                                disabled={voting || voted || downvoting || downvoted}
                                className={`p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors ${downvoted ? 'text-red-500 bg-red-500/10' : 'text-[var(--text-secondary)]'}`}
                                title="Downvote"
                            >
                                {downvoting ? <div className="animate-spin h-5 w-5 border-2 border-red-500 rounded-full border-t-transparent" /> : <ThumbsDown size={20} />}
                            </button>
                        </div>

                        <button
                            onClick={handleReblog}
                            disabled={reblogging || reblogged}
                            className={`flex items-center gap-2 p-2 rounded-full hover:bg-[var(--primary-color)]/10 hover:text-[var(--primary-color)] transition-colors ${reblogged ? 'text-[var(--primary-color)] bg-[var(--primary-color)]/10' : 'text-[var(--text-secondary)]'}`}
                            title="Reblog"
                        >
                            {reblogging ? <div className="animate-spin h-5 w-5 border-2 border-[var(--primary-color)] rounded-full border-t-transparent" /> : <Repeat size={20} />}
                        </button>

                        <a href="#comments" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors">
                            <MessageSquare size={20} />
                            <span>{post.children}</span>
                        </a>
                    </div>

                    <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full border border-green-500/20 text-sm font-medium">
                        ${payout.toFixed(2)}
                    </div>
                </div>
            </article>

            {/* Comments Section */}
            <div id="comments" className="mt-8">
                <h3 className="text-xl font-bold mb-4 text-[var(--text-primary)]">Comments ({comments.length})</h3>

                <CommentBox
                    parentAuthor={post.author}
                    parentPermlink={post.permlink}
                    onSuccess={() => {
                        // Reload comments
                        UnifiedDataService.getComments(post.author, post.permlink).then(setComments);
                    }}
                />

                <div className="space-y-4 mt-6">
                    {comments.map(comment => (
                        <CommentCard key={comment.id} post={comment} parentAuthor={post.author} />
                    ))}
                    {comments.length === 0 && (
                        <div className="text-center text-[var(--text-secondary)] py-8">
                            No comments yet. Be the first to reply!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Imports moved to top

