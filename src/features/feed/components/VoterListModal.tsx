import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Search, ChevronLeft, Loader2 } from 'lucide-react';
import { Post, UnifiedDataService } from '../../../services/unified';
import { formatRelativeTime } from '../../../lib/dateUtils';

interface VoterListModalProps {
    post: Post;
    payout: number;
    onClose: () => void;
}

export function VoterListModal({ post, payout, onClose }: VoterListModalProps) {
    const [votes, setVotes] = useState<any[]>(post.active_votes || []);
    const [loading, setLoading] = useState(true);
    const [voterSearch, setVoterSearch] = useState('');
    const [voterPage, setVoterPage] = useState(1);
    const [voterSort, setVoterSort] = useState<'reward' | 'time'>('reward');
    const votersPerPage = 12;

    useEffect(() => {
        const fetchFullVotes = async () => {
            try {
                setLoading(true);
                const fullVotes = await UnifiedDataService.getActiveVotes(post.author, post.permlink);
                if (fullVotes && fullVotes.length > 0) {
                    setVotes(fullVotes);
                }
            } catch (err) {
                console.error('Failed to fetch full votes:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFullVotes();
    }, [post.author, post.permlink]);

    const totalRShares = votes.reduce((sum, vote) => sum + Math.abs(Number(vote.rshares || 0)), 0) || 1;

    const filteredVoters = votes
        .filter(v => v.voter.toLowerCase().includes(voterSearch.toLowerCase()))
        .sort((a, b) => {
            if (voterSort === 'reward') {
                return (Number(b.rshares) || 0) - (Number(a.rshares) || 0);
            }
            return new Date(b.time).getTime() - new Date(a.time).getTime();
        });

    const totalPages = Math.ceil(filteredVoters.length / votersPerPage);
    const startIndex = (voterPage - 1) * votersPerPage;
    const paginatedVoters = filteredVoters.slice(startIndex, startIndex + votersPerPage);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
                onClick={onClose}
            />
            <div className="relative w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 fade-in overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">{post.active_votes?.length || 0} Votes</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors text-[var(--text-secondary)]"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                            <input
                                type="text"
                                placeholder="Search voters..."
                                value={voterSearch}
                                onChange={(e) => {
                                    setVoterSearch(e.target.value);
                                    setVoterPage(1);
                                }}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                            />
                        </div>
                        <select
                            value={voterSort}
                            onChange={(e) => setVoterSort(e.target.value as 'reward' | 'time')}
                            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 transition-all font-medium text-[var(--text-primary)]"
                        >
                            <option value="reward">Sort by Reward</option>
                            <option value="time">Sort by Time</option>
                        </select>
                    </div>
                </div>

                {/* Modal Content - Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--bg-card)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-[var(--primary-color)] animate-spin mb-4" />
                            <div className="text-[var(--text-secondary)] font-medium">Loading voter details...</div>
                        </div>
                    ) : filteredVoters.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-[var(--text-secondary)] italic mb-2">No voters found</div>
                            {voterSearch && <div className="text-xs opacity-60">Try a different search term</div>}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {paginatedVoters.map((vote: any) => {
                                    const vReward = ((Math.abs(Number(vote.rshares || 0)) / totalRShares) * payout);
                                    const vWeight = (Number(vote.percent) || 0) / 100;

                                    return (
                                        <Link
                                            key={vote.voter}
                                            to={`/@${vote.voter}`}
                                            onClick={onClose}
                                            className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-canvas)]/30 hover:bg-[var(--bg-canvas)] border border-[var(--border-color)] hover:border-[var(--primary-color)]/30 transition-all group/voter shadow-sm hover:shadow-md"
                                        >
                                            <img
                                                src={`https://images.hive.blog/u/${vote.voter}/avatar/small`}
                                                alt={vote.voter}
                                                className="w-12 h-12 rounded-full border border-[var(--border-color)] shadow-sm"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="font-bold text-[var(--text-primary)] group-hover/voter:text-[var(--primary-color)] transition-colors truncate">
                                                        @{vote.voter}
                                                    </span>
                                                    <span className="text-[10px] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-secondary)] font-bold">
                                                        {UnifiedDataService.formatReputation(vote.reputation)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-medium">
                                                    <span className="text-green-600 dark:text-green-400 font-bold">${vReward.toFixed(3)}</span>
                                                    <span className="opacity-30">•</span>
                                                    <span>{vWeight.toFixed(1)}%</span>
                                                    <span className="opacity-30">•</span>
                                                    <span>{formatRelativeTime(vote.time || post.created)}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-10 flex items-center justify-center gap-2 border-t border-[var(--border-color)] pt-6">
                                    <button
                                        disabled={voterPage === 1}
                                        onClick={() => setVoterPage(prev => prev - 1)}
                                        className="p-2 rounded-xl hover:bg-[var(--bg-canvas)] disabled:opacity-20 transition-all text-[var(--text-secondary)]"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {[...Array(totalPages)].map((_, i) => {
                                            const p = i + 1;
                                            if (totalPages > 7 && Math.abs(p - voterPage) > 2 && p !== 1 && p !== totalPages) {
                                                if (p === 2 || p === totalPages - 1) return <span key={p} className="px-2 opacity-30">...</span>;
                                                return null;
                                            }
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setVoterPage(p)}
                                                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${voterPage === p ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'hover:bg-[var(--bg-canvas)] text-[var(--text-secondary)]'}`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        disabled={voterPage === totalPages}
                                        onClick={() => setVoterPage(prev => prev + 1)}
                                        className="p-2 rounded-xl hover:bg-[var(--bg-canvas)] disabled:opacity-20 transition-all text-[var(--text-secondary)]"
                                    >
                                        <ChevronLeft size={20} className="rotate-180" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
