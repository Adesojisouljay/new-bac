import { TransactionList } from './TransactionList';
import { WalletActionsModal } from '../../wallet/components/WalletActionsModal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../../contexts/NotificationContext';
import { transactionService } from '../../wallet/services/transactionService';

interface WalletViewProps {
    wallet: any;
    history: any[];
    username: string; // Needed for TransactionList
    loading: boolean;
    onLoadMore?: () => void;
    loadingHistory?: boolean;
}

export function WalletView({ wallet, history, username, loading, onLoadMore, loadingHistory }: WalletViewProps) {
    const { showNotification, showConfirm } = useNotification();
    // For modal state
    const [actionFunc, setActionFunc] = useState<{ type: any, initial?: any } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const navigate = useNavigate();

    // Helper to convert VESTS to HP
    const vestsToHP = (vests: string | number) => {
        if (!wallet.globalProps) return vests.toString();
        const v = typeof vests === 'string' ? parseFloat(vests) : vests;
        const totalVests = parseFloat(wallet.globalProps.total_vesting_shares);
        const totalHive = parseFloat(wallet.globalProps.total_vesting_fund_hive);
        return ((v * totalHive) / totalVests).toFixed(3);
    };

    const handleStopPowerDown = async () => {
        const confirmed = await showConfirm("Stop Power Down", "Are you sure you want to cancel your current power down?");
        if (!confirmed) return;

        setActionLoading(true);
        try {
            const result = await transactionService.broadcast({
                type: 'power_down',
                username,
                amount: '0.000'
            }, () => {
                showNotification("Action required: Sign with your Hive wallet.", 'info');
            });

            if (result.success) {
                showNotification("Power down cancelled successfully!", 'success');
                // Ideally refresh wallet here
            } else {
                showNotification("Failed to cancel power down: " + result.error, 'error');
            }
        } catch (error: any) {
            showNotification("Error: " + error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                ))}
            </div>
        );
    }

    if (!wallet) return <div className="text-center py-8">Wallet data unavailable</div>;

    // Helper to calculate total value
    const calculateEstimatedValue = () => {
        if (!wallet || !wallet.hive_price) return '0.00';

        const hivePrice = wallet.hive_price;
        const hiveBalance = parseFloat(wallet.balance);
        const hbdBalance = parseFloat(wallet.hbd_balance);
        const savingsHive = parseFloat(wallet.savings_balance);
        const savingsHbd = parseFloat(wallet.savings_hbd_balance);
        const hpBalance = parseFloat(vestsToHP(wallet.vesting_shares));

        const totalHive = hiveBalance + hpBalance + savingsHive;
        const totalHbd = hbdBalance + savingsHbd;

        return (totalHive * hivePrice + totalHbd).toFixed(2);
    };

    const assets = [
        {
            name: 'Estimated Account Value',
            balance: `$${calculateEstimatedValue()}`,
            desc: 'The total value of HIVE, HBD, and HP based on current market rates.',
            color: 'bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)] text-white',
            featured: true,
            icon: '💎',
            actions: []
        },
        {
            name: 'HIVE',
            balance: wallet.balance,
            desc: 'Liquid tokens',
            color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
            icon: '💰',
            actions: [
                { label: 'Transfer', onClick: () => setActionFunc({ type: 'transfer', initial: { currency: 'HIVE' } }) },
                { label: 'Power Up', onClick: () => setActionFunc({ type: 'powerup', initial: { currency: 'HIVE' } }) },
                { label: 'Savings', onClick: () => setActionFunc({ type: 'deposit_savings', initial: { currency: 'HIVE' } }) },
                { label: 'Market', onClick: () => navigate('/market') }
            ]
        },
        {
            name: 'HBD',
            balance: wallet.hbd_balance,
            desc: 'Hive Backed Dollars',
            color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            icon: '💵',
            actions: [
                { label: 'Transfer', onClick: () => setActionFunc({ type: 'transfer', initial: { currency: 'HBD' } }) },
                { label: 'Savings', onClick: () => setActionFunc({ type: 'deposit_savings', initial: { currency: 'HBD' } }) },
                { label: 'Market', onClick: () => navigate('/market') }
            ]
        },
        {
            name: 'HIVE POWER',
            balance: `${vestsToHP(wallet.vesting_shares)} HP`,
            desc: 'Influences rewards, voting, and Resource Credits.',
            info: 'HP represents your stake in the network. It determines your voting influence on posts and communities, and governs how many Resource Credits (RC) you generate daily.',
            color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            icon: '⚡',
            isPD: parseFloat(wallet.to_withdraw) > 0,
            pdAmount: vestsToHP(parseFloat(wallet.to_withdraw) / 1e6), // to_withdraw is in micro-vests usually
            pdWeeks: Math.ceil(parseFloat(wallet.to_withdraw) / parseFloat(wallet.vesting_withdraw_rate)),
            actions: [
                { label: 'Delegate', onClick: () => setActionFunc({ type: 'delegate' }) },
                { label: 'Power Down', onClick: () => setActionFunc({ type: 'powerdown' }) }
            ]
        },
        {
            name: 'SAVINGS',
            balance: `${wallet.savings_balance} / ${wallet.savings_hbd_balance}`,
            desc: `Secure long-term storage.`,
            apr: wallet.globalProps ? `${(wallet.globalProps.hbd_interest_rate / 100).toFixed(0)}% APR` : undefined,
            color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            icon: '🏦',
            actions: [
                { label: 'Withdraw HIVE', onClick: () => setActionFunc({ type: 'withdraw_savings', initial: { currency: 'HIVE' } }) },
                { label: 'Withdraw HBD', onClick: () => setActionFunc({ type: 'withdraw_savings', initial: { currency: 'HBD' } }) }
            ]
        },
        {
            name: 'RESOURCE CREDITS',
            balance: wallet.rc ? `${wallet.rc.percentage}%` : '0%',
            desc: wallet.rc ? `Mana: ${(wallet.rc.current / 1e9).toFixed(1)}B / ${(wallet.rc.max / 1e9).toFixed(1)}B` : 'Loading RC...',
            color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
            icon: '🔋',
            rc: wallet.rc,
            fullWidth: true,
            actions: [
                { label: 'Delegate RC', onClick: () => setActionFunc({ type: 'delegate_rc' }) }
            ]
        }
    ];

    const getEstimations = (rc: any) => {
        if (!rc) return [];
        return [
            { label: 'Votes', count: Math.floor(rc.current / 0.005e9), icon: '👍' },
            { label: 'Comments', count: Math.floor(rc.current / 0.1e9), icon: '💬' },
            { label: 'Posts', count: Math.floor(rc.current / 0.1e9), icon: '📝' },
            { label: 'Reblogs', count: Math.floor(rc.current / 0.05e9), icon: '🔄' },
        ];
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map((asset: any) => (
                <div
                    key={asset.name}
                    className={`bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${asset.featured || asset.fullWidth ? 'md:col-span-2' : ''} ${asset.featured ? 'border-[var(--primary-color)]/30 border-2' : ''}`}
                >
                    <div className={asset.featured ? 'flex flex-col md:flex-row md:items-center justify-between gap-6' : ''}>
                        <div className="flex justify-between items-start mb-4 flex-1">
                            <div>
                                <h3 className={`font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider ${asset.featured ? 'text-xs' : 'text-[10px]'}`}>{asset.name}</h3>
                                <p className={`font-bold text-[var(--text-primary)] ${asset.featured ? 'text-4xl md:text-5xl' : 'text-2xl'}`}>{asset.balance}</p>
                            </div>
                            <div className={`p-3 rounded-2xl ${asset.color} ${asset.featured ? 'shadow-lg shadow-[var(--primary-color)]/20' : ''}`}>
                                <span className="text-2xl">{asset.icon}</span>
                            </div>
                        </div>

                        {asset.featured && (
                            <div className="md:max-w-xs">
                                <p className="text-sm text-[var(--text-secondary)] opacity-80 leading-relaxed italic">
                                    "{asset.desc}"
                                </p>
                            </div>
                        )}

                        {!asset.featured && (
                            <p className="text-xs text-[var(--text-secondary)] mb-2">{asset.desc}</p>
                        )}

                        {asset.info && (
                            <div className="mb-4 p-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl">
                                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed italic">
                                    {asset.info}
                                </p>
                            </div>
                        )}

                        {asset.apr && (
                            <div className="mb-4 p-2 bg-green-500/5 border border-green-500/10 rounded-lg inline-flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">HBD Interest:</span>
                                <span className="text-xs font-bold text-green-600">{asset.apr}</span>
                            </div>
                        )}

                        {asset.name === 'HIVE POWER' && asset.isPD && (
                            <div className="mb-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <p className="text-xs font-bold text-blue-500 mb-1 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                    Active Power Down
                                </p>
                                <p className="text-xs text-[var(--text-primary)] mb-2">
                                    Powering down <span className="font-bold">{asset.pdAmount} HP</span> ({asset.pdWeeks} weeks left)
                                </p>
                                {localStorage.getItem('hive_user') === username && (
                                    <button
                                        onClick={handleStopPowerDown}
                                        disabled={actionLoading}
                                        className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                                    >
                                        {actionLoading ? 'Stopping...' : 'Stop Power Down ✕'}
                                    </button>
                                )}
                            </div>
                        )}

                        {asset.name === 'RESOURCE CREDITS' && asset.rc && (
                            <>
                                <div className="w-full h-2 bg-[var(--border-color)] rounded-full overflow-hidden mb-6">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                        style={{ width: `${asset.balance}` }}
                                    />
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                                        <span className="w-1 h-1 bg-[var(--primary-color)] rounded-full"></span>
                                        Estimated Actions Available
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {getEstimations(asset.rc).map(est => (
                                            <div key={est.label} className="bg-[var(--bg-canvas)] rounded-xl p-3 border border-[var(--border-color)] flex flex-col items-center hover:border-[var(--primary-color)]/30 transition-colors group">
                                                <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{est.icon}</span>
                                                <span className="text-base font-bold text-[var(--text-primary)] leading-tight">{est.count.toLocaleString()}</span>
                                                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-tight">{est.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {localStorage.getItem('hive_user') === username && (
                        <div className="flex gap-2">
                            {asset.actions.map((action: any) => (
                                <button
                                    key={action.label}
                                    onClick={action.onClick}
                                    className="flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-[var(--border-color)] hover:bg-[var(--bg-canvas)] hover:border-[var(--primary-color)] transition-all text-[var(--text-primary)]"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {/* Modal */}
            {actionFunc && (
                <WalletActionsModal
                    isOpen={!!actionFunc}
                    onClose={() => setActionFunc(null)}
                    type={actionFunc.type}
                    username={username}
                    initialData={actionFunc.initial}
                    onSuccess={() => { /* Refresh wallet logic could go here */ }}
                />
            )}



            {/* Transaction History */}
            <div className="md:col-span-2 mt-6">
                <TransactionList
                    transactions={history}
                    username={username}
                    onLoadMore={onLoadMore}
                    loading={loadingHistory}
                />
            </div>
        </div>
    );
}
