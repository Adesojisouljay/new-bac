import { formatRelativeTime } from '../../../lib/dateUtils';
import { Link } from 'react-router-dom';

interface Transaction {
    id: number;
    timestamp: string;
    type: string;
    data: any;
    trx_id: string;
}

interface TransactionListProps {
    transactions: Transaction[];
    username: string;
    onLoadMore?: () => void;
    loading?: boolean;
}

export function TransactionList({ transactions, username, onLoadMore, loading }: TransactionListProps) {
    if (!transactions || transactions.length === 0) {
        return <div className="text-center py-6 text-[var(--text-secondary)]">No recent transactions found.</div>;
    }

    return (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]">
                <h3 className="font-bold text-[var(--text-primary)]">Last Operations</h3>
            </div>
            <div className="divide-y divide-[var(--border-color)]">
                {transactions.map((tx) => (
                    <TransactionItem key={`${tx.id}-${tx.trx_id}`} tx={tx} username={username} />
                ))}
            </div>
            {onLoadMore && (
                <div className="p-4 text-center border-t border-[var(--border-color)]">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="text-sm font-bold text-[var(--primary-color)] hover:text-[var(--primary-color)]/80 disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Load More History'}
                    </button>
                </div>
            )}
        </div>
    );
}

function TransactionItem({ tx, username }: { tx: Transaction, username: string }) {
    const { type, data, timestamp } = tx;
    const date = formatRelativeTime(timestamp + 'Z'); // Hive timestamps are UTC

    let icon = '📝';
    let title = type.replace(/_/g, ' ');
    let details: React.ReactNode = null;
    let className = '';

    // Format specific operation types
    switch (type) {
        case 'transfer': {
            const isReceive = data.to === username;
            title = isReceive ? 'Received Tokens' : 'Sent Tokens';
            className = isReceive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            icon = isReceive ? '⬇️' : '↗️';

            details = (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className={`font-mono font-bold ${className}`}>
                        {data.amount}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                        {isReceive ? 'from' : 'to'}
                        <Link to={`/@${isReceive ? data.from : data.to}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] ml-1">
                            @{isReceive ? data.from : data.to}
                        </Link>
                    </span>
                    {data.memo && <span className="text-xs text-[var(--text-secondary)] italic truncate max-w-[200px]">"{data.memo}"</span>}
                </div>
            );
            break;
        }

        case 'vote': {
            const isWeightPositive = data.weight > 0;
            icon = isWeightPositive ? '👍' : '👎';
            title = isWeightPositive ? 'Upvote' : 'Downvote';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    {isWeightPositive ? 'Upvoted' : 'Downvoted'}
                    <Link to={`/@${data.author}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] mx-1">
                        @{data.author}
                    </Link>
                    on <span className="italic break-all">{data.permlink.substring(0, 30)}...</span>
                </div>
            );
            break;
        }

        case 'comment': {
            const isPost = data.parent_author === '';
            icon = isPost ? '📰' : '💬';
            title = isPost ? 'New Post' : 'New Comment';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    Created {isPost ? 'post' : 'comment'}
                    <span className="font-medium text-[var(--text-primary)] mx-1 italic break-all">
                        {data.permlink.substring(0, 40)}...
                    </span>
                    {!isPost && <span>to @{data.parent_author}</span>}
                </div>
            );
            break;
        }

        case 'transfer_to_vesting': {
            const isSelf = data.to === username || data.to === '';
            icon = '⚡';
            title = 'Power Up';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    Powered up <span className="font-bold text-[var(--text-primary)]">{data.amount}</span>
                    {!isSelf && <span> to @{data.to}</span>}
                </div>
            );
            break;
        }

        case 'transfer_to_savings':
        case 'transfer_from_savings': {
            const isToSavings = type === 'transfer_to_savings';
            icon = '🏦';
            title = isToSavings ? 'Deposit to Savings' : 'Withdraw from Savings';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    {isToSavings ? 'Moved' : 'Withdrew'} <span className="font-bold text-[var(--text-primary)]">{data.amount}</span>
                    {isToSavings ? ' to' : ' from'} savings
                </div>
            );
            break;
        }

        case 'interest': {
            icon = '📈';
            title = 'HBD Interest';
            details = <div className="text-sm text-[var(--text-secondary)]">Received <span className="text-green-600 font-bold">{data.interest}</span> interest</div>;
            break;
        }

        case 'fill_vesting_withdraw': {
            icon = '🔋';
            title = 'Power Down Payment';
            details = <div className="text-sm text-[var(--text-secondary)]">Received <span className="text-green-600 font-bold">{data.deposited}</span> from power down</div>;
            break;
        }

        case 'account_witness_vote': {
            const isApprove = data.approve;
            icon = '🗳️';
            title = isApprove ? 'Witness Vote' : 'Unvote Witness';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    {isApprove ? 'Voted for' : 'Removed vote from'} witness
                    <Link to={`/@${data.witness}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] ml-1">
                        @{data.witness}
                    </Link>
                </div>
            );
            break;
        }

        case 'custom_json': {
            icon = '⚙️';
            try {
                const json = JSON.parse(data.json);
                if (data.id === 'follow') {
                    const following = json[1].following;
                    const what = json[1].what[0] || 'unfollow';
                    icon = what === 'blog' ? '👤' : '🚫';
                    title = what === 'blog' ? 'Followed User' : 'Unfollowed User';
                    details = (
                        <div className="text-sm text-[var(--text-secondary)]">
                            {what === 'blog' ? 'Started following' : 'Stopped following'}
                            <Link to={`/@${following}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] ml-1">
                                @{following}
                            </Link>
                        </div>
                    );
                } else if (data.id === 'reblog') {
                    icon = '🔁';
                    title = 'Reblogged';
                    const author = json[1].author;
                    details = (
                        <div className="text-sm text-[var(--text-secondary)]">
                            Reblogged
                            <Link to={`/@${author}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] mx-1">
                                @{author}
                            </Link>
                            post
                        </div>
                    );
                } else if (data.id === 'community') {
                    const action = json[0];
                    const community = json[1].community;
                    icon = action === 'subscribe' ? '🏰' : '🚪';
                    title = action === 'subscribe' ? 'Subscribed' : 'Unsubscribed';
                    details = (
                        <div className="text-sm text-[var(--text-secondary)]">
                            {action === 'subscribe' ? 'Subscribed to' : 'Unsubscribed from'} {community}
                        </div>
                    );
                } else if (data.id === 'notify') {
                    icon = '🔔';
                    title = 'Notification';
                    details = <div className="text-sm text-[var(--text-secondary)]">Community notification</div>;
                } else {
                    title = `Action: ${data.id}`;
                    details = <div className="text-xs text-[var(--text-secondary)] truncate">ID: {data.id}</div>;
                }
            } catch (e) {
                details = <div className="text-xs text-[var(--text-secondary)]">Custom Action: {data.id}</div>;
            }
            break;
        }

        case 'claim_reward_balance': {
            icon = '🎁';
            title = 'Claim Rewards';
            details = (
                <div className="text-sm text-[var(--text-secondary)] flex flex-wrap gap-2">
                    {parseFloat(data.reward_hive) > 0 && <span className="bg-green-500/10 text-green-600 px-2 rounded font-medium">{data.reward_hive}</span>}
                    {parseFloat(data.reward_hbd) > 0 && <span className="bg-green-500/10 text-green-600 px-2 rounded font-medium">{data.reward_hbd}</span>}
                    {parseFloat(data.reward_vests) > 0 && <span className="bg-blue-500/10 text-blue-600 px-2 rounded font-medium">{parseFloat(data.reward_vests).toFixed(0)} VESTS</span>}
                </div>
            );
            break;
        }

        case 'limit_order_create': {
            icon = '⚖️';
            title = 'Market Order';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    Selling <span className="text-[var(--text-primary)] font-medium">{data.amount_to_sell}</span> for at least <span className="text-[var(--text-primary)] font-medium">{data.min_to_receive}</span>
                </div>
            );
            break;
        }

        case 'limit_order_cancel': {
            icon = '✖️';
            title = 'Order Cancelled';
            details = <div className="text-sm text-[var(--text-secondary)]">Cancelled order #{data.orderid}</div>;
            break;
        }

        case 'fill_order': {
            icon = '✅';
            title = 'Order Filled';
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    Traded <span className="text-green-600 font-bold">{data.current_pays}</span> for <span className="text-[var(--text-primary)] font-medium">{data.open_pays}</span>
                </div>
            );
            break;
        }

        case 'delegate_vesting_shares': {
            icon = '🤝';
            title = 'Delegation';
            const amount = parseFloat(data.vesting_shares);
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    {amount === 0 ? 'Removed delegation from' : `Delegated ${amount.toFixed(0)} VESTS to`}
                    <Link to={`/@${data.delegatee}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary-color)] ml-1">
                        @{data.delegatee}
                    </Link>
                </div>
            );
            break;
        }

        case 'withdraw_vesting': {
            icon = '🔋';
            title = 'Power Down';
            const amount = parseFloat(data.vesting_shares);
            details = (
                <div className="text-sm text-[var(--text-secondary)]">
                    {amount === 0 ? 'Stopped power down' : `Started powering down ${amount.toFixed(0)} VESTS`}
                </div>
            );
            break;
        }

        case 'account_update':
        case 'account_update2': {
            icon = '👤';
            title = 'Profile Update';
            details = <div className="text-sm text-[var(--text-secondary)]">Updated account profile or settings</div>;
            break;
        }

        case 'delete_comment': {
            icon = '🗑️';
            title = 'Deleted Comment';
            details = <div className="text-sm text-[var(--text-secondary)]">Removed comment or post: <span className="italic">{data.permlink}</span></div>;
            break;
        }

        case 'comment_options': {
            icon = '⚙️';
            title = 'Post Options';
            details = <div className="text-sm text-[var(--text-secondary)]">Updated options for <span className="italic">{data.permlink}</span></div>;
            break;
        }

        case 'curation_reward':
        case 'author_reward':
        case 'comment_benefactor_reward':
        case 'producer_reward':
        case 'vesting_reward': {
            icon = '⭐';
            title = type.replace(/_/g, ' ');
            const reward = data.reward || data.vesting_shares || data.hbd_payout || data.hive_payout || data.payout || (data.vesting_shares ? `${parseFloat(data.vesting_shares).toFixed(0)} VESTS` : null);
            details = <div className="text-sm text-[var(--text-secondary)]">Earned {reward || 'rewards'}</div>;
            break;
        }

        default:
            details = (
                <div className="text-xs text-[var(--text-secondary)] opacity-70">
                    <span className="font-mono">{type}</span>: {Object.keys(data).join(', ')}
                </div>
            );
    }

    return (
        <div className="p-4 flex items-start gap-4 hover:bg-[var(--bg-canvas)] transition-colors group">
            <div className="text-2xl mt-1 shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-canvas)] group-hover:bg-[var(--bg-card)] transition-colors shadow-sm">
                {icon}
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-[var(--text-primary)] text-sm sm:text-base capitalize">{title}</h4>
                    <span className="text-[10px] sm:text-xs text-[var(--text-secondary)] whitespace-nowrap ml-2 opacity-80">{date}</span>
                </div>
                {details}
            </div>
        </div>
    );
}
