import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ArrowUpDown, Settings, AlertCircle, RefreshCw, ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';
import { useNotification } from '../../../contexts/NotificationContext';

const SUPPORTED_COINS = [
    { symbol: 'HIVE', name: 'Hive', icon: 'https://assets.coingecko.com/coins/images/10840/standard/logo_transparent_4x.png' },
    { symbol: 'HBD', name: 'Hive Dollar', icon: 'https://assets.coingecko.com/coins/images/11494/standard/HBD.png' },
    { symbol: 'USDT_TRC20', name: 'USDT (TRC20)', icon: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' },
    { symbol: 'USDT_BEP20', name: 'USDT (BEP20)', icon: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' },
    { symbol: 'USDT_ERC20', name: 'USDT (ERC20)', icon: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' },
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
    const [grossAmount, setGrossAmount] = useState('');
    const [isQuoting, setIsQuoting] = useState(false);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [networkFee, setNetworkFee] = useState<string | null>(null);
    const [platformFee, setPlatformFee] = useState<string | null>(null);
    const [destinationAddress, setDestinationAddress] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isInitiating, setIsInitiating] = useState(false);
    const [activeOrder, setActiveOrder] = useState<any>(null);
    const [useCustomAddress, setUseCustomAddress] = useState(false);

    const [swapStatus, setSwapStatus] = useState<string>('PENDING');

    const [copiedAddress, setCopiedAddress] = useState(false);
    const [copiedMemo, setCopiedMemo] = useState(false);

    const handleCopy = (text: string | null | undefined, type: 'address' | 'memo') => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        if (type === 'address') {
            setCopiedAddress(true);
            setTimeout(() => setCopiedAddress(false), 2000);
        } else {
            setCopiedMemo(true);
            setTimeout(() => setCopiedMemo(false), 2000);
        }
    };

    const handleInvert = () => {
        setPayCoin(receiveCoin);
        setReceiveCoin(payCoin);
        setPayAmount(receiveAmount);
        setReceiveAmount('');
        setActiveOrder(null);
        // Destination address resets inherently inside the useEffect below based on `receiveCoin` changes
    };

    // Auto-fill Destination Address for HIVE/HBD or Web3 Payouts
    const fillSovranicheAddress = () => {
        const username = localStorage.getItem('hive_user')?.replace(/^@/, '');
        if ((receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD') && username) {
            setDestinationAddress(username);
        } else if (username) {
            // Intelligent Web3 extraction matching existing Sovraniche Wallet connections
            const publicAddresses = localStorage.getItem(`web3_public_addresses_${username.toLowerCase()}`);
            if (publicAddresses) {
                try {
                    const parsed = JSON.parse(publicAddresses);
                    // Override stablecoin and TRX defaults to the correct chain namespace
                    let mappedChain = receiveCoin.symbol;
                    if (receiveCoin.symbol === 'USDT_TRC20' || receiveCoin.symbol === 'TRX') mappedChain = 'TRON';
                    if (receiveCoin.symbol === 'USDT_BEP20' || receiveCoin.symbol === 'BNB') mappedChain = 'BNB';
                    if (receiveCoin.symbol === 'USDT_ERC20' || receiveCoin.symbol === 'ETH') mappedChain = 'ETH';
                    
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
    };

    useEffect(() => {
        if (!useCustomAddress) {
            fillSovranicheAddress();
        }
    }, [receiveCoin.symbol, useCustomAddress]);

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
                    setGrossAmount(data.grossReceiveAmount);
                    setReceiveAmount(data.receiveAmount);
                    setNetworkFee(data.networkFee);
                    setPlatformFee(data.platformFeeAmount);
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
                setSwapStatus(data.status || 'PENDING');
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

    // -------------------------------------------------------------
    // Realtime API Payout Fetcher
    // -------------------------------------------------------------
    
    const getExplorerUrl = (chain: string, hash: string) => {
        if (chain === 'HIVE' || chain === 'HBD') return `https://hiveblocks.com/tx/${hash}`;
        if (chain === 'BTC') return `https://mempool.space/tx/${hash}`;
        if (chain === 'TRON' || chain === 'USDT' || chain === 'TRX') return `https://tronscan.org/#/transaction/${hash}`;
        if (chain === 'SOL') return `https://solscan.io/tx/${hash}`;
        if (chain === 'BNB') return `https://bscscan.com/tx/${hash}`;
        if (chain === 'APTOS') return `https://explorer.aptoslabs.com/txn/${hash}`;
        return `https://etherscan.io/tx/${hash}`;
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (showModal && activeOrder?.orderId && swapStatus !== 'COMPLETED' && swapStatus !== 'FAILED_PAYOUT') {
            const fetchOrderStatus = async () => {
                try {
                    const token = localStorage.getItem('breakaway_token');
                    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
                    const response = await fetch(`${API_URL}/api/swap/order/${activeOrder.orderId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        setSwapStatus(data.status);
                        // Inject fresh payload arrays (e.g., txHash data) safely
                        if (data.status === 'COMPLETED' || data.status === 'FAILED_PAYOUT' || data.status === 'PROCESSING') {
                            setActiveOrder(data);
                        }
                    }
                } catch (e) {
                     // Silently digest polling errors mathematically
                }
            };

            interval = setInterval(fetchOrderStatus, 3000); // 3 Sec heartbeat
        }

        return () => clearInterval(interval);
    }, [showModal, activeOrder?.orderId, swapStatus]);

    const handlePayViaKeychain = () => {
        const username = localStorage.getItem('hive_user')?.replace(/^@/, '');
        if (!username) {
            showNotification("Please log in to your wallet first.", "error");
            return;
        }

        // @ts-ignore
        if (window.hive_keychain) {
            const toAccount = activeOrder?.depositAddress?.replace(/^@/, '') || "sovra.swap";
            const memo = activeOrder?.depositMemo;
            
            // Hive mathematically mandates 3 decimals for operations
            const parsedAmount = parseFloat(payAmount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                 showNotification("Invalid cryptographic amount detected.", "error");
                 return;
            }
            const processedAmountStr = parsedAmount.toFixed(3);
            
            showNotification(`Opening Keychain to transfer ${processedAmountStr} ${payCoin.symbol}...`, "info");
            
            // @ts-ignore
            window.hive_keychain.requestTransfer(
                username,
                toAccount,
                processedAmountStr,
                memo,
                payCoin.symbol,
                (response: any) => {
                    if (response.success) {
                        showNotification("Transfer initiated successfully! Scanning blockchain for internal confirmation...", "success");
                    } else {
                        showNotification(response.message || "Cryptographic transfer execution cancelled.", "error");
                        console.error('Keychain Error:', response);
                    }
                },
                true
            );
        } else {
            showNotification("Hive Keychain extension structurally missing or locked", "error");
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
                                value={isQuoting ? '...' : grossAmount}
                                readOnly
                                placeholder="0.00"
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
                             <span className="text-[var(--text-secondary)]">Exchange Fee (3%)</span>
                             <span className="text-[var(--text-primary)]">{platformFee} {receiveCoin.symbol}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-bold mt-2">
                             <span className="text-[var(--text-secondary)]">Network Fee</span>
                             <span className="text-purple-500">{parseFloat(networkFee || '0') > 0 ? `${networkFee} ${receiveCoin.symbol}` : 'Free (Sponsored)'}</span>
                        </div>
                        <div className="flex items-center justify-between text-lg font-bold mt-4 border-t border-[var(--border-color)] pt-4">
                             <span className="text-[var(--text-primary)]">Estimated Payout</span>
                             <span className="text-green-500">{receiveAmount} {receiveCoin.symbol}</span>
                        </div>
                    </div>
                )}

                {/* Destination Address Input (Visible Toggle to allow alternative payouts) */}
                <div className="mt-4 px-2">
                    <div className="flex items-center justify-between mb-2 ml-2">
                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            Destination {receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD' ? 'Hive Username' : `${receiveCoin.symbol} Address`}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <span className={`text-xs font-bold transition-colors ${useCustomAddress ? 'text-purple-500' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                Use External Address
                            </span>
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    className="sr-only"
                                    checked={useCustomAddress}
                                    onChange={() => {
                                        setUseCustomAddress(!useCustomAddress);
                                        if (!useCustomAddress) { // Switching to custom
                                            setDestinationAddress('');
                                        }
                                    }}
                                />
                                <div className={`block w-8 h-4 rounded-full transition-colors ${useCustomAddress ? 'bg-purple-500' : 'bg-[var(--border-color)]'}`}></div>
                                <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform shadow-sm ${useCustomAddress ? 'transform translate-x-4' : ''}`}></div>
                            </div>
                        </label>
                    </div>
                    <input
                        type="text"
                        value={destinationAddress}
                        readOnly={!useCustomAddress}
                        onChange={(e) => setDestinationAddress(e.target.value.trim())}
                        placeholder={receiveCoin.symbol === 'HIVE' || receiveCoin.symbol === 'HBD' ? `Enter destination username` : `Enter destination wallet address`}
                        className={`w-full border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-sm font-bold bg-[var(--bg-canvas)] ${!useCustomAddress ? 'text-[var(--text-secondary)] cursor-not-allowed' : 'text-[var(--text-primary)]'}`}
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

                        {/* Order Summary rendering computationally bound to Active execution stage */}
                        <div className="p-6 space-y-6">

                            {swapStatus === 'COMPLETED' ? (
                                <div className="text-center py-6 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                                     <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)] relative">
                                         <Check className="w-12 h-12 text-white" />
                                         <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-20"></div>
                                     </div>
                                     <h3 className="text-3xl font-black text-[var(--text-primary)] mb-2">Swap Complete!</h3>
                                     <p className="text-sm font-bold text-[var(--text-secondary)] mb-6 px-4 leading-relaxed">Your external cryptographic execution has been definitively forged into the destination blockchain.</p>
                                     
                                     <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] p-5 rounded-2xl w-full text-left shadow-inner">
                                         <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1">Delivered Asset</p>
                                         <p className="text-2xl font-black text-green-500 mb-4">{activeOrder?.amountToPayout ? parseFloat(activeOrder.amountToPayout).toLocaleString() : parseFloat(receiveAmount).toLocaleString()} {receiveCoin.symbol}</p>
                                         
                                         <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1">Blockchain Hash</p>
                                         <div className="flex items-stretch gap-2">
                                             <p className="font-mono text-xs font-bold text-[var(--primary-color)] break-all bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)] flex-1">
                                                 {activeOrder?.txHashPayout || "Verified on-chain"}
                                             </p>
                                             {activeOrder?.txHashPayout && (
                                                <a href={getExplorerUrl(receiveCoin.symbol, activeOrder.txHashPayout)} target="_blank" rel="noopener noreferrer" className="px-4 bg-[var(--bg-card)] hover:bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg transition-colors flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary-color)] shadow-sm">
                                                    <ExternalLink size={18} />
                                                </a>
                                             )}
                                         </div>
                                     </div>
                                     <button 
                                         onClick={() => { setShowModal(false); setSwapStatus('PENDING'); setPayAmount(''); setReceiveAmount(''); }}
                                         className="w-full mt-6 bg-[var(--bg-card)] hover:bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-black text-lg py-4 rounded-xl transition-all shadow-sm active:scale-95"
                                     >
                                        Execute Another Swap
                                     </button>
                                </div>
                            ) : swapStatus === 'FAILED_PAYOUT' ? (
                                <div className="text-center py-8">
                                     <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                                     <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Payout Execution Failed</h3>
                                     <p className="text-xs font-bold text-[var(--text-secondary)]">Your deposit was mathematically secured, but the automated outbound hot wallet lacked sufficient blockchain fees or liquidity to actively push your swap. Your Hive/HBD is cryptographically safe. Contact Master Admin with Order ID <b>{activeOrder?.orderId}</b>.</p>
                                     <button onClick={() => setShowModal(false)} className="w-full mt-6 bg-red-500 text-white font-black py-4 rounded-xl">Discard Window</button>
                                </div>
                            ) : swapStatus === 'PROCESSING' || swapStatus === 'DEPOSIT_DETECTED' ? (
                                <div className="text-center py-10 flex flex-col items-center animate-in fade-in">
                                     <div className="relative mb-8">
                                         <div className="w-24 h-24 border-8 border-[var(--bg-canvas)] rounded-full"></div>
                                         <div className="w-24 h-24 border-8 border-purple-500 rounded-full border-t-transparent animate-spin abstract-center absolute top-0 left-0"></div>
                                         <RefreshCw className="w-8 h-8 text-purple-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                     </div>
                                     <h3 className="text-2xl font-black text-[var(--text-primary)] mb-3">Processing Execution</h3>
                                     <p className="text-sm font-bold text-[var(--text-secondary)] max-w-[280px] leading-relaxed">
                                         {swapStatus === 'DEPOSIT_DETECTED' 
                                            ? "Cryptographic deposit secured. Initiating cross-chain bridge arrays..."
                                            : "Broadcasting payload sequence instantly to the destination blockchain network..."
                                         }
                                     </p>
                                </div>
                            ) : (
                                <>
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

                                    {/* Deposit Instructions */}
                                    <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-6 text-center shadow-inner relative overflow-hidden">
                                        
                                        <h4 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 relative z-10">Deposit Instructions</h4>
                                        
                                        {payCoin.symbol === 'HIVE' || payCoin.symbol === 'HBD' ? (
                                    <>
                                        <p className="text-sm font-bold text-[var(--text-primary)] mb-2">Send precisely <strong className="text-red-500">{payAmount} {payCoin.symbol}</strong> to:</p>
                                        <button 
                                            onClick={() => handleCopy(activeOrder?.depositAddress || "@sovra.swap", 'address')}
                                            className="w-full relative group bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80 border border-[var(--border-color)] hover:border-[var(--primary-color)]/50 rounded-lg p-3 mb-3 transition-colors text-left flex items-center justify-between"
                                            title="Copy Deposit Address"
                                        >
                                            <span className="font-mono font-black text-lg text-[var(--primary-color)] select-all truncate">
                                                {activeOrder?.depositAddress || "Generating Address..."}
                                            </span>
                                            {copiedAddress ? <Check className="w-5 h-5 text-green-500 shrink-0" /> : <Copy className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] shrink-0 transition-colors" />}
                                        </button>
                                        
                                        <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">With Memo:</p>
                                        <button 
                                            onClick={() => handleCopy(activeOrder?.depositMemo, 'memo')}
                                            className="w-full relative group bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80 border border-[var(--border-color)] hover:border-[var(--primary-color)]/50 rounded-lg p-2 mb-2 transition-colors text-left flex items-center justify-between"
                                            title="Copy Deposit Memo"
                                        >
                                            <span className="font-mono text-sm text-[var(--text-primary)] break-all select-all pr-4">
                                                {activeOrder?.depositMemo || "..."}
                                            </span>
                                            {copiedMemo ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] shrink-0 transition-colors" />}
                                        </button>
                                        
                                        <button 
                                            onClick={handlePayViaKeychain}
                                            className="w-full mt-6 bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
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
                                        
                                        <button 
                                            onClick={() => handleCopy(activeOrder?.depositAddress, 'address')}
                                            className="w-full relative group bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80 border border-[var(--border-color)] hover:border-[var(--primary-color)]/50 rounded-lg p-4 mb-4 shadow-inner transition-colors text-left flex items-center justify-between"
                                            title="Copy Deposit Address"
                                        >
                                            <span className="font-mono text-xs font-black text-[var(--primary-color)] break-all select-all pr-4 line-clamp-2">
                                                {activeOrder?.depositAddress || "Awaiting Cryptographic Generation..."}
                                            </span>
                                            {copiedAddress ? <Check className="w-5 h-5 text-green-500 shrink-0" /> : <Copy className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] shrink-0 transition-colors" />}
                                        </button>

                                        <div className="flex items-center gap-2 justify-center bg-blue-500/10 text-blue-500 text-xs font-bold p-3 rounded-xl border border-blue-500/20 mt-6 relative z-10">
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Waiting to detect blockchain deposit...
                                        </div>
                                    </>
                                )}
                                {/* Optional Decorative Graphic mapping visually */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-card)] opacity-10 pointer-events-none z-0"></div>
                            </div>
                        </>
                    )}
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
