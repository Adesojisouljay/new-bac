import { Subscriber } from '../../../services/unified';
import { Link } from 'react-router-dom';
import { formatRelativeTime } from '../../../lib/dateUtils';

interface SubscriberListProps {
    subscribers: Subscriber[];
    loading?: boolean;
}

export function SubscriberList({ subscribers, loading }: SubscriberListProps) {
    if (loading && subscribers.length === 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-20 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] animate-pulse" />
                ))}
            </div>
        );
    }

    if (subscribers.length === 0) {
        return (
            <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-xl border border-dashed border-[var(--border-color)]">
                No subscribers found.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscribers.map((sub) => (
                <Link
                    key={sub.user}
                    to={`/@${sub.user}`}
                    className="flex items-center gap-3 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] hover:shadow-md transition-shadow group"
                >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-[var(--border-color)]">
                        <img
                            src={`https://images.hive.blog/u/${sub.user}/avatar`}
                            alt={sub.user}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${sub.user}&background=random`;
                            }}
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-color)] transition-colors truncate">
                            @{sub.user}
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full w-fit ${sub.role === 'owner' || sub.role === 'admin'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : sub.role === 'mod'
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                {sub.title || sub.role}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                                Joined {formatRelativeTime(sub.joined + 'Z')}
                            </span>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
