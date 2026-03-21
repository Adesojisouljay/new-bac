import { useEffect, useState } from 'react';
import { UnifiedDataService, MarketTicker, OrderBook, MarketTrade, OpenOrder } from '../../../services/unified';
import { transactionService } from '../services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';

export default function MarketPage() {
    const [ticker, setTicker] = useState<MarketTicker | null>(null);
    const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
    const [trades, setTrades] = useState<MarketTrade[]>([]);
    const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
    const [wallet, setWallet] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { showNotification, showConfirm } = useNotification();
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
