import { NavLink } from 'react-router-dom';
import { CommunityDetails } from '../../../services/unified';

interface CommunityHeaderProps {
    community: CommunityDetails;
}

export function CommunityHeader({ community }: CommunityHeaderProps) {
    const tabClass = ({ isActive }: { isActive: boolean }) =>
        `px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${isActive
            ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`;

    return (
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm overflow-hidden mb-6 border border-[var(--border-color)]">
            {/* Hero/Cover Image */}
            <div className="h-56 md:h-80 bg-gray-200 dark:bg-gray-800 relative">
                {community.cover_url ? (
                    <img
                        src={community.cover_url}
                        alt="Community Cover"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600" />
                )}

                {/* Stats Overlay (Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20 text-white flex flex-wrap items-end justify-between">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[var(--bg-card)] bg-[var(--bg-card)] overflow-hidden shadow-lg -mb-10 z-10 relative">
                            {community.avatar_url ? (
                                <img src={community.avatar_url} alt={community.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-xl">
                                    {community.title.charAt(0)}
                                </div>
                            )}
                        </div>

                        <div className="mb-1">
                            <h1 className="text-2xl md:text-3xl font-bold shadow-black drop-shadow-md">{community.title}</h1>
                            <p className="text-sm md:text-base opacity-90 max-w-2xl text-shadow-sm line-clamp-1">{community.about}</p>
                        </div>
                    </div>

                    {/* Key Stats (Hero) */}
                    <div className="hidden md:flex gap-6 text-center mb-1">
                        <div>
                            <div className="text-xl font-bold">{community.subscribers.toLocaleString()}</div>
                            <div className="text-xs uppercase opacity-80">Subscribers</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold">{community.pending_rewards}</div>
                            <div className="text-xs uppercase opacity-80">Pending</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold">{community.authors}</div>
                            <div className="text-xs uppercase opacity-80">Active</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs (PeakD Style) */}
            <div className="flex items-center px-4 pt-12 pb-2 md:pl-32 border-b border-[var(--border-color)] overflow-x-auto">
                <NavLink to="/posts" className={tabClass}>
                    Posts
                </NavLink>
                <NavLink to="/about" className={tabClass}>
                    About
                </NavLink>
                <NavLink to="/subscribers" className={tabClass}>
                    Subscribers
                </NavLink>
                <NavLink to="/activities" className={tabClass}>
                    Activities
                </NavLink>
            </div>
        </div>
    );
}
