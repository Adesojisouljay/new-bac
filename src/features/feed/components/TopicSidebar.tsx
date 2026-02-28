import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrendingTag, UnifiedDataService } from '../../../services/unified';
import { Hash, TrendingUp, Lightbulb } from 'lucide-react';
import { SearchModal } from './SearchModal';

export function TopicSidebar() {
    const navigate = useNavigate();
    const { tag: activeTag } = useParams();
    const [tags, setTags] = useState<TrendingTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    useEffect(() => {
        async function loadTags() {
            setLoading(true);
            try {
                const trendingTags = await UnifiedDataService.getTrendingTags(15);
                setTags(trendingTags);
            } catch (error) {
                console.error('Failed to load trending tags:', error);
            } finally {
                setLoading(false);
            }
        }
        loadTags();
    }, []);

    const handleTagClick = (tagId: string) => {
        navigate(`/posts/trending/${tagId}`);
    };

    const handleJoinClick = () => {
        setIsSearchModalOpen(true);
    };

    return (
        <div className="space-y-4">
            {/* Global Hero Integrated into Sidebar */}
            <div className="relative overflow-hidden rounded-2xl p-6 shadow-xl border border-white/5 bg-[#0f172a] group">
                <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.15)_0,transparent_70%)] blur-2xl animate-pulse" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                <div className="relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 mb-3">
                        <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Gateway</span>
                    </div>
                    <h2 className="text-lg font-black text-white leading-tight mb-2">
                        Explore the <span className="text-[var(--primary-color)]">Hive</span>
                    </h2>
                    <p className="text-[10px] text-white/60 leading-relaxed mb-4 line-clamp-3">
                        Discover trending content and earn rewards on the most active Web3 social network.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => navigate('/posts/trending')} className="w-full py-2 bg-white text-rose-600 rounded-lg text-xs font-black hover:bg-rose-50 transition-colors">
                            Start Exploring
                        </button>
                        <button onClick={handleJoinClick} className="w-full py-2 bg-white/5 text-white rounded-lg text-xs font-black border border-white/10 hover:bg-white/10 transition-colors">
                            Join Communities
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4 flex items-center gap-2 px-1">
                    <TrendingUp size={12} className="text-[var(--primary-color)]" />
                    Topics
                </h3>

                <div className="flex flex-col gap-0.5">
                    {loading ? (
                        [1, 2, 3, 4, 5, 6, 7].map(i => (
                            <div key={i} className="h-8 w-full bg-gray-100 dark:bg-gray-800/50 rounded-lg animate-pulse" />
                        ))
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/posts/trending')}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${!activeTag ? 'bg-[var(--primary-color)]/10 border-[var(--primary-color)]/30 text-[var(--primary-color)] shadow-sm' : 'border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
                            >
                                <Hash size={14} className={!activeTag ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)]/40'} />
                                <span>All Topics</span>
                            </button>
                            {tags.map((tag) => (
                                <button
                                    key={tag.id}
                                    onClick={() => handleTagClick(tag.id)}
                                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border group/tag ${activeTag === tag.id ? 'bg-[var(--primary-color)]/10 border-[var(--primary-color)]/30 text-[var(--primary-color)] shadow-sm' : 'border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
                                >
                                    <Hash size={14} className={activeTag === tag.id ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)]/40 group-hover/tag:text-[var(--text-primary)]'} />
                                    <span className="truncate max-w-[120px]">{tag.title}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Banners Container */}
            <div className="flex flex-col gap-4">
                {/* Promotion Section (Ecency style) */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] p-6 text-white shadow-xl overflow-hidden relative">
                    <div className="absolute -right-6 -bottom-6 opacity-20 transform rotate-12 pointer-events-none">
                        <Hash size={160} strokeWidth={3} />
                    </div>
                    <h4 className="text-xl font-black mb-3 relative z-10 tracking-tight">Promote Your Tag</h4>
                    <p className="text-sm text-blue-50/90 mb-8 relative z-10 leading-relaxed font-medium">
                        Want your community tag to trend? Use the promotion features to reach more users.
                    </p>
                    <div className="px-1">
                        <button disabled className="w-full py-3 bg-white text-blue-600 rounded-xl text-sm font-black hover:bg-white/90 transition-colors relative z-10 outline outline-2 outline-offset-[3px] outline-white/80 cursor-not-allowed opacity-90 shadow-sm">
                            Coming Soon
                        </button>
                    </div>
                </div>

                {/* Suggest Feature Section */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2rem] p-6 shadow-sm overflow-hidden relative group hover:border-[var(--primary-color)]/30 transition-colors">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] transform rotate-[15deg] pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <Lightbulb size={120} strokeWidth={2} />
                    </div>
                    <h4 className="text-base font-black text-[var(--text-primary)] mb-2 relative z-10 tracking-tight flex items-center gap-2">
                        <Lightbulb size={16} className="text-[var(--primary-color)]" />
                        Have an idea?
                    </h4>
                    <p className="text-[13px] font-medium text-[var(--text-secondary)] mb-6 relative z-10 leading-relaxed">
                        Request or suggest a feature to help us improve the Breakaway experience.
                    </p>
                    <button disabled className="w-full py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-xl text-[13px] font-black relative z-10 cursor-not-allowed opacity-70 shadow-sm">
                        Coming Soon
                    </button>
                </div>
            </div>

            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                initialTab="communities"
            />
        </div>
    );
}
