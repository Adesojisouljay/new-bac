import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { analyticsService, DailyPerformance } from '../services/analyticsService';
import { TrendingUp, Wallet, Award, Activity, BarChart2, X, Search } from 'lucide-react';

export function AnalyticsPage() {
    const { username: routeUsername } = useParams();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [performance, setPerformance] = useState<DailyPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<DailyPerformance | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const loggedInUser = localStorage.getItem('hive_user');
    const displayUser = (routeUsername?.startsWith('@') ? routeUsername.substring(1) : routeUsername) || loggedInUser;

    useEffect(() => {
        if (displayUser) {
            loadData();
        }
    }, [displayUser]);

    const loadData = async () => {
        if (!displayUser) return;
        setLoading(true);
        const [walletStats, perfData] = await Promise.all([
            analyticsService.getWalletStats(displayUser),
            analyticsService.getPerformanceData(displayUser)
        ]);
        setStats(walletStats);
        setPerformance(perfData);
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const user = searchInput.trim().replace(/^@/, '');
        if (user) {
            navigate(`/analytics/@${user}`);
            setSearchInput('');
        }
    };

    if (!displayUser) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
                <h2 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">Please search for an account to view analytics</h2>
                <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-sm">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Enter Hive username..."
                        className="flex-1 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-2 focus:outline-none focus:border-[var(--primary-color)]"
                    />
                    <button type="submit" className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-xl">Search</button>
                </form>
            </div>
        );
    }

    const maxEarnings = Math.max(...performance.map((p: DailyPerformance) => p.earnings), 0.05);

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)]">Analytics</h1>
                        {displayUser && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 rounded-full">
                                <span className="text-xs font-black text-[var(--primary-color)]">@{displayUser}</span>
                            </div>
                        )}
                    </div>
                    <p className="text-[var(--text-secondary)] font-bold">Insights into Hive journey and performance.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <form onSubmit={handleSearch} className="relative group w-full sm:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--primary-color)] transition-colors" size={18} />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search another account..."
                            className="w-full sm:w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:border-[var(--primary-color)] transition-all font-bold placeholder:text-[var(--text-secondary)]/50"
                        />
                    </form>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {routeUsername && loggedInUser && (
                            <button
                                onClick={() => navigate('/analytics')}
                                className="flex-1 sm:flex-none px-6 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl font-black text-xs uppercase tracking-widest hover:border-[var(--primary-color)] transition-all"
                            >
                                My Stats
                            </button>
                        )}
                        <button
                            onClick={loadData}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary-color)] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                            disabled={loading}
                        >
                            <Activity size={16} className={loading ? 'animate-spin' : ''} />
                            {loading ? '...' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Hive Power', value: stats?.hp || '0.000', unit: 'HP', icon: <TrendingUp className="text-green-500" /> },
                    { label: 'HBD Balance', value: stats?.hbd || '0.000', unit: 'HBD', icon: <Wallet className="text-blue-500" /> },
                    { label: 'Reputation', value: stats?.reputation || '0.0', unit: 'Score', icon: <Award className="text-yellow-500" /> },
                    { label: 'Savings', value: stats?.savings_hbd || '0.000', unit: 'HBD', icon: <BarChart2 className="text-purple-500" /> }
                ].map((item, i: number) => (
                    <div key={i} className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-[var(--bg-canvas)] rounded-2xl group-hover:scale-110 transition-transform">
                                {item.icon}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">{item.label}</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-[var(--text-primary)]">{item.value}</span>
                                <span className="text-xs font-bold text-[var(--text-secondary)]">{item.unit}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Performance Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[var(--bg-card)] p-8 rounded-[2rem] border border-[var(--border-color)] shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-12">
                        <h2 className="text-2xl font-black text-[var(--text-primary)]">Earnings (14 Days)</h2>
                        <div className="flex items-center gap-4 text-xs font-bold uppercase text-[var(--text-secondary)]">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[var(--primary-color)] rounded-full"></div>
                                <span>Recent Rewards</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-4 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none opacity-5">
                            {[1, 2, 3, 4].map(i => <div key={i} className="border-t border-[var(--text-primary)] w-full"></div>)}
                        </div>

                        {performance.length > 0 ? performance.map((day: DailyPerformance, i: number) => {
                            // Scale height but ensure even tiny rewards are visible (minimum 4px)
                            const rawHeight = (day.earnings / maxEarnings) * 100;
                            const height = day.earnings > 0 ? Math.max(rawHeight, 4) : 0;

                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4 group relative">
                                    <div
                                        className={`w-full bg-gradient-to-t ${day.earnings > 0 ? 'from-[var(--primary-color)] to-[var(--primary-color)]/60' : 'from-[var(--text-secondary)]/10 to-[var(--text-secondary)]/5'} rounded-t-xl group-hover:brightness-125 transition-all cursor-pointer relative`}
                                        style={{ height: `${Math.max(height, 2)}%` }}
                                        onClick={() => day.rewardCount > 0 && setSelectedDay(day)}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                            {day.earnings > 0 ? `${day.earnings.toFixed(3)} HBD` : 'No rewards'}
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-[var(--text-secondary)] rotate-45 origin-left whitespace-nowrap">{day.date.split('-').slice(1).join('/')}</span>
                                </div>
                            );
                        }) : (
                            <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] italic">
                                No reward data available for this period.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--bg-card)] p-8 rounded-[2rem] border border-[var(--border-color)] shadow-sm flex flex-col">
                    <h2 className="text-2xl font-black text-[var(--text-primary)] mb-8">Daily Activity</h2>
                    <div className="flex-1 space-y-6 overflow-y-auto max-h-[400px] pr-2 scrollbar-none">
                        {performance.filter((p: DailyPerformance) => p.rewardCount > 0).slice(-10).reverse().map((day: DailyPerformance, i: number) => (
                            <div
                                key={i}
                                onClick={() => setSelectedDay(day)}
                                className="flex items-center justify-between p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]/50 group hover:border-[var(--primary-color)] hover:scale-[1.02] cursor-pointer transition-all"
                            >
                                <div>
                                    <div className="font-bold text-[var(--text-primary)]">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                    <div className="text-xs text-[var(--text-secondary)]">{day.rewardCount} rewards earned</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-[var(--primary-color)]">+{day.earnings.toFixed(3)}</div>
                                    <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">HBD EQ</div>
                                </div>
                            </div>
                        ))}
                        {performance.filter(p => p.rewardCount > 0).length === 0 && (
                            <div className="text-center py-12 text-[var(--text-secondary)] italic">
                                No recent reward activity found in the last 14 days.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reward Details Modal */}
            {selectedDay && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDay(null)}></div>
                    <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-[2.5rem] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8">
                            <div className="flex flex-row items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-[var(--text-primary)]">Reward Details</h3>
                                    <p className="text-[var(--text-secondary)] font-bold">{new Date(selectedDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedDay(null)}
                                    className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedDay.details.map((detail: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-[var(--primary-color)]">{detail.type}</span>
                                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                                                {new Date(detail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-lg font-black text-[var(--text-primary)] mb-2">{detail.amount}</div>
                                        {detail.permlink && (
                                            <a
                                                href={`https://sovraniche.com/@${displayUser}/${detail.permlink}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-bold text-[var(--primary-color)] hover:underline flex items-center gap-1"
                                            >
                                                View Post <Activity size={10} />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
                                <span className="font-bold text-[var(--text-secondary)]">Total Daily Earnings</span>
                                <span className="text-xl font-black text-[var(--primary-color)]">{selectedDay.earnings.toFixed(3)} HBD EQ</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
