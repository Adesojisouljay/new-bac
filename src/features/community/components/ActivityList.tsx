import { Activity } from '../../../services/unified';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { User, UserPlus, Shield, Pin, MessageSquare, Flag } from 'lucide-react';

interface ActivityListProps {
    activities: Activity[];
    loading?: boolean;
}

export function ActivityList({ activities, loading }: ActivityListProps) {
    if (loading && activities.length === 0) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] animate-pulse" />
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-12 text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-xl border border-dashed border-[var(--border-color)]">
                No activities found.
            </div>
        );
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'subscribe':
                return <UserPlus className="w-5 h-5 text-green-500" />;
            case 'set_role':
            case 'set_label':
                return <Shield className="w-5 h-5 text-blue-500" />;
            case 'pin_post':
            case 'unpin_post':
                return <Pin className="w-5 h-5 text-orange-500" />;
            case 'mute_post':
            case 'unmute_post':
            case 'flag_post':
                return <Flag className="w-5 h-5 text-red-500" />;
            case 'reply':
            case 'mention':
                return <MessageSquare className="w-5 h-5 text-purple-500" />;
            default:
                return <User className="w-5 h-5 text-gray-500" />;
        }
    };

    const formatMessage = (msg: string) => {
        // Handle @username mentions in messages
        const parts = msg.split(/(@[a-zA-Z0-9.-]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const username = part.substring(1);
                return (
                    <a key={i} href={`/@${username}`} className="font-bold text-[var(--primary-color)] hover:underline">
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    return (
        <div className="space-y-3">
            {activities.map((activity, idx) => (
                <div
                    key={activity.id || idx}
                    className="flex items-start gap-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] hover:border-[var(--primary-color)]/30 transition-colors"
                >
                    <div className="flex-shrink-0 mt-1">
                        {getIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                            {formatMessage(activity.msg)}
                        </p>
                        <span className="text-xs text-[var(--text-secondary)] mt-1 block">
                            {formatRelativeTime(activity.date + 'Z')}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
