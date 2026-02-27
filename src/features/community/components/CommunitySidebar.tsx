import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnifiedDataService, CommunityDetails } from '../../../services/unified';
import { CommunityLeadership } from './CommunityLeadership';

interface CommunitySidebarProps {
    community: CommunityDetails;
    showCreatePost?: boolean;
}

export function CommunitySidebar({ community, showCreatePost = true }: CommunitySidebarProps) {
    const navigate = useNavigate();
    const currentUsername = localStorage.getItem('hive_user');
    const [isJoined, setIsJoined] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function checkSubscription() {
            if (currentUsername) {
                const subs = await UnifiedDataService.getSubscriptions(currentUsername);
                setIsJoined(subs.includes(community.id));
            }
        }
        checkSubscription();
    }, [currentUsername, community.id]);

    const handleJoin = async () => {
        if (!currentUsername) {
            alert("Please log in to join communities.");
            return;
        }

        setIsLoading(true);
        try {
            let success = false;
            if (isJoined) {
                success = await UnifiedDataService.unsubscribeCommunity(currentUsername, community.id);
            } else {
                success = await UnifiedDataService.subscribeCommunity(currentUsername, community.id);
            }
            if (success) {
                setIsJoined(!isJoined);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Main Profile Card */}
            <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
                {/* Slim Cover Header (just color or tiny snippet of cover) */}
                <div className="h-24 bg-gradient-to-r from-blue-500 to-purple-600 relative">
                    {community.cover_url && (
                        <img src={community.cover_url} alt="Cover" className="w-full h-full object-cover opacity-80" />
                    )}
                </div>

                <div className="p-6 pt-0 relative">
                    {/* Floating Avatar */}
                    <div className="w-24 h-24 rounded-full border-4 border-[var(--bg-card)] bg-[var(--bg-card)] overflow-hidden shadow-lg -mt-12 mb-4 relative z-10 mx-auto lg:mx-0">
                        {community.avatar_url ? (
                            <img src={community.avatar_url} alt={community.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-2xl">
                                {community.title.charAt(0)}
                            </div>
                        )}
                    </div>

                    <h1 className="text-xl font-bold font-heading text-[var(--text-primary)] text-center lg:text-left">{community.title}</h1>
                    <p className="text-sm font-medium text-[var(--primary-color)] text-center lg:text-left mb-4">@{community.id}</p>

                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 text-center lg:text-left">
                        {community.description || community.about || "No description provided."}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-[var(--border-color)]">
                        <div className="text-center">
                            <div className="text-base font-bold text-[var(--text-primary)]">{community.subscribers.toLocaleString()}</div>
                            <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Subscribers</div>
                        </div>
                        <div className="text-center">
                            <div className="text-base font-bold text-[var(--text-primary)]">{community.authors}</div>
                            <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Authors</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleJoin}
                            disabled={isLoading}
                            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${isJoined
                                ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-rose-500 hover:text-white border border-[var(--border-color)] hover:border-transparent'
                                : 'bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color)]/90'
                                }`}
                        >
                            {isLoading ? '...' : isJoined ? 'Leave Community' : 'Join Community'}
                        </button>

                        {showCreatePost && (
                            <button
                                onClick={() => navigate('/submit')}
                                className="w-full py-2.5 bg-transparent border-2 border-[var(--primary-color)] text-[var(--primary-color)] rounded-lg font-bold hover:bg-[var(--primary-color)]/10 transition-all flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Post
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Rules Card */}
            {community.rules && (
                <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-6 border border-[var(--border-color)]">
                    <h3 className="font-bold text-[var(--text-primary)] mb-4">Community Rules</h3>
                    <div className="text-sm text-[var(--text-secondary)] space-y-4">
                        {community.rules.split('-------------------------------------------').map((section, idx) => (
                            <div key={idx} className={idx > 0 ? "pt-4 border-t border-[var(--border-color)]" : ""}>
                                <ol className="list-decimal pl-4 space-y-2">
                                    {section.split('\n').filter(line => line.trim().length > 0).map((rule, rIdx) => (
                                        <li key={rIdx}>{rule.trim()}</li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Leadership Details */}
            <CommunityLeadership community={community} />
        </div>
    );
}
