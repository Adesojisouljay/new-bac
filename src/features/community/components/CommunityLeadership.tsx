import { CommunityDetails } from '../../../services/unified';

interface CommunityLeadershipProps {
    community: CommunityDetails;
}

export function CommunityLeadership({ community }: CommunityLeadershipProps) {
    return (
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-6 border border-[var(--border-color)]">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Leadership</h3>
            <div className="space-y-4">
                {community.roles && community.roles.length > 0 ? (
                    community.roles.slice(0, 10).map(([user, role, title]) => (
                        <div key={user} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden ring-2 ring-transparent group-hover:ring-[var(--primary-color)] transition-all">
                                    <img
                                        src={`https://images.hive.blog/u/${user}/avatar`}
                                        alt={user}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user}&background=random`;
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--primary-color)] cursor-pointer transition-colors">@{user}</span>
                                    <span className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wider">{title || role}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-sm text-[var(--text-secondary)] py-4 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                        No leadership info available
                    </div>
                )}
            </div>
        </div>
    );
}
