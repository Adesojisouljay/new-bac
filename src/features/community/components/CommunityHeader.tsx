import { NavLink } from 'react-router-dom';
import { CommunityDetails } from '../../../services/unified';

interface CommunityHeaderProps {
    community: CommunityDetails;
    isBaseRoute?: boolean;
}

export function CommunityHeader({ community, isBaseRoute = false }: CommunityHeaderProps) {
    const tabClass = ({ isActive }: { isActive: boolean }) =>
        `px-6 py-3 font-bold text-sm transition-colors whitespace-nowrap ${isActive
            ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
        }`;

    return (
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm overflow-hidden mb-6 border border-[var(--border-color)]">
            {/* Hero/Cover Image with Glassmorphism Stats */}
            <div className="h-48 md:h-56 bg-gradient-to-r from-blue-900 to-purple-900 relative">
                {community.cover_url && (
                    <img
                        src={community.cover_url}
                        alt="Community Cover"
                        className="w-full h-full object-cover opacity-60"
                    />
                )}

                {/* Glassmorphism Stats Overlay */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">

                        <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center text-white shadow-xl hover:bg-black/40 transition-all">
                            <div className="text-2xl font-black drop-shadow-md">{community.subscribers.toLocaleString()}</div>
                            <div className="text-xs uppercase tracking-widest font-medium opacity-80 mt-1">Members</div>
                        </div>

                        <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center text-white shadow-xl hover:bg-black/40 transition-all">
                            <div className="text-2xl font-black drop-shadow-md">{community.pending_rewards}</div>
                            <div className="text-xs uppercase tracking-widest font-medium opacity-80 mt-1">Rewards</div>
                        </div>

                        <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center text-white shadow-xl hover:bg-black/40 transition-all">
                            <div className="text-2xl font-black drop-shadow-md">{community.authors}</div>
                            <div className="text-xs uppercase tracking-widest font-medium opacity-80 mt-1">Posters</div>
                        </div>

                        <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center text-white shadow-xl hover:bg-black/40 transition-all">
                            <div className="text-2xl font-black drop-shadow-md uppercase">{community.lang || 'EN'}</div>
                            <div className="text-xs uppercase tracking-widest font-medium opacity-80 mt-1">Language</div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center px-2 md:px-6 overflow-x-auto no-scrollbar border-b border-[var(--border-color)]">
                <NavLink to={isBaseRoute ? "/" : `/c/${community.id}`} end className={tabClass}>
                    Posts
                </NavLink>
                <NavLink to={isBaseRoute ? "/about" : `/c/${community.id}/about`} className={tabClass}>
                    About
                </NavLink>
                <NavLink to={isBaseRoute ? "/subscribers" : `/c/${community.id}/subscribers`} className={tabClass}>
                    Subscribers
                </NavLink>
                <NavLink to={isBaseRoute ? "/activities" : `/c/${community.id}/activities`} className={tabClass}>
                    Activities
                </NavLink>
            </div>
        </div >
    );
}
