import { useNavigate } from 'react-router-dom';
import { CommunityDetails } from '../../../services/unified';

interface CommunitySidebarProps {
    community: CommunityDetails;
    showCreatePost?: boolean;
}

export function CommunitySidebar({ community, showCreatePost = true }: CommunitySidebarProps) {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            {/* Create Post Button */}
            {showCreatePost && (
                <button
                    onClick={() => navigate('/submit')}
                    className="w-full py-3 bg-[var(--primary-color)] text-white rounded-lg font-bold shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Create Post
                </button>
            )}

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

            {/* About Card */}
            <div className="bg-[var(--bg-card)] rounded-xl shadow-sm p-6 border border-[var(--border-color)]">
                <h3 className="font-bold text-[var(--text-primary)] mb-4">About {community.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    {community.description || community.about || "No description provided."}
                </p>

                <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Subscribers</span>
                        <span className="font-medium text-[var(--text-primary)]">{community.subscribers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Pending Rewards</span>
                        <span className="font-medium text-[var(--text-primary)]">{community.pending_rewards}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Language</span>
                        <span className="font-medium uppercase text-[var(--text-primary)]">{community.lang || 'EN'}</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
