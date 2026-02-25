import { useState, useEffect } from 'react';
import { analyticsService, DailyPerformance } from '../services/analyticsService';
import { TrendingUp, Wallet, Award, Activity, BarChart2 } from 'lucide-react';

export function AnalyticsPage() {
    const [stats, setStats] = useState<any>(null);
    const [performance, setPerformance] = useState<DailyPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [username] = useState(localStorage.getItem('hive_user'));

    useEffect(() => {
        if (username) {
            loadData();
        }
    }, [username]);

    const loadData = async () => {
        if (!username) return;
        setLoading(true);
        const [walletStats, perfData] = await Promise.all([
            analyticsService.getWalletStats(username),
            analyticsService.getPerformanceData(username)
        ]);
        setStats(walletStats);
        setPerformance(perfData);
        setLoading(false);
    };

    if (!username) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
                <h2 className="text-2xl font-bold mb-4">Please log in to view analytics</h2>
            </div>
        );
    }

    const maxEarnings = Math.max(...performance.map(p => p.earnings), 0.1);

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] mb-2">My Analytics</h1>
                    <p className="text-[var(--text-secondary)]">Insights into your Hive journey and performance.</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl font-bold hover:bg-[var(--bg-canvas)] transition-all"
                    disabled={loading}
                >
                    <Activity size={20} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Hive Power', value: stats?.hp || '0.000', unit: 'HP', icon: <TrendingUp className="text-green-500" /> },
                    { label: 'HBD Balance', value: stats?.hbd || '0.000', unit: 'HBD', icon: <Wallet className="text-blue-500" /> },
                    { label: 'Reputation', value: stats?.reputation || '0.0', unit: 'Score', icon: <Award className="text-yellow-500" /> },
                    { label: 'Savings', value: stats?.savings_hbd || '0.000', unit: 'HBD', icon: <BarChart2 className="text-purple-500" /> }
                ].map((item, i) => (
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

                        {performance.length > 0 ? performance.map((day, i) => {
                            const height = (day.earnings / maxEarnings) * 100;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4 group relative">
                                    <div
                                        className="w-full bg-gradient-to-t from-[var(--primary-color)] to-[var(--primary-color)]/60 rounded-t-xl group-hover:brightness-125 transition-all cursor-crosshair relative"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                            {day.earnings.toFixed(3)} HBD
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] rotate-45 origin-left">{day.date.split('-').slice(1).join('/')}</span>
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
                    <div className="flex-1 space-y-6">
                        {performance.slice(-5).reverse().map((day, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]/50 group hover:border-[var(--primary-color)]/30 transition-all">
                                <div>
                                    <div className="font-bold text-[var(--text-primary)]">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                    <div className="text-xs text-[var(--text-secondary)]">{day.votesReceived} votes received</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-[var(--primary-color)]">+{day.earnings.toFixed(2)}</div>
                                    <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">HBD EQ</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="mt-8 w-full py-4 text-sm font-bold text-[var(--primary-color)] bg-[var(--primary-color)]/5 rounded-2xl hover:bg-[var(--primary-color)]/10 transition-all">
                        View Detailed Log
                    </button>
                </div>
            </div>
        </div>
    );
}
