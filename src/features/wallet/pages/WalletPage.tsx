import { lazy, Suspense } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';

const HiveWallet = lazy(() => import('../tabs/HiveWallet').then(m => ({ default: m.HiveWallet })));
const PointsWallet = lazy(() => import('../tabs/PointsWallet').then(m => ({ default: m.PointsWallet })));
const Web3Wallets = lazy(() => import('../tabs/Web3Wallets').then(m => ({ default: m.Web3Wallets })));

type TabId = 'hive' | 'points' | 'web3';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'hive', label: 'Hive Wallet', icon: '🐝' },
    { id: 'points', label: 'Points Wallet', icon: '⭐' },
    { id: 'web3', label: 'Web3 Wallets', icon: '🔗' },
];

function TabSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]" />
            ))}
        </div>
    );
}

export default function WalletPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    // Username comes from the URL: /@username/wallet
    const { username: urlUsername } = useParams<{ username: string }>();
    const activeTab = (searchParams.get('tab') as TabId) || 'hive';

    const walletUsername = (urlUsername || localStorage.getItem('hive_user') || '').replace(/^@/, '');



    const setTab = (tab: TabId) => {
        setSearchParams({ tab });
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Back to profile */}
            {walletUsername && (
                <Link
                    to={`/@${walletUsername}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Profile
                </Link>
            )}

            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                    {walletUsername ? `@${walletUsername}'s Wallet` : 'Wallet'}
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Manage your Hive, points, and multi-chain crypto assets.
                </p>
            </div>

            {!walletUsername && (
                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl text-center text-[var(--text-secondary)] text-sm">
                    Please log in to view your wallet.
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-1.5">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                            ? 'bg-[var(--primary-color)] text-white shadow-md shadow-[var(--primary-color)]/20'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
                            }`}
                    >
                        <span className="text-base leading-none">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content — only renders when active, lazy-loaded */}
            <Suspense fallback={<TabSkeleton />}>
                {activeTab === 'hive' && walletUsername && <HiveWallet username={walletUsername} />}
                {activeTab === 'points' && walletUsername && <PointsWallet username={walletUsername} />}
                {activeTab === 'web3' && <Web3Wallets username={walletUsername} />}
            </Suspense>
        </div>
    );
}
