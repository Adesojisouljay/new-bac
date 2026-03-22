import React, { useState } from 'react';
import { ArrowLeft, Plus, Activity, FileText, CheckCircle2, Clock, XCircle, ChevronRight, ShieldCheck, Info, Trash2, Edit2, Power, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { P2PService, TradeType, CryptoCurrency, FiatCurrency } from '../../../services/p2pService';
import { useNotification } from '../../../contexts/NotificationContext';
import { NotificationService } from '../../../services/notifications';
import { io, Socket } from 'socket.io-client';

type Tab = 'ORDERS' | 'ADS' | 'CREATE';

// (Mock Arrays Removed)

export default function P2PDashboard() {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState<Tab>('ORDERS');
    const [myOrders, setMyOrders] = useState<any[]>([]);
    const [myAds, setMyAds] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        const username = localStorage.getItem('hive_user');
        if (!username) return setIsLoading(false);
        
        try {
            if (activeTab === 'ORDERS') {
                const orders = await P2PService.getUserOrders(username);
                setMyOrders(orders || []);
            } else if (activeTab === 'ADS') {
                const ads = await P2PService.getUserAds(username);
                setMyAds(ads || []);
            }
        } catch (err) {
            console.error('Failed to load dashboard parameters:', err);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        if (activeTab !== 'CREATE') {
            fetchData();
        }
    }, [activeTab]);

    React.useEffect(() => {
        const username = localStorage.getItem('hive_user');
        if (!username) return;

        const socketInstance = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000', {
            query: { username }
        });

        socketInstance.on('p2p_notification', (data) => {
            if (data && data.message) {
                showNotification(data.title || "New Escrow Activity", 'info');
                NotificationService.addLocalNotification(username, data.message, 'p2p_order', `/market/p2p/${data.orderId}`);
                if (activeTab === 'ORDERS' || activeTab === 'ADS') {
                    fetchData(); // Silently reload the arrays without breaking the view natively
                }
            }
        });

        return () => {
            socketInstance.disconnect();
        };
    }, [activeTab]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <button onClick={() => navigate('/market/p2p')} className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold mb-4 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back to P2P Market
                    </button>
                    <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                        P2P Maker Dashboard <ShieldCheck className="w-6 h-6 text-[var(--primary-color)]" />
                    </h1>
                </div>

                <div className="flex flex-col sm:flex-row bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1 overflow-x-auto shadow-sm custom-scrollbar whitespace-nowrap">
                    <button 
                        onClick={() => setActiveTab('ORDERS')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'ORDERS' ? 'bg-[var(--primary-color)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <Activity className="w-4 h-4" /> My Orders
                    </button>
                    <button 
                        onClick={() => setActiveTab('ADS')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'ADS' ? 'bg-[var(--primary-color)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <FileText className="w-4 h-4" /> My Ads
                    </button>
                    <button 
                        onClick={() => setActiveTab('CREATE')}
                        className={`flex-1 min-w-[130px] py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'CREATE' ? 'bg-[var(--primary-color)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <Plus className="w-4 h-4" /> Post New Ad
                    </button>
                </div>
            </div>

            {/* View Containers */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-sm min-h-[500px] overflow-hidden">
                {activeTab === 'ORDERS' && <OrdersView navigate={navigate} orders={myOrders} isLoading={isLoading} onRefresh={fetchData} />}
                {activeTab === 'ADS' && <AdsManagementView ads={myAds} isLoading={isLoading} setMyAds={setMyAds} />}
                {activeTab === 'CREATE' && <CreateAdView onSuccess={() => {
                    const username = localStorage.getItem('hive_user');
                    if (username) {
                        setIsLoading(true);
                        P2PService.getUserAds(username).then(res => {
                            setMyAds(res);
                            setIsLoading(false);
                            setActiveTab('ADS');
                        });
                    }
                }} />}
            </div>
        </div>
    );
}

function OrdersView({ navigate, orders, isLoading, onRefresh }: { navigate: any, orders: any[], isLoading: boolean, onRefresh: () => void }) {
    return (
        <div className="flex flex-col h-full transition-opacity duration-300">
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                <h2 className="text-xl font-black text-[var(--text-primary)]">Active & Historic Trades</h2>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-lg text-xs font-bold uppercase tracking-wider">{orders.filter(o => o.status === 'AWAITING_PAYMENT' || o.status === 'RELEASING').length} Pending</span>
                    <button 
                        onClick={onRefresh} 
                        className="p-2 text-[var(--text-secondary)] hover:text-white bg-[var(--bg-canvas)] rounded-xl hover:bg-[var(--primary-color)] transition-all flex items-center gap-2"
                        title="Refresh Trades">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Refresh</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-[var(--bg-canvas)]/50 text-[var(--text-secondary)] text-xs uppercase tracking-wider font-bold">
                        <tr>
                            <th className="py-4 px-6 rounded-tl-3xl">Coin</th>
                            <th className="py-4 px-6">Amount</th>
                            <th className="py-4 px-6">Fiat Value</th>
                            <th className="py-4 px-6">Counterparty</th>
                            <th className="py-4 px-6">Status</th>
                            <th className="py-4 px-6 rounded-tr-3xl text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]/50">
                        {isLoading ? (
                            <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-[var(--text-secondary)]">Loading P2P Escrow Ledgers...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-[var(--text-secondary)]">No active trades found.</td></tr>
                        ) : orders.map((order, i) => (
                            <tr key={i} className="hover:bg-[var(--bg-canvas)]/30 transition-colors group cursor-pointer" onClick={() => navigate(`/market/p2p/${order.id || order._id}`)}>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-white text-xs ${order.type === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                                            {order.type === 'BUY' ? 'B' : 'S'}
                                        </div>
                                        <span className="font-black text-[var(--text-primary)]">{order.cryptoCurrency || order.tradeDetails?.cryptoCurrency}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6 font-bold text-[var(--text-primary)]">{Number(order.cryptoAmount || order.tradeDetails?.cryptoAmount).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                <td className="py-4 px-6 font-bold text-[var(--text-primary)]">{Number(order.fiatAmount || order.tradeDetails?.fiatAmount).toLocaleString()} {order.fiatCurrency || order.tradeDetails?.fiatCurrency}</td>
                                <td className="py-4 px-6 font-bold text-[var(--primary-color)]">{localStorage.getItem('hive_user') === order.makerId ? order.takerId : order.makerId}</td>
                                <td className="py-4 px-6">
                                    <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${
                                        order.status === 'COMPLETED' ? 'text-green-500' : 
                                        order.status === 'CANCELLED' || order.status === 'DISPUTED' ? 'text-[var(--text-secondary)]' : 'text-orange-500'
                                    }`}>
                                        {order.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : 
                                         order.status === 'CANCELLED' || order.status === 'DISPUTED' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4 animate-pulse" />}
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <button className="p-2 text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AdsManagementView({ ads, isLoading, setMyAds }: { ads: any[], isLoading: boolean, setMyAds: any }) {
    const { showNotification, showConfirm } = useNotification();
    const [editingAd, setEditingAd] = useState<any>(null);
    const [editPrice, setEditPrice] = useState('');
    
    const handleDeleteAd = async (adId: string) => {
        const confirmed = await showConfirm("Close Advertisement", "Are you sure you want to officially Close / Deactivate this Ad?\n\nIf this was a SELL Ad, your leftover escrow liquidity will be automatically refunded back to your Hive wallet via the Node Server!");
        if (!confirmed) return;
        
        try {
            await P2PService.closeAd(adId);
            setMyAds((prev: any[]) => prev.filter(ad => (ad._id || ad.id) !== adId));
            showNotification("Advertisement successfully closed and any locked liquidity refunded!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to close Ad. Escrow refund sequence might have failed or active trades are blocking it.", "error");
        }
    };

    const handleUpdatePrice = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const updated = await P2PService.updateAd(editingAd._id || editingAd.id, { price: Number(editPrice) });
            setMyAds((prev: any[]) => prev.map(ad => (ad._id || ad.id) === (editingAd._id || editingAd.id) ? { ...ad, price: updated.price } : ad));
            setEditingAd(null);
            showNotification("Ad Exchange Rate dynamically updated without touching escrow!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to update Ad price.", "error");
        }
    };

    return (
        <div className="flex flex-col h-full transition-opacity duration-300">
            <div className="p-6 border-b border-[var(--border-color)]">
                <h2 className="text-xl font-black text-[var(--text-primary)]">My Published Advertisements</h2>
                <p className="text-sm text-[var(--text-secondary)] font-medium mt-1">Manage your active liquidity flows and Merchant statuses.</p>
            </div>

            <div className="p-6 space-y-4">
                {isLoading ? (
                    <div className="py-12 text-center text-sm font-bold text-[var(--text-secondary)]">Loading P2P Advertisements...</div>
                ) : ads.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-[var(--border-color)] rounded-3xl flex flex-col items-center">
                        <FileText className="w-10 h-10 text-[var(--text-secondary)] mb-3 opacity-50" />
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">No Active Ads</h3>
                        <p className="text-sm font-medium text-[var(--text-secondary)]">You haven't published any P2P liquidity flows yet.</p>
                    </div>
                ) : ads.map((ad, i) => (
                    <div key={i} className="border border-[var(--border-color)] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[var(--primary-color)]/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-xl text-white font-black text-center min-w-[60px] ${ad.type === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                                {ad.type}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[var(--text-primary)]">{ad.cryptoCurrency} / {ad.fiatCurrency}</h3>
                                <div className="text-sm font-bold text-[var(--text-secondary)] mt-1">Limits: <span className="text-[var(--text-primary)]">{Number(ad.minLimit).toLocaleString()} - {Number(ad.maxLimit).toLocaleString()} {ad.fiatCurrency}</span></div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 border-t border-[var(--border-color)]/50 pt-4 md:pt-0 md:border-none">
                            <div className="flex flex-col md:items-end">
                                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Fixed Rate</span>
                                {editingAd && (editingAd._id || editingAd.id) === (ad._id || ad.id) ? (
                                    <form onSubmit={handleUpdatePrice} className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={editPrice}
                                            onChange={e => setEditPrice(e.target.value)}
                                            className="w-24 bg-[var(--bg-canvas)] border border-[var(--primary-color)] rounded-lg px-2 py-1 text-sm font-bold text-[var(--text-primary)] outline-none"
                                            autoFocus
                                        />
                                        <button type="submit" className="text-xs font-bold text-white bg-[var(--primary-color)] px-2 py-1 rounded-lg">Save</button>
                                        <button type="button" onClick={() => setEditingAd(null)} className="text-xs font-bold text-[var(--text-secondary)] px-2 py-1 hover:text-[var(--text-primary)]">Cancel</button>
                                    </form>
                                ) : (
                                    <span className="text-xl font-black text-[var(--primary-color)]">{ad.price} {ad.fiatCurrency}</span>
                                )}
                            </div>

                            <div className="w-[1px] h-10 bg-[var(--border-color)] hidden md:block"></div>

                            <div className="flex items-center gap-3">
                                <button className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wider border-2 transition-all ${
                                    ad.isActive || ad.status === 'ACTIVE' 
                                    ? 'border-green-500 text-green-500 bg-green-500/10' 
                                    : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                                }`}>
                                    {ad.isActive || ad.status === 'ACTIVE' ? 'Live' : 'Hidden'}
                                </button>
                                <button 
                                    onClick={() => { setEditingAd(ad); setEditPrice(ad.price); }}
                                    title="Edit Exchange Rate"
                                    className="p-2 text-[var(--primary-color)] hover:text-white transition-colors rounded-xl bg-[var(--primary-color)]/10 hover:bg-[var(--primary-color)]">
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteAd(ad._id || ad.id)}
                                    title="Close Ad & Refund Remaining Liquidity"
                                    className="p-2 text-red-500 hover:text-white transition-colors rounded-xl bg-red-500/10 hover:bg-red-500">
                                    <Power className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CreateAdView({ onSuccess }: { onSuccess?: () => void }) {
    const { showNotification, showConfirm } = useNotification();
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hiveBalance, setHiveBalance] = useState<number | null>(null);
    const [marketRates, setMarketRates] = useState<any>(null);
    const [savedBanks, setSavedBanks] = useState<any[]>([]);
    const [isAddingBank, setIsAddingBank] = useState(false);
    const [newBank, setNewBank] = useState({ bankName: '', accountName: '', accountNumber: '' });

    React.useEffect(() => {
        const fetchBalance = async () => {
             const username = localStorage.getItem('hive_user');
             if (username) {
                 import('../../../services/unified').then(({ UnifiedDataService }) => {
                     UnifiedDataService.getWallet(username).then((wallet: any) => {
                         if (wallet && wallet.balance) {
                             setHiveBalance(parseFloat(wallet.balance) || 0);
                         }
                     }).catch(console.error);
                 });
             }
        };
        fetchBalance();

        const username = localStorage.getItem('hive_user');
        if (username) {
            P2PService.getBankAccounts(username)
                .then(banks => setSavedBanks(banks ? banks.map((b: any) => ({
                    _id: b._id,
                    bankName: b.bankName,
                    accountName: b.accountName,
                    accountNumber: b.accountNumber
                })) : []))
                .catch(console.error);
        }

        fetch('https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd,ngn,eur,gbp,ghs,mxn')
            .then(res => res.json())
            .then(data => setMarketRates(data))
            .catch(console.error);
    }, []);

    const [formData, setFormData] = useState({
        type: 'SELL' as TradeType,
        cryptoCurrency: 'HIVE' as CryptoCurrency,
        fiatCurrency: (localStorage.getItem('p2p_preferred_fiat') as FiatCurrency) || 'USD',
        price: '',
        minLimit: '',
        maxLimit: '',
        terms: '',
        paymentMethods: [] as string[],
        bankName: '',
        accountName: '',
        accountNumber: ''
    });

    const cryptoId = formData.cryptoCurrency === 'HIVE' ? 'hive' : 'hive_dollar';
    const fiatId = formData.fiatCurrency.toLowerCase();
    const livePrice = marketRates?.[cryptoId]?.[fiatId] || null;

    const togglePaymentMethod = (method: string) => {
        setFormData(prev => ({
            ...prev,
            paymentMethods: prev.paymentMethods.includes(method)
                ? prev.paymentMethods.filter(m => m !== method)
                : [...prev.paymentMethods, method]
        }));
    };

    const handleAddBank = async () => {
        try {
            const added = await P2PService.addBankAccount(newBank);
            setSavedBanks(prev => [added, ...prev]);
            setFormData(prev => ({ ...prev, bankName: added.bankName, accountName: added.accountName, accountNumber: added.accountNumber }));
            setIsAddingBank(false);
            setNewBank({ bankName: '', accountName: '', accountNumber: '' });
            showNotification("Bank Account successfully added!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to save bank account.", "error");
        }
    };

    const handleDeleteBank = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = await showConfirm('Delete Bank Account', 'Delete this saved bank account?');
        if (!confirmed) return;
        try {
            await P2PService.deleteBankAccount(id);
            setSavedBanks(prev => prev.filter(b => b._id !== id));
            const deletedBank = savedBanks.find(b => b._id === id);
            if (deletedBank && formData.bankName === deletedBank.bankName && formData.accountNumber === deletedBank.accountNumber) {
                 setFormData(prev => ({ ...prev, bankName: '', accountName: '', accountNumber: '' }));
            }
            showNotification("Bank Account deleted.", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to delete bank account.", "error");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const username = localStorage.getItem('hive_user') || 'adesojisouljay';
            
            const submitAdToBackend = async () => {
                const payload = {
                    makerId: username,
                    ...formData,
                    price: Number(formData.price),
                    minLimit: Number(formData.minLimit),
                    maxLimit: Number(formData.maxLimit),
                    bankDetails: formData.type === 'SELL' ? {
                        bankName: formData.bankName,
                        accountName: formData.accountName,
                        accountNumber: formData.accountNumber
                    } : undefined
                };
                await P2PService.createAd(payload);
                showNotification('Liquidity Ad Published Successfully to the Database!', 'success');
                setFormData(prev => ({ ...prev, price: '', minLimit: '', maxLimit: '', terms: '', paymentMethods: [], bankName: '', accountName: '', accountNumber: '' }));
                setIsSubmitting(false);
                setShowSuccessModal(true);
            };

            if (formData.type === 'SELL') {
                if (hiveBalance === null) {
                    showNotification('Still fetching wallet balance, please wait.', 'info');
                    setIsSubmitting(false);
                    return;
                }
                const requestedHive = Number(formData.maxLimit) / Number(formData.price);
                if (requestedHive > hiveBalance) {
                    showNotification(`Insufficient Balance: You are trying to sell ${requestedHive.toFixed(3)} ${formData.cryptoCurrency}, but you only have ${hiveBalance.toFixed(3)} ${formData.cryptoCurrency} available.`, 'error');
                    setIsSubmitting(false);
                    return;
                }

                const amountFixed = requestedHive.toFixed(3);
                const escrowAccount = import.meta.env.VITE_P2P_ESCROW_ACCOUNT || 'sovra.escrow';
                const hiveWindow = window as any;

                if (!hiveWindow.hive_keychain) {
                    showNotification('Hive Keychain is required to authorize Escrow creation.', 'error');
                    setIsSubmitting(false);
                    return;
                }

                hiveWindow.hive_keychain.requestTransfer(
                    username,
                    escrowAccount,
                    amountFixed,
                    `Sovraniche P2P Liquidity: SELL Ad ${amountFixed} ${formData.cryptoCurrency}`,
                    formData.cryptoCurrency,
                    (response: any) => {
                        if (response.success) {
                            submitAdToBackend().catch(err => {
                                console.error('Failed to post ad after locking escrow', err);
                                showNotification('Escrow locked securely, but failed to post Ad to database. Contact Admin.', 'error');
                                setIsSubmitting(false);
                            });
                        } else {
                            showNotification('Escrow initialization was rejected by user.', 'warning');
                            setIsSubmitting(false);
                        }
                    },
                    true // enforce
                );
            } else {
                await submitAdToBackend();
            }
        } catch (error) {
            console.error(error);
            showNotification('Failed to construct the P2P record.', 'error');
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full p-6 transition-opacity duration-300">
            <div className="max-w-2xl mx-auto w-full">
                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-black text-[var(--text-primary)]">Post New Liquidity Ad</h2>
                    <p className="text-sm text-[var(--text-secondary)] font-medium mt-2">Configure your margins, limits, and supported banking networks to go live on the P2P Marketplace.</p>
                </div>

                <div className="space-y-6 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8">
                    
                    {/* Trade Type Selector */}
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">I Want To</label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: 'BUY' }))}
                                className={`flex-1 py-4 px-6 rounded-xl font-black text-lg transition-all border-2 ${
                                    formData.type === 'BUY' ? 'bg-green-500 text-white shadow-md border-green-400 focus:ring-4 ring-green-500/20' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-green-500 hover:text-green-500'
                                }`}>Buy Crypto</button>
                            <button 
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: 'SELL' }))}
                                className={`flex-1 py-4 px-6 rounded-xl font-black text-lg transition-all border-2 ${
                                    formData.type === 'SELL' ? 'bg-red-500 text-white shadow-md border-red-400 focus:ring-4 ring-red-500/20' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-red-500 hover:text-red-500'
                                }`}>Sell Crypto</button>
                        </div>
                    </div>

                    {/* Assets */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">Asset</label>
                            <select 
                                value={formData.cryptoCurrency}
                                onChange={(e) => setFormData(prev => ({ ...prev, cryptoCurrency: e.target.value as CryptoCurrency }))}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-4 outline-none focus:border-[var(--primary-color)] transition-colors text-base font-bold text-[var(--text-primary)] cursor-pointer"
                            >
                                <option>HIVE</option>
                                <option>HBD</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">With Fiat</label>
                            <select 
                                value={formData.fiatCurrency}
                                onChange={(e) => {
                                    const val = e.target.value as FiatCurrency;
                                    localStorage.setItem('p2p_preferred_fiat', val);
                                    setFormData(prev => ({ ...prev, fiatCurrency: val }));
                                }}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-4 outline-none focus:border-[var(--primary-color)] transition-colors text-base font-bold text-[var(--text-primary)] cursor-pointer"
                            >
                                <option>USD</option>
                                <option>NGN</option>
                                <option>EUR</option>
                                <option>GBP</option>
                                <option>GHS</option>
                                <option>MXN</option>
                            </select>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                                Set Your Price Rate <span className="text-[10px] font-medium lowercase normal-case opacity-70">(e.g., 1500 for NGN / 1.05 for USD)</span>
                            </label>
                            {livePrice && (
                                <span className="text-xs font-black text-[var(--primary-color)] bg-[var(--primary-color)]/10 px-2 py-1 rounded-lg">
                                    Global Rate: {livePrice.toLocaleString()} {formData.fiatCurrency}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input 
                                type="number" 
                                required
                                value={formData.price}
                                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                placeholder="0.00" 
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-4 outline-none focus:border-[var(--primary-color)] transition-colors text-xl font-black text-[var(--text-primary)]" 
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-[var(--text-secondary)]">Fiat Rate</span>
                        </div>
                    </div>

                    {/* Transaction Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">
                                Min Order Limit <span className="text-[10px] font-medium lowercase normal-case opacity-70">(lowest fiat amount)</span>
                            </label>
                            <input 
                                type="number" 
                                required
                                value={formData.minLimit}
                                onChange={(e) => setFormData(prev => ({ ...prev, minLimit: e.target.value }))}
                                placeholder="Min Fiat" 
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-4 outline-none focus:border-[var(--primary-color)] transition-colors font-bold text-[var(--text-primary)]" 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">
                                Max Order Limit <span className="text-[10px] font-medium lowercase normal-case opacity-70">(highest fiat amount)</span>
                            </label>
                            <input 
                                type="number" 
                                required
                                value={formData.maxLimit}
                                onChange={(e) => setFormData(prev => ({ ...prev, maxLimit: e.target.value }))}
                                placeholder="Max Fiat" 
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-4 outline-none focus:border-[var(--primary-color)] transition-colors font-bold text-[var(--text-primary)]" 
                            />
                        </div>
                    </div>

                    {/* Payment Methods Checkboxes */}
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">Supported Payment Channels</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {['Bank Transfer', 'Opay', 'Kuda', 'PalmPay'].map(method => (
                                <label key={method} className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl cursor-pointer hover:border-[var(--primary-color)]/50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.paymentMethods.includes(method)}
                                        onChange={() => togglePaymentMethod(method)}
                                        className="w-4 h-4 accent-[var(--primary-color)] rounded" 
                                    />
                                    <span className="text-sm font-bold text-[var(--text-primary)]">{method}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Render Bank Details for Sellers */}
                    {formData.type === 'SELL' && (
                        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 block">Your Receiving Bank Account</label>
                            
                            {savedBanks.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    {savedBanks.map(bank => {
                                        const isSelected = formData.bankName === bank.bankName && formData.accountNumber === bank.accountNumber;
                                        return (
                                            <div 
                                                key={bank._id} 
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber }));
                                                    setIsAddingBank(false);
                                                }}
                                                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5' : 'border-[var(--border-color)] hover:border-[var(--text-secondary)]/50'}`}
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-[var(--text-primary)]">{bank.bankName} - {bank.accountNumber}</div>
                                                    <div className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">{bank.accountName}</div>
                                                </div>
                                                {isSelected ? (
                                                    <CheckCircle2 className="w-5 h-5 text-[var(--primary-color)]" />
                                                ) : (
                                                    <button onClick={(e) => handleDeleteBank(bank._id, e)} className="p-2 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {!isAddingBank ? (
                                <button type="button" onClick={() => setIsAddingBank(true)} className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] rounded-xl text-sm font-bold hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-all">
                                    <Plus className="w-4 h-4" /> Add New Bank Account
                                </button>
                            ) : (
                                <div className="p-5 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl space-y-4">
                                    <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Register New Bank</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <input type="text" placeholder="Bank Name" value={newBank.bankName} onChange={e => setNewBank({ ...newBank, bankName: e.target.value })} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--primary-color)] text-sm font-bold text-[var(--text-primary)]" />
                                        <input type="text" placeholder="Account Name" value={newBank.accountName} onChange={e => setNewBank({ ...newBank, accountName: e.target.value })} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--primary-color)] text-sm font-bold text-[var(--text-primary)]" />
                                    </div>
                                    <input type="text" placeholder="Account Number" value={newBank.accountNumber} onChange={e => setNewBank({ ...newBank, accountNumber: e.target.value })} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--primary-color)] text-base font-mono font-bold text-[var(--text-primary)] tracking-widest" />
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setIsAddingBank(false)} className="flex-1 py-3 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-[var(--border-color)]">Cancel</button>
                                        <button type="button" onClick={handleAddBank} disabled={!newBank.bankName || !newBank.accountName || !newBank.accountNumber} className="flex-1 py-3 bg-[var(--primary-color)] text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-[var(--primary-color)]/20">Save & Use</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Terms & Conditions */}
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 block">Merchant Terms (Optional)</label>
                        <textarea 
                            rows={3} 
                            value={formData.terms}
                            onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                            placeholder="State your trading rules here. E.g., 'No crypto references in narration.'"
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-4 outline-none focus:border-[var(--primary-color)] transition-colors font-medium text-[var(--text-primary)] custom-scrollbar resize-none"
                        ></textarea>
                    </div>

                    {/* Submit Ribbon */}
                    <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                        <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                            <Info className="w-4 h-4" /> Assets will be locked upon match.
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || formData.paymentMethods.length === 0 || (formData.type === 'SELL' && (!formData.bankName || !formData.accountName || !formData.accountNumber))}
                            className="px-8 py-4 bg-[var(--primary-color)] text-white font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[var(--primary-color)]/25 shadow-lg disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Publishing...' : 'Publish Ad'}
                        </button>
                    </div>
                </div>
            </div>

            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowSuccessModal(false); if(onSuccess) onSuccess(); }} />
                    <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2 tracking-tight">Ad Published!</h2>
                        <p className="text-[var(--text-secondary)] font-medium mb-8">Your P2P Liquidity Ad has been successfully deployed and is now live on the marketplace.</p>
                        <button 
                            type="button"
                            onClick={() => { setShowSuccessModal(false); if(onSuccess) onSuccess(); }}
                            className="w-full py-4 bg-[var(--primary-color)] text-white rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[var(--primary-color)]/25 shadow-lg"
                        >
                            View Active Ads
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}
