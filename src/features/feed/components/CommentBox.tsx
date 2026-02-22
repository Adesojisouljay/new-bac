import { useState } from 'react';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCommunity } from '../../community/context/CommunityContext';
import { pointsService } from '../../../services/pointsService';

interface CommentBoxProps {
    parentAuthor: string;
    parentPermlink: string;
    onSuccess?: () => void;
}

export function CommentBox({ parentAuthor, parentPermlink, onSuccess }: CommentBoxProps) {
    const { showNotification } = useNotification();
    const { config } = useCommunity();
    const community = config?.id || 'hive-106130';
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to comment", 'warning');
            return;
        }

        if (!comment.trim()) return;

        setLoading(true);

        const permlink = `re-${parentAuthor}-${parentPermlink}-${Date.now()}`;

        try {
            const result = await transactionService.broadcast({
                type: 'comment',
                username,
                parent_author: parentAuthor,
                parent_permlink: parentPermlink,
                permlink,
                title: '',
                body: comment,
                json_metadata: JSON.stringify({ tags: ['breakaway'], app: 'breakaway-communities/0.1' })
            }, (_data) => {
                showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
            });

            if (result.success) {
                setComment('');
                showNotification("Comment published!", 'success');
                // Award comment points (fire-and-forget)
                const username = localStorage.getItem('hive_user');
                if (username) pointsService.awardPoints(username, community, 'comments', community);
                if (onSuccess) onSuccess();
            } else {
                showNotification("Comment failed: " + result.error, 'error');
            }
        } catch (e: any) {
            showNotification("Error: " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] mb-6">
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg p-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-all min-h-[100px]"
                disabled={loading}
            />
            <div className="flex justify-end mt-2">
                <button
                    onClick={handleSubmit}
                    disabled={loading || !comment.trim()}
                    className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? 'Posting...' : 'Reply'}
                </button>
            </div>
        </div>
    );
}
