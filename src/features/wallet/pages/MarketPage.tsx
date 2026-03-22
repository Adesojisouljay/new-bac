import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { UnifiedDataService, MarketTicker, OrderBook, MarketTrade, OpenOrder } from '../../../services/unified';
import { P2PService, P2PAd, TradeType, CryptoCurrency, FiatCurrency } from '../../../services/p2pService';
import { transactionService } from '../services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import P2POrderModal from '../components/P2POrderModal';

export default function MarketPage() {
    const [ticker, setTicker] = useState<MarketTicker | null>(null);
    const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
    const [trades, setTrades] = useState<MarketTrade[]>([]);
    const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
    const [wallet, setWallet] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { showNotification, showConfirm } = useNotification();
    const navigate = useNavigate();
    const location = useLocation();
    const isP2P = location.pathname.includes('/market/p2p');
    const username = localStorage.getItem('hive_user');

    const fetchData = async () => {
        const [tickerData, bookData, tradesData] = await Promise.all([
            UnifiedDataService.getMarketTicker(),
            UnifiedDataService.getMarketOrderBook(20),
            UnifiedDataService.getMarketRecentTrades(20)
        ]);

        setTicker(tickerData);
        setOrderBook(bookData);
        setTrades(tradesData);

        if (username) {
            const [myOrders, walletData] = await Promise.all([
                UnifiedDataService.getOpenOrders(username),
                UnifiedDataService.getWallet(username)
            ]);
            setOpenOrders(myOrders);
            setWallet(walletData);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Polling every 30s
        return () => clearInterval(interval);
    }, [username]);

    const handleCancelOrder = async (orderId: number) => {
        if (!username) return;
        const confirmed = await showConfirm("Cancel Order", `Are you sure you want to cancel order #${orderId}?`);
        if (!confirmed) return;

        setSubmitting(true);
        try {
            const res = await transactionService.broadcast({
                type: 'limit_order_cancel',
                username,
                orderid: orderId
            });

            if (res.success) {
                showNotification('Order cancelled successfully!', 'success');
                fetchData();
            } else {
                showNotification(`Failed to cancel order: ${res.error}`, 'error');
            }
        } catch (err: any) {
            showNotification(`Error: ${err.message}`, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && !ticker) {
        return <div className="p-12 text-center text-[var(--text-secondary)]">Loading Market Data...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* 1. Ticker Header */}
            {ticker && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm flex flex-wrap gap-8 items-center justify-between">
                    <div>
                        <h2 className="text-xs uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">HIVE / HBD Price</h2>
                        <div className="text-2xl font-bold text-[var(--text-primary)]">
                            {parseFloat(ticker.latest).toFixed(6)} HBD
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xs uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">24h Change</h2>
                        <div className={`text-xl font-bold ${parseFloat(ticker.percent_change) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {parseFloat(ticker.percent_change).toFixed(2)}%
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xs uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">24h Volume (HIVE)</h2>
                        <div className="text-xl font-bold text-[var(--text-primary)]">
                            {parseFloat(ticker.hive_volume.split(' ')[0]).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xs uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1">24h Volume (HBD)</h2>
                        <div className="text-xl font-bold text-[var(--text-primary)]">
                            {parseFloat(ticker.hbd_volume.split(' ')[0]).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </div>
                    </div>
                </div>
            )}

            {/* P2P vs Internal Market Tabs */}
            <div className="flex justify-between items-end border-b border-[var(--border-color)] mb-6 relative">
                <div className="flex space-x-6">
                    <button 
                        onClick={() => navigate('/market')}
                        className={`pb-4 text-base font-bold transition-all relative ${!isP2P ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Internal Market
                        {!isP2P && (
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--primary-color)] rounded-t-full shadow-[0_0_10px_var(--primary-color)]"></div>
                        )}
                    </button>
                    <button 
                        onClick={() => navigate('/market/p2p')}
                        className={`pb-4 text-base font-bold transition-all relative ${isP2P ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        P2P Trading
                        <span className="ml-2 px-2 py-0.5 text-[10px] bg-red-500 text-white rounded-full animate-pulse">HOT</span>
                        {isP2P && (
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--primary-color)] rounded-t-full shadow-[0_0_10px_var(--primary-color)]"></div>
                        )}
                    </button>
                </div>

                {isP2P && (
                    <button 
                        onClick={() => navigate('/market/p2p/dashboard')}
                        className="mb-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                    >
                        P2P Dashboard
                    </button>
                )}
            </div>

            {!isP2P ? (
                <>
                    {/* 2. Trading Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <TradeForm
                    type="buy"
                    ticker={ticker}
                    balance={wallet?.hbd_balance || "0.000 HBD"}
                    username={username || ''}
                    onSuccess={fetchData}
                    onPriceClick={(p) => setTicker(prev => prev ? { ...prev, lowest_ask: p } : null)} // Dummy update to trigger price change
                />
                <TradeForm
                    type="sell"
                    ticker={ticker}
                    balance={wallet?.balance || "0.000 HIVE"}
                    username={username || ''}
                    onSuccess={fetchData}
                />
            </div>

            {/* 3. Order Book & History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Order Book */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Order Book</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <OrderTable title="Buy Orders (Bids)" orders={orderBook?.bids || []} type="bid" />
                            <OrderTable title="Sell Orders (Asks)" orders={orderBook?.asks || []} type="ask" />
                        </div>
                    </div>

                    {/* Open Orders */}
                    {username && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Your Open Orders</h3>
                            <OpenOrdersTable orders={openOrders} onCancel={handleCancelOrder} loading={submitting} />
                        </div>
                    )}
                </div>

                {/* Recent Trades */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Recent Trades</h3>
                    <TradesTable trades={trades} />
                </div>
            </div>
                </>
            ) : (
                <P2PMarketLayout />
            )}
        </div>
    );
}

function TradeForm({ type, ticker, balance, username, onSuccess }: { type: 'buy' | 'sell', ticker: MarketTicker | null, balance: string, username: string, onSuccess: () => void, onPriceClick?: (p: string) => void }) {
    const isBuy = type === 'buy';
    const { showNotification } = useNotification();
    const [price, setPrice] = useState('');
    const [amount, setAmount] = useState('');
    const [total, setTotal] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (ticker && !price) {
            const rawPrice = isBuy ? ticker.lowest_ask.split(' ')[0] : ticker.highest_bid.split(' ')[0];
            setPrice(parseFloat(rawPrice).toFixed(6));
        }
    }, [ticker, isBuy]);

    const handlePriceChange = (val: string) => {
        setPrice(val);
        if (amount && !isNaN(parseFloat(val)) && !isNaN(parseFloat(amount))) {
            setTotal((parseFloat(val) * parseFloat(amount)).toFixed(3));
        }
    };

    const handleAmountChange = (val: string) => {
        setAmount(val);
        if (price && !isNaN(parseFloat(val)) && !isNaN(parseFloat(price))) {
            setTotal((parseFloat(val) * parseFloat(price)).toFixed(3));
        }
    };

    const handleTotalChange = (val: string) => {
        setTotal(val);
        if (price && !isNaN(parseFloat(val)) && !isNaN(parseFloat(price)) && parseFloat(price) !== 0) {
            setAmount((parseFloat(val) / parseFloat(price)).toFixed(3));
        }
    };

    const handleTrade = async () => {
        if (!username) {
            showNotification("Please login to trade", 'warning');
            return;
        }

        const p = parseFloat(price);
        const a = parseFloat(amount);
        const t = parseFloat(total);

        if (isNaN(p) || isNaN(a) || isNaN(t) || p <= 0 || a <= 0) {
            showNotification("Please enter valid price and amount", 'warning');
            return;
        }

        setLoading(true);
        try {
            const amount_to_sell = isBuy ? `${t.toFixed(3)} HBD` : `${a.toFixed(3)} HIVE`;
            const min_to_receive = isBuy ? `${a.toFixed(3)} HIVE` : `${t.toFixed(3)} HBD`;

            const res = await transactionService.broadcast({
                type: 'limit_order_create',
                username,
                amount_to_sell,
                min_to_receive,
                fill_or_kill: false,
                expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString().split('.')[0],
                orderid: Math.floor(Date.now() / 1000)
            });

            if (res.success) {
                showNotification(`${isBuy ? 'Buy' : 'Sell'} order placed successfully!`, 'success');
                onSuccess();
                setAmount('');
                setTotal('');
            } else {
                showNotification(`Failed to place order: ${res.error}`, 'error');
            }
        } catch (err: any) {
            showNotification(`Error: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
            <h3 className={`text-xl font-bold mb-6 ${isBuy ? 'text-green-500' : 'text-red-500 uppercase'}`}>
                {isBuy ? 'Buy HIVE' : 'Sell HIVE'}
            </h3>

            <div className="space-y-6">
                <div className="relative">
                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Price (HBD/HIVE)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => handlePriceChange(e.target.value)}
                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-lg"
                            placeholder="0.000"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-bold text-sm">HBD</div>
                    </div>
                </div>

                <div className="relative">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase">Amount (HIVE)</label>
                        <span className="text-[10px] font-bold text-[var(--primary-color)]">Balance: {balance}</span>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-lg"
                            placeholder="0.000"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-bold text-sm">HIVE</div>
                    </div>
                </div>

                <div className="relative">
                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Total (HBD)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={total}
                            onChange={(e) => handleTotalChange(e.target.value)}
                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-lg font-bold"
                            placeholder="0.000"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-bold text-sm">HBD</div>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleTrade}
                        disabled={loading || !username}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50
                        ${isBuy ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {loading ? 'Processing...' : (isBuy ? 'Buy HIVE' : 'Sell HIVE')}
                    </button>
                    {!username && <p className="text-[10px] text-center mt-2 text-red-500">Please login to enable trading</p>}
                </div>
            </div>
        </div>
    );
}

function OrderTable({ title, orders, type }: { title: string, orders: any[], type: 'bid' | 'ask' }) {
    return (
        <div>
            <h4 className={`text-sm font-bold mb-4 uppercase tracking-wider ${type === 'bid' ? 'text-green-600' : 'text-red-600'}`}>{title}</h4>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                            <th className="text-left py-2">Price</th>
                            <th className="text-right py-2">HIVE</th>
                            <th className="text-right py-2">HBD</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]/30">
                        {orders.map((order, i) => (
                            <tr key={i} className="hover:bg-[var(--bg-canvas)] transition-colors">
                                <td className={`py-2 font-medium ${type === 'bid' ? 'text-green-500' : 'text-red-500'}`}>{parseFloat(order.real_price).toFixed(6)}</td>
                                <td className="py-2 text-right text-[var(--text-primary)]">{order.order_price.quote}</td>
                                <td className="py-2 text-right text-[var(--text-primary)]">{order.order_price.base}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TradesTable({ trades }: { trades: MarketTrade[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                        <th className="text-left py-2">Date</th>
                        <th className="text-right py-2">Price</th>
                        <th className="text-right py-2">HIVE</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]/30">
                    {trades.map((trade, i) => {
                        const hive = trade.current_pays.includes('HIVE') ? trade.current_pays : trade.open_pays;
                        const hbd = trade.current_pays.includes('HBD') ? trade.current_pays : trade.open_pays;
                        const price = parseFloat(hbd) / parseFloat(hive);
                        return (
                            <tr key={i} className="hover:bg-[var(--bg-canvas)] transition-colors">
                                <td className="py-2 text-[var(--text-secondary)]">{new Date(trade.date + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="py-2 text-right font-medium text-[var(--text-primary)]">{price.toFixed(6)}</td>
                                <td className="py-2 text-right text-[var(--text-primary)]">{hive.split(' ')[0]}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function OpenOrdersTable({ orders, onCancel, loading }: { orders: OpenOrder[], onCancel: (id: number) => void, loading: boolean }) {
    if (orders.length === 0) return <div className="text-sm text-[var(--text-secondary)] italic">No open orders</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                        <th className="text-left py-3">Created</th>
                        <th className="text-left py-3">Price</th>
                        <th className="text-right py-3">HIVE</th>
                        <th className="text-right py-3">HBD</th>
                        <th className="text-center py-3">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]/30">
                    {orders.map((order) => {
                        const hiveAmount = order.sell_price?.base.includes('HIVE') ? order.sell_price.base : order.sell_price?.quote;
                        const hbdAmount = order.sell_price?.base.includes('HBD') ? order.sell_price.base : order.sell_price?.quote;
                        return (
                            <tr key={order.id} className="hover:bg-[var(--bg-canvas)] transition-colors">
                                <td className="py-3 text-[var(--text-secondary)]">{new Date(order.created + 'Z').toLocaleDateString()}</td>
                                <td className="py-3 font-medium text-[var(--text-primary)]">{parseFloat(order.real_price).toFixed(6)}</td>
                                <td className="py-3 text-right">{hiveAmount || 'N/A'}</td>
                                <td className="py-3 text-right">{hbdAmount || 'N/A'}</td>
                                <td className="py-3 text-center">
                                    <button
                                        onClick={() => onCancel(order.orderid)}
                                        disabled={loading}
                                        className="text-red-500 font-bold hover:underline text-xs uppercase tracking-tighter disabled:opacity-50"
                                    >
                                        {loading ? '...' : 'Cancel'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function P2PMarketLayout() {
    const PAYMENT_METHODS_BY_FIAT: Record<FiatCurrency, string[]> = {
        USD: ['PayPal', 'CashApp', 'Zelle', 'Wire Transfer', 'Skrill'],
        NGN: ['Bank Transfer', 'Opay', 'Kuda', 'PalmPay', 'Chipper Cash'],
        EUR: ['SEPA', 'Revolut', 'Wise', 'N26', 'Paysera'],
        GBP: ['Faster Payments', 'Revolut', 'Monzo', 'Starling Bank'],
        MXN: ['SPEI', 'OXXO', 'Mercado Pago', 'STP'],
        GHS: ['MTN Mobile Money', 'Vodafone Cash', 'AirtelTigo Money'],
    };
    const [action, setAction] = useState<TradeType>('BUY');
    const [cryptoItem, setCryptoItem] = useState<CryptoCurrency>('HIVE');
    const [fiat, setFiat] = useState<FiatCurrency>(
        (localStorage.getItem('p2p_preferred_fiat') as FiatCurrency) || 'USD'
    );
    const [paymentMethod, setPaymentMethod] = useState<string>('All Payments');
    const [ads, setAds] = useState<P2PAd[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAd, setSelectedAd] = useState<P2PAd | null>(null);

    useEffect(() => {
        loadAds();
    }, [action, cryptoItem, fiat, paymentMethod]);

    const loadAds = async () => {
        setLoading(true);
        try {
            const data = await P2PService.getAds(action, cryptoItem, fiat);
            if (paymentMethod !== 'All Payments') {
                setAds(data.filter(ad => ad.paymentMethods.includes(paymentMethod as any)));
            } else {
                setAds(data);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex bg-[var(--bg-canvas)] rounded-xl p-1 overflow-hidden w-full md:w-auto">
                    <button 
                        onClick={() => setAction('BUY')}
                        className={`flex-1 min-w-[100px] py-2 px-4 rounded-lg font-bold text-sm transition-all pb-2 ${action === 'BUY' ? 'bg-green-500 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Buy
                    </button>
                    <button 
                        onClick={() => setAction('SELL')}
                        className={`flex-1 min-w-[100px] py-2 px-4 rounded-lg font-bold text-sm transition-all pb-2 ${action === 'SELL' ? 'bg-red-500 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Sell
                    </button>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <CustomSelect 
                        value={cryptoItem}
                        onChange={(val) => setCryptoItem(val as CryptoCurrency)}
                        options={[
                            { label: 'HIVE', value: 'HIVE' },
                            { label: 'HBD', value: 'HBD' }
                        ]}
                    />
                    
                    <span className="text-[var(--text-secondary)] font-bold hidden md:block">with</span>

                    <CustomSelect 
                        value={fiat}
                        onChange={(val) => {
                            setFiat(val as FiatCurrency);
                            localStorage.setItem('p2p_preferred_fiat', val);
                            setPaymentMethod('All Payments');
                        }}
                        options={[
                            { label: 'USD', value: 'USD' },
                            { label: 'NGN', value: 'NGN' },
                            { label: 'MXN', value: 'MXN' },
                            { label: 'GHS', value: 'GHS' },
                            { label: 'EUR', value: 'EUR' },
                            { label: 'GBP', value: 'GBP' }
                        ]}
                    />

                    <div className="w-[1px] h-8 bg-[var(--border-color)] mx-2 hidden md:block"></div>

                    <CustomSelect 
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        options={[
                            { label: 'All Payments', value: 'All Payments' },
                            ...(PAYMENT_METHODS_BY_FIAT[fiat] || []).map(method => ({ label: method, value: method }))
                        ]}
                    />
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center p-20 text-[var(--text-secondary)] font-bold animate-pulse">
                        Scanning Escrow Networks...
                    </div>
                ) : ads.length === 0 ? (
                    <div className="text-center p-20">
                        <span className="text-6xl block mb-6 opacity-50">📂</span>
                        <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No Ads Found</h3>
                        <p className="text-[var(--text-secondary)] max-w-sm mx-auto">There are currently no active makers matching your requested parameters. Try checking another fiat pairing.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[var(--text-secondary)] bg-[var(--bg-canvas)] border-b border-[var(--border-color)]">
                                    <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Advertisers (Completion rate)</th>
                                    <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-xs">Price</th>
                                    <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-xs">Limit/Available</th>
                                    <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-xs">Payment Method</th>
                                    <th className="text-right py-4 px-6 font-bold uppercase tracking-wider text-xs">Trade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]/50">
                                {ads.map((ad, i) => (
                                    <P2PAdRow key={`ad-${i}`} ad={ad} userAction={action} onSelect={() => setSelectedAd(ad)} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedAd && (
                <P2POrderModal 
                    isOpen={true}
                    onClose={() => setSelectedAd(null)}
                    ad={selectedAd}
                    userAction={action}
                />
            )}
        </div>
    );
}

function P2PAdRow({ ad, userAction, onSelect }: { ad: P2PAd, userAction: TradeType, onSelect: () => void }) {
    const isBuy = userAction === 'BUY';
    const activeUsername = localStorage.getItem('hive_user');
    const isMyAd = ad.maker.username === activeUsername;

    return (
        <tr className="hover:bg-[var(--bg-canvas)] transition-all">
            <td className="py-6 px-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-tr from-[var(--primary-color)] to-purple-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md uppercase">
                        {ad.maker.username[0]}
                    </div>
                    <div>
                        <div className="font-black text-[var(--text-primary)] text-base mb-1">{ad.maker.username}</div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-bold tracking-wider">
                            <span>{ad.maker.totalTrades} orders</span>
                            <span className="w-1 h-1 rounded-full bg-[var(--text-secondary)]"></span>
                            <span>{ad.maker.completionRate}% completion</span>
                        </div>
                    </div>
                </div>
            </td>
            
            <td className="py-6 px-6">
                <div className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                    {ad.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-bold text-[var(--text-secondary)]">{ad.fiat}</span>
                </div>
            </td>
            
            <td className="py-6 px-6 space-y-1 min-w-[200px]">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-bold">Available</span>
                    <div className="text-right flex flex-col items-end">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{ad.availableCrypto.toLocaleString(undefined, { maximumFractionDigits: 3 })} {ad.crypto}</span>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">≈ {(ad.availableCrypto * ad.price).toLocaleString(undefined, { maximumFractionDigits: 2 })} {ad.fiat}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-4 mt-2">
                    <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-bold">Limit</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{ad.minOrderFiat.toLocaleString(undefined, { maximumFractionDigits: 2 })} - {ad.maxOrderFiat.toLocaleString(undefined, { maximumFractionDigits: 2 })} {ad.fiat}</span>
                </div>
            </td>

            <td className="py-6 px-6">
                <div className="flex flex-wrap gap-2">
                    {ad.paymentMethods.map((pm, i) => (
                        <span key={i} className="px-3 py-1 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/30 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {pm}
                        </span>
                    ))}
                </div>
            </td>

            <td className="py-6 px-6 text-right">
                {isMyAd ? (
                    <button 
                        disabled
                        className="px-8 py-3 rounded-xl font-black text-sm text-[var(--text-secondary)] bg-[var(--bg-canvas)] border border-[var(--border-color)] tracking-wider uppercase opacity-70 cursor-not-allowed"
                    >
                        Your Ad
                    </button>
                ) : (
                    <button 
                        onClick={onSelect}
                        className={`px-8 py-3 rounded-xl font-black text-sm text-white shadow-lg tracking-wider uppercase transition-all hover:scale-105 active:scale-95 ${isBuy ? 'bg-green-500 hover:bg-green-400' : 'bg-red-500 hover:bg-red-400'}`}
                    >
                        {isBuy ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`}
                    </button>
                )}
            </td>
        </tr>
    );
}

function CustomSelect({ options, value, onChange }: { options: {label: string, value: string}[], value: string, onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    return (
        <div ref={ref} className="relative inline-block w-full md:w-auto z-40">
            <button 
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between min-w-[140px] bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-sm font-bold text-[var(--text-primary)] cursor-pointer w-full hover:border-[var(--primary-color)]/50 box-border"
            >
                {options.find(o => o.value === value)?.label || value}
                <ChevronDown className={`w-4 h-4 ml-3 text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180 text-[var(--primary-color)]' : ''}`} />
            </button>
            
            {open && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[140px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors hover:bg-[var(--bg-canvas)] ${value === opt.value ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'text-[var(--text-primary)]'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
