import { useState, useEffect } from 'react';
import { Search, Globe, ChevronRight, Check } from 'lucide-react';
import { useConfig } from '../../../contexts/ConfigContext';
import axios from 'axios';

const POINTS_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function CommunitySelector() {
    const { config: currentConfig, refreshConfig } = useConfig();
    const [searchQuery, setSearchQuery] = useState('');
    const [communities, setCommunities] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchCommunities = async () => {
            if (searchQuery.length < 2) {
                setCommunities([]);
                return;
            }
            setIsLoading(true);
            try {
                const response = await axios.get(`${POINTS_API_URL}/config/search?q=${searchQuery}`);
                setCommunities(response.data.communities || []);
            } catch (error) {
                console.error('Error searching communities:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(fetchCommunities, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelect = async (communityId: string) => {
        localStorage.setItem('selected_community_id', communityId);
        await refreshConfig();
        // Redirect to home or refresh to apply
        window.location.href = '/';
    };

    const handleReset = async () => {
        localStorage.removeItem('selected_community_id');
        await refreshConfig();
        window.location.href = '/';
    };

    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                <input
                    type="text"
                    placeholder="Search for a community..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                />
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">App Instance</h3>

                {/* Global Instance Option */}
                <button
                    onClick={handleReset}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${currentConfig?.hiveCommunityId === 'global'
                            ? 'bg-[var(--primary-color)]/5 border-[var(--primary-color)]'
                            : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--primary-color)]/50'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)]">
                            <Globe size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold">Global (Sovraniche)</div>
                            <div className="text-xs text-[var(--text-secondary)]">All Hive communities in one place</div>
                        </div>
                    </div>
                    {currentConfig?.hiveCommunityId === 'global' ? <Check className="text-[var(--primary-color)]" size={20} /> : <ChevronRight size={18} />}
                </button>

                {/* Search Results */}
                {communities.map((community) => (
                    <button
                        key={community.hiveCommunityId}
                        onClick={() => handleSelect(community.hiveCommunityId)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${currentConfig?.hiveCommunityId === community.hiveCommunityId
                                ? 'bg-[var(--primary-color)]/5 border-[var(--primary-color)]'
                                : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--primary-color)]/50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <img
                                src={community.logoUrl || `https://images.hive.blog/u/${community.hiveCommunityId}/avatar`}
                                alt={community.communityName}
                                className="w-10 h-10 rounded-full border border-[var(--border-color)] object-cover"
                            />
                            <div className="text-left">
                                <div className="font-bold">{community.communityName}</div>
                                <div className="text-xs text-[var(--text-secondary)]">{community.domain}</div>
                            </div>
                        </div>
                        {currentConfig?.hiveCommunityId === community.hiveCommunityId ? <Check className="text-[var(--primary-color)]" size={20} /> : <ChevronRight size={18} />}
                    </button>
                ))}

                {isLoading && (
                    <div className="flex justify-center p-4">
                        <div className="w-6 h-6 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {searchQuery.length >= 2 && communities.length === 0 && !isLoading && (
                    <div className="text-center p-8 text-[var(--text-secondary)]">
                        No communities found for "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
}
