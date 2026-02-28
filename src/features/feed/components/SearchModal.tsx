import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UnifiedDataService, CommunityDetails } from '../../../services/unified';
import { X, Search, Users, PlusCircle, UserPlus, LogIn, ChevronRight } from 'lucide-react';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'people' | 'communities';
}

export function SearchModal({ isOpen, onClose, initialTab = 'people' }: SearchModalProps) {
    const [activeTab, setActiveTab] = useState<'people' | 'communities'>(initialTab);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [userResults, setUserResults] = useState<{ username: string; reputation: number; avatar_url: string }[]>([]);
    const [communityResults, setCommunityResults] = useState<CommunityDetails[]>([]);
    const [suggestions, setSuggestions] = useState<{
        users: { username: string; reputation: number; avatar_url: string }[];
        communities: CommunityDetails[];
    }>({ users: [], communities: [] });

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setQuery('');
            loadSuggestions();
        }
    }, [isOpen, initialTab]);

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            const [users, communities] = await Promise.all([
                UnifiedDataService.getSuggestedUsers(10),
                UnifiedDataService.getTrendingCommunities(10)
            ]);
            setSuggestions({ users, communities });
        } catch (error) {
            console.error('Failed to load search suggestions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleSearch = async () => {
            if (!query.trim()) {
                setUserResults([]);
                setCommunityResults([]);
                return;
            }

            setLoading(true);
            try {
                if (activeTab === 'people') {
                    const results = await UnifiedDataService.searchProfiles(query, 12);
                    setUserResults(results);
                } else {
                    const results = await UnifiedDataService.getTrendingCommunities(12, query);
                    setCommunityResults(results);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [query, activeTab]);

    if (!isOpen) return null;

    const displayUsers = query.trim() ? userResults : suggestions.users;
    const displayCommunities = query.trim() ? communityResults : suggestions.communities;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Header */}
                <div className="p-6 border-b border-[var(--border-color)] space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-grow group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--primary-color)] transition-colors" size={20} />
                            <input
                                autoFocus
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={activeTab === 'people' ? "Search for Hive accounts..." : "Search for communities..."}
                                className="w-full pl-12 pr-4 py-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl text-lg font-medium outline-none transition-all focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5"
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-[var(--bg-card)] rounded-2xl text-[var(--text-secondary)] transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex p-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] w-fit">
                        <button
                            onClick={() => setActiveTab('people')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'people' ? 'bg-[var(--bg-canvas)] text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <Users size={16} />
                            People
                        </button>
                        <button
                            onClick={() => setActiveTab('communities')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'communities' ? 'bg-[var(--bg-canvas)] text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <PlusCircle size={16} />
                            Communities
                        </button>
                    </div>
                </div>

                {/* Results Section */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 custom-scrollbar">
                    {loading && !query ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4 text-[var(--text-secondary)]">
                            <div className="w-8 h-8 border-4 border-[var(--primary-color)]/20 border-t-[var(--primary-color)] rounded-full animate-spin" />
                            <p className="text-sm font-black uppercase tracking-widest animate-pulse">Scanning the Hive...</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <h4 className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-50">
                                {query.trim() ? 'Search Results' : 'Suggested for you'}
                            </h4>

                            {activeTab === 'people' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {displayUsers.map(user => (
                                        <div key={user.username} className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-card)]/50 border border-transparent hover:border-[var(--primary-color)]/30 hover:bg-[var(--bg-card)] transition-all group">
                                            <Link to={`/@${user.username}`} onClick={onClose} className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={user.avatar_url}
                                                    alt={user.username}
                                                    className="w-12 h-12 rounded-full border border-[var(--border-color)] group-hover:scale-105 transition-transform"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-black text-[var(--text-primary)] truncate group-hover:text-[var(--primary-color)] transition-colors">@{user.username}</span>
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">REP: {user.reputation}</span>
                                                </div>
                                            </Link>
                                            <button className="p-2 rounded-xl bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white transition-all scale-90 group-hover:scale-100">
                                                <UserPlus size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {displayCommunities.map(community => (
                                        <div key={community.id} className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-card)]/50 border border-transparent hover:border-[var(--primary-color)]/30 hover:bg-[var(--bg-card)] transition-all group">
                                            <Link to={`/c/${community.id}`} onClick={onClose} className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={community.avatar_url}
                                                    alt={community.title}
                                                    className="w-12 h-12 rounded-xl border border-[var(--border-color)] group-hover:rotate-3 transition-transform"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-black text-[var(--text-primary)] truncate group-hover:text-[var(--primary-color)] transition-colors">{community.title}</span>
                                                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">{community.subscribers.toLocaleString()} Members</span>
                                                </div>
                                            </Link>
                                            <button className="p-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all scale-90 group-hover:scale-100">
                                                <LogIn size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {displayUsers.length === 0 && displayCommunities.length === 0 && !loading && (
                                <div className="py-20 text-center space-y-4">
                                    <div className="text-4xl">🔎</div>
                                    <div className="space-y-1">
                                        <p className="font-black text-[var(--text-primary)]">No matches found</p>
                                        <p className="text-sm text-[var(--text-secondary)]">Try a different username or community name</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="shrink-0 p-4 bg-[var(--bg-card)]/30 border-t border-[var(--border-color)] flex items-center justify-center gap-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    <span>Pro Tip: Search for @usernames to find people faster</span>
                    <ChevronRight size={12} />
                </div>
            </div>
        </div >
    );
}
