import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ArrowUpDown, Settings, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';

const SUPPORTED_COINS = [
    { symbol: 'HIVE', name: 'Hive', icon: 'https://assets.coingecko.com/coins/images/10840/standard/logo_transparent_4x.png' },
    { symbol: 'HBD', name: 'Hive Dollar', icon: 'https://assets.coingecko.com/coins/images/11494/standard/HBD.png' },
    { symbol: 'USDT', name: 'Tether', icon: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' },
    { symbol: 'BTC', name: 'Bitcoin', icon: 'https://assets.coingecko.com/coins/images/1/standard/bitcoin.png' },
    { symbol: 'ETH', name: 'Ethereum', icon: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png' },
    { symbol: 'SOL', name: 'Solana', icon: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png' },
    { symbol: 'BNB', name: 'Binance Coin', icon: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png' },
    { symbol: 'TRX', name: 'Tron', icon: 'https://assets.coingecko.com/coins/images/1094/standard/tron-logo.png' }
];

export default function SwapInterface() {
    const { showNotification } = useNotification();
    const [payCoin, setPayCoin] = useState(SUPPORTED_COINS[0]);
    const [receiveCoin, setReceiveCoin] = useState(SUPPORTED_COINS[2]);
    const [payAmount, setPayAmount] = useState('');
    const [receiveAmount, setReceiveAmount] = useState('');
    const [isQuoting, setIsQuoting] = useState(false);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [destinationAddress, setDestinationAddress] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isInitiating, setIsInitiating] = useState(false);
    const [activeOrder, setActiveOrder] = useState<any>(null);

    const handleInvert = () => {
        setPayCoin(receiveCoin);
        setReceiveCoin(payCoin);
        setPayAmount(receiveAmount);
        setReceiveAmount('');
        setActiveOrder(null);
        // Destination address resets inherently inside the useEffect below based on `receiveCoin` changes
    };

    // Auto-fill Destination Address for HIVE/HBD or Web3 Payouts
    useEffect(() => {
        const username = localStorage.getItem('hive_user')?.replace(/^@/, '');
        if ((receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD') && username) {
            setDestinationAddress(username);
        } else if (username) {
            // Intelligent Web3 extraction matching existing Sovraniche Wallet connections
            const publicAddresses = localStorage.getItem(`web3_public_addresses_${username.toLowerCase()}`);
            if (publicAddresses) {
                try {
                    const parsed = JSON.parse(publicAddresses);
                    // Override stablecoin defaults to TRC20 for maximum fee efficiency
                    let mappedChain = receiveCoin.symbol;
                    if (receiveCoin.symbol === 'USDT') mappedChain = 'TRON';
                    
                    if (parsed[mappedChain]?.address) {
                        setDestinationAddress(parsed[mappedChain].address);
                    } else {
                        setDestinationAddress('');
                    }
                } catch (e) {
                    setDestinationAddress('');
                }
            } else {
                setDestinationAddress('');
            }
        } else {
            setDestinationAddress('');
        }
    }, [receiveCoin.symbol]);

    // Mock Backend Quote Fetcher (Debounced)
    useEffect(() => {
        if (!payAmount || isNaN(parseFloat(payAmount)) || parseFloat(payAmount) <= 0) {
            setReceiveAmount('');
            return;
        }

        const fetchQuote = async () => {
            setIsQuoting(true);
            try {
                const response = await fetch(`http://127.0.0.1:4001/api/swap/quote?pay=${payCoin.symbol}&receive=${receiveCoin.symbol}&amount=${payAmount}`);
                const data = await response.json();

                if (response.ok) {
                    // Update state with live Oracle values
                    setExchangeRate(parseFloat(data.exchangeRate));
                    setReceiveAmount(data.receiveAmount);
                } else {
                    throw new Error(data.error || "Quote request rejected by backend");
                }

            } catch (error) {
                console.error("Quote fetch error:", error);
                showNotification("Failed to fetch live exchange rate.", "error");
            } finally {
                setIsQuoting(false);
            }
        };

        const timer = setTimeout(() => {
            fetchQuote();
        }, 500);

        return () => clearTimeout(timer);
    }, [payAmount, payCoin.symbol, receiveCoin.symbol]);

    const handleReviewSwap = async () => {
        setIsInitiating(true);
        try {
            const token = localStorage.getItem('breakaway_token');
            const username = localStorage.getItem('hive_user')?.replace(/^@/, '');

            if (!username) {
                showNotification("Please log in to initiate a swap. (Keychain / LocalStorage auth strictly required)", "error");
                setIsInitiating(false);
                return;
            }

            const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
            const response = await fetch(`${API_URL}/api/swap/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username,
                    payCoin: payCoin.symbol,
                    receiveCoin: receiveCoin.symbol,
                    amount: payAmount,
                    // Pass the exact string from the user's manual input field (handles external overrides)
                    destinationAddress: destinationAddress
                })
            });

            const data = await response.json();

            if (response.ok) {
                setActiveOrder(data);
                setShowModal(true);
            } else {
                throw new Error(data.error || "Failed to initialize cryptographic swap channel");
            }
        } catch (error: any) {
            console.error("Init Swap Error:", error);
            showNotification(error.message, "error");
        } finally {
            setIsInitiating(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto mt-[4vh] px-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[28px] shadow-xl p-2 relative">
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 mb-2">
                    <h2 className="text-xl font-black text-[var(--text-primary)]">Swap</h2>
                    <button className="p-2 hover:bg-[var(--bg-canvas)] rounded-xl transition-colors text-[var(--text-secondary)]">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Pay Section */}
                <div className="bg-[var(--bg-canvas)] rounded-[20px] p-4 border border-transparent focus-within:border-[var(--border-color)] transition-colors relative z-30">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-[var(--text-secondary)]">You Pay</span>
                        <span className="text-xs font-bold text-[var(--text-secondary)]">Balance: 0.00 {payCoin.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <input
                            type="number"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="0"
                            className="bg-transparent text-4xl font-black text-[var(--text-primary)] focus:outline-none w-[60%] overflow-hidden text-ellipsis"
                        />
                        <CoinSelector selected={payCoin} onSelect={setPayCoin} exclude={receiveCoin.symbol} />
                    </div>
                </div>

                {/* Swap Divider Button */}
                <div className="relative h-2 flex justify-center items-center z-40">
                    <button 
                        onClick={handleInvert}
                        className="absolute bg-[var(--bg-card)] border-4 border-[var(--bg-card)] hover:border-[var(--bg-canvas)] p-2 rounded-xl text-[var(--text-primary)] shadow-md transition-all active:scale-95 z-30 group"
                    >
                        <ArrowUpDown className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
                    </button>
                </div>

                {/* Receive Section */}
                <div className="bg-[var(--bg-canvas)] rounded-[20px] p-4 border border-transparent focus-within:border-[var(--border-color)] transition-colors relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-[var(--text-secondary)]">You Receive</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        {isQuoting ? (
                            <div className="h-10 flex items-center">
                                <div className="animate-pulse bg-[var(--border-color)] h-8 w-32 rounded-lg"></div>
                            </div>
                        ) : (
                            <input
                                type="text"
                                value={receiveAmount}
                                readOnly
                                placeholder="0"
                                className="bg-transparent text-4xl font-black text-[var(--text-primary)] focus:outline-none w-[60%] overflow-hidden text-ellipsis cursor-default opacity-80"
                            />
                        )}
                        <CoinSelector selected={receiveCoin} onSelect={setReceiveCoin} exclude={payCoin.symbol} />
                    </div>
                </div>

                {/* Details Footer */}
                {receiveAmount && exchangeRate && !isQuoting && (
                    <div className="px-4 py-4 mt-2">
                        <div className="flex items-center justify-between text-sm font-bold">
                            <span className="text-[var(--text-secondary)]">Rate</span>
                            <span className="text-[var(--text-primary)]">1 {payCoin.symbol} = {exchangeRate} {receiveCoin.symbol}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-bold mt-2">
                            <span className="text-[var(--text-secondary)]">Network Fee</span>
                            <span className="text-purple-500">Free</span>
                        </div>
                    </div>
                )}

                {/* Destination Address Input (Always Visible to allow alternative payouts) */}
                <div className="mt-4 px-2">
                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 ml-2">
                        Destination {receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD' ? 'Hive Username' : `${receiveCoin.symbol} Address`}
                    </label>
                    <input
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value.trim())}
                        placeholder={receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD' ? `Enter destination username` : `Enter destination wallet address`}
                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-sm font-bold text-[var(--text-primary)]"
                    />
                </div>

                {/* Action Button */}
                <div className="mt-4 text-center pb-2">
                    {!payAmount || parseFloat(payAmount) <= 0 ? (
                        <button disabled className="w-[96%] mx-auto bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-black text-xl py-4 rounded-2xl cursor-not-allowed border border-[var(--border-color)]">
                            Enter an amount
                        </button>
                    ) : (!destinationAddress) ? (
                        <button disabled className="w-[96%] mx-auto bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-black text-xl py-4 rounded-2xl cursor-not-allowed border border-[var(--border-color)]">
                            Enter Destination {receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD' ? 'Username' : 'Address'}
                        </button>
                    ) : (
                        <button 
                            disabled={isInitiating}
                            onClick={handleReviewSwap}
                            className={`w-[96%] mx-auto ${isInitiating ? 'bg-purple-600/50 cursor-wait' : 'bg-purple-600 hover:bg-purple-500'} text-white font-black text-xl py-4 rounded-2xl shadow-lg transition-all active:scale-95 animate-in fade-in zoom-in duration-300 flex items-center justify-center gap-2`}
                        >
                            {isInitiating && <RefreshCw className="w-5 h-5 animate-spin" />}
                            {isInitiating ? "Generating Deposit Route..." : "Review Swap"}
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-6 flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl mb-12">
                <AlertCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-purple-600/80 leading-relaxed">
                    Sovraniche Instant Swap utilizes cross-chain atomic routing. You will receive a unique Web3 deposit address in the next step to execute this trade entirely non-custodially.
                </p>
            </div>

            {/* CONFIRMATION / DEPOSIT MODAL */}
            {showModal && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in cursor-pointer"
                    onClick={() => setShowModal(false)}
                >
                    <div 
                        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 cursor-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-[var(--border-color)] flex items-center gap-4 bg-[var(--bg-canvas)]/50">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[var(--bg-card)] hover:bg-[var(--border-color)] border border-[var(--border-color)] transition-colors text-[var(--text-primary)] shadow-sm"
                            >
                                <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                            </button>
                            <h3 className="text-xl font-black text-[var(--text-primary)]">Review Swap</h3>
                        </div>

                        {/* Order Summary */}
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between border border-[var(--border-color)] rounded-xl p-4 bg-[var(--bg-canvas)]">
                                <div className="text-center w-full">
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">You Send</p>
                                    <p className="text-2xl font-black text-red-500">{parseFloat(payAmount).toLocaleString()} <span className="text-sm">{payCoin.symbol}</span></p>
                                </div>
                                <div className="px-4 text-[var(--border-color)]">➜</div>
                                <div className="text-center w-full">
                                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">You Receive</p>
                                    <p className="text-2xl font-black text-green-500">{parseFloat(receiveAmount).toLocaleString()} <span className="text-sm">{receiveCoin.symbol}</span></p>
                                </div>
                            </div>

                            {/* Destination Warning */}
                            {receiveCoin.symbol !== 'HIVE' && receiveCoin.symbol !== 'HBD' && (
                                <div className="text-sm font-bold text-[var(--text-primary)] text-center bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                                    Payout goes to: <br/>
                                    <span className="text-purple-500 font-mono text-xs break-all mt-1 block">{destinationAddress}</span>
                                </div>
                            )}

                            {/* Deposit Instructions (Mocked for now) */}
                            <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-6 text-center shadow-inner">
                                <h4 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Deposit Instructions</h4>
                                
                                {payCoin.symbol === 'HIVE' || payCoin.symbol === 'HBD' ? (
                                    <>
                                        <p className="text-sm font-bold text-[var(--text-primary)] mb-2">Send precisely <strong className="text-red-500">{payAmount} {payCoin.symbol}</strong> to:</p>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 font-mono font-black text-lg text-[var(--primary-color)] mb-3 select-all">
                                            {activeOrder?.depositAddress || "@sovraniche.hot"}
                                        </div>
                                        <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">With Memo:</p>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 font-mono text-sm text-[var(--text-primary)] break-all select-all">
                                            {activeOrder?.depositMemo}
                                        </div>
                                        
                                        <button className="w-full mt-6 bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                                            <img src="https://hive.io/images/hive-logo.svg" className="w-5 h-5 filter brightness-0 invert" alt="Hive" />
                                            Pay via Keychain
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-[var(--text-primary)] mb-4">Send precisely <strong className="text-green-500">{payAmount} {payCoin.symbol}</strong> to:</p>
                                        
                                        {/* Dynamic QR Code Box Layout */}
                                        <div className="w-32 h-32 mx-auto bg-white rounded-xl mb-6 p-2 shadow-sm border-[4px] border-[var(--bg-card)] flex items-center justify-center border-dashed">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase text-center">Awaiting<br/>QR Logic</span>
                                        </div>

                                        <p className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">{payCoin.symbol} Deposit Network (TRC-20 / Native)</p>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 font-mono text-xs font-black text-[var(--primary-color)] break-all mb-4 select-all shadow-inner">
                                            {activeOrder?.depositAddress || "Awaiting Cryptographic Generation..."}
                                        </div>

                                        <div className="flex items-center gap-2 justify-center bg-blue-500/10 text-blue-500 text-xs font-bold p-3 rounded-xl border border-blue-500/20 mt-6">
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Waiting to detect blockchain deposit...
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// -------------------------------------------------------------
// Helper Component: Coin Selector Dropdown
// -------------------------------------------------------------

function CoinSelector({ selected, onSelect, exclude }: { selected: any, onSelect: (coin: any) => void, exclude: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-[var(--bg-card)] hover:bg-[var(--border-color)] border border-[var(--border-color)] pl-2 pr-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
                <img src={selected.icon} alt={selected.symbol} className="w-6 h-6 rounded-full bg-white object-contain" />
                <span className="font-bold text-[var(--text-primary)]">{selected.symbol}</span>
                <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-[var(--border-color)]">
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-2 py-1">Select Asset</p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1 flex flex-col gap-1">
                        {SUPPORTED_COINS.filter(c => c.symbol !== exclude).map((coin) => (
                            <button
                                key={coin.symbol}
                                onClick={() => {
                                    onSelect(coin);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center justify-between w-full p-3 rounded-xl transition-colors hover:bg-[var(--bg-canvas)] ${selected.symbol === coin.symbol ? 'bg-purple-500/10' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <img src={coin.icon} alt={coin.symbol} className="w-8 h-8 rounded-full bg-white object-contain border border-[var(--border-color)]" />
                                    <div className="text-left">
                                        <div className="font-bold text-[var(--text-primary)]">{coin.symbol}</div>
                                        <div className="text-xs font-bold text-[var(--text-secondary)]">{coin.name}</div>
                                    </div>
                                </div>
                                {selected.symbol === coin.symbol && (
                                    <div className="w-2 h-2 rounded-full bg-purple-500 mr-2 shadow-[0_0_8px_purple]"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
