import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, AlertCircle, ShieldCheck, FileText, Send, CheckCircle2, Copy, Check } from 'lucide-react';
import { P2PService } from '../../../services/p2pService';
import { useNotification } from '../../../contexts/NotificationContext';
import { io, Socket } from 'socket.io-client';

export default function P2PTradeRoom() {
    const { orderId } = useParams(); 
    const navigate = useNavigate();
    const { showNotification, showConfirm } = useNotification();
    
    const [orderState, setOrderState] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState<string>('00:00');
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<{sender: string, text: string, time: string}[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [copied, setCopied] = useState(false);

    // Initial Fetch & Websocket Join
    useEffect(() => {
        if (!orderId) return;

        // Fetch Order natively from MongoDB
        P2PService.getOrder(orderId).then((data: any) => {
            setOrderState(data);
            setMessages(data.chatLog.map((log: any) => ({
                sender: log.senderId || log.sender,
                text: log.message || log.text,
                time: new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            })));
        }).catch(err => {
            console.error(err);
            // Fallback empty UI render if failed
        });

        const newSocket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000');
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_p2p_trade', { orderId });
        });

        newSocket.on('p2p_new_message', (msg: any) => {
            setMessages(prev => [...prev, {
                sender: msg.senderId || msg.sender,
                text: msg.message || msg.text,
                time: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            }]);
        });

        newSocket.on('p2p_order_updated', (msg: any) => {
            if (msg.orderId === orderId && msg.status) {
                setOrderState((prev: any) => ({ ...prev, status: msg.status }));
            }
        });

        return () => { newSocket.close(); };
    }, [orderId]);

    // Countdown Timer logic
    useEffect(() => {
        if (!orderState || orderState.status !== 'AWAITING_PAYMENT') return;
        
        const interval = setInterval(() => {
            const end = new Date(orderState.paymentDeadline).getTime();
            const now = new Date().getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('00:00');
                clearInterval(interval);
            } else {
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [orderState]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !socket || !orderId) return;
        
        const username = localStorage.getItem('hive_user') || 'adesojisouljay';
        socket.emit('p2p_chat_message', {
            orderId,
            senderId: username,
            message: chatInput
        });
        setChatInput('');
    };

    const handleConfirmPayment = async () => {
        try {
            if (!orderId) return;
            await P2PService.confirmPayment(orderId);
            setOrderState((prev: any) => ({ ...prev, status: 'RELEASING' }));
            
            const username = localStorage.getItem('hive_user') || 'adesojisouljay';
            if (socket) {
                socket.emit('p2p_chat_message', {
                    orderId,
                    senderId: 'system',
                    message: `${username} has transferred the fiat successfully. Awaiting merchant release verification.`
                });
                socket.emit('p2p_order_status_update', { orderId, status: 'RELEASING' });
            }
        } catch (error) {
            console.error(error);
            showNotification('Failed to construct the escrow checkout hook. It might already be processed.', 'error');
        }
    };

    const handleReleaseAssets = async () => {
        try {
            if (!orderId) return;
            await P2PService.completeOrder(orderId);
            setOrderState((prev: any) => ({ ...prev, status: 'COMPLETED' }));
            if (socket && orderId) {
                socket.emit('p2p_chat_message', {
                    orderId,
                    senderId: 'system',
                    message: `Trade Successfully Finalized! Decentralized Escrow released assets directly to the buyer.`
                });
                socket.emit('p2p_order_status_update', { orderId, status: 'COMPLETED' });
            }
        } catch (err) {
            console.error('Failed to notify database of smart contract success.', err);
            showNotification('Escrow Server command rejected. Please wait a moment or contact an admin.', 'error');
        }
    };

    const handleCancelOrder = async () => {
        const confirmed = await showConfirm('Cancel Escrow Order', 'Are you sure you want to definitively cancel this order?');
        if (!confirmed) return;
        try {
            if (!orderId) return;
            await P2PService.cancelOrder(orderId);
            setOrderState((prev: any) => ({ ...prev, status: 'CANCELLED' }));
            
            if (socket) {
                const username = localStorage.getItem('hive_user') || 'adesojisouljay';
                socket.emit('p2p_chat_message', {
                    orderId,
                    senderId: 'system',
                    message: `${username} has explicitly CANCELLED the Escrow ledger.`
                });
                socket.emit('p2p_order_status_update', { orderId, status: 'CANCELLED' });
            }
            showNotification('Order intentionally cancelled.', 'info');
        } catch (err: any) {
            console.error(err);
            showNotification('Cancellation failed. The order might already be processed or flagged.', 'error');
        }
    };

    if (!orderState) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-[var(--text-secondary)]">Connecting to the Immutable Escrow Engine...</p>
                </div>
            </div>
        );
    }

    const isAwaiting = orderState.status === 'AWAITING_PAYMENT';
    const isReleasing = orderState.status === 'RELEASING';

    const activeUser = localStorage.getItem('hive_user') || 'adesojisouljay';
    const isMaker = activeUser === orderState.makerId;
    const isSellAd = orderState.type === 'SELL';
    
    const isFiatSender = isSellAd ? !isMaker : isMaker;
    const isCryptoHolder = isSellAd ? isMaker : !isMaker;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            {/* Top Navigation Ribbon */}
            <button onClick={() => navigate('/market/p2p')} className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold mb-6 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to P2P Market
            </button>

            {/* Status Header Banner */}
            <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden relative ${isAwaiting ? 'bg-gradient-to-r from-orange-500 to-orange-400' : 'bg-gradient-to-r from-indigo-600 to-blue-500'}`}>
                {/* Background decorative styling */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl mix-blend-overlay"></div>
                
                <div>
                    <h1 className="text-3xl font-black tracking-tight mb-2">
                        {isAwaiting ? 'Awaiting Payment' : 'Releasing Assets'}
                    </h1>
                    <p className="text-white/80 font-bold text-sm md:text-base">
                        {isAwaiting 
                            ? `Please pay ${orderState?.makerId || 'the merchant'} within the time limit to secure the escrow.` 
                            : 'Payment confirmed. The merchant is verifying your transfer to release the crypto.'}
                    </p>
                </div>

                {isAwaiting && (
                    <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-4 flex-shrink-0">
                        <Clock className="w-8 h-8 text-white animate-pulse" />
                        <div>
                            <div className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">Time Remaining</div>
                            <div className="text-2xl font-black tracking-widest leading-none drop-shadow-md">{timeLeft}</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Panel: Active Chat Room */}
                <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-sm flex flex-col h-[600px] overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-canvas)]/50">
                        <div className="h-10 w-10 bg-gradient-to-tr from-[var(--primary-color)] to-purple-500 rounded-full flex items-center justify-center text-white font-black shadow-inner">
                            {orderState.makerId?.[0]?.toUpperCase() || 'M'}
                        </div>
                        <div>
                            <div className="font-bold flex items-center gap-1.5 text-[var(--text-primary)]">
                                {orderState.makerId}
                                <ShieldCheck className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="text-xs font-bold text-green-500 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[var(--bg-card)]">
                        {messages.map((msg, idx) => {
                            const isMe = msg.sender === (localStorage.getItem('hive_user') || 'adesojisouljay');
                            const alignSelf = isMe ? 'items-end' : msg.sender === 'system' ? 'items-center' : 'items-start';
                            
                            return (
                                <div key={idx} className={`flex flex-col ${alignSelf}`}>
                                    {msg.sender === 'system' ? (
                                        <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-bold px-4 py-2 rounded-full my-4 shadow-sm text-center">
                                            {msg.text}
                                        </div>
                                    ) : (
                                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-md ${
                                            isMe 
                                            ? 'bg-[var(--primary-color)] text-white rounded-tr-sm' 
                                            : 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-sm'
                                        }`}>
                                            <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                                            <span className={`text-[10px] font-bold mt-2 block ${isMe ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>
                                                {msg.time}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 bg-[var(--bg-canvas)]/50 border-t border-[var(--border-color)]">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <input 
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary-color)] transition-colors text-sm font-medium text-[var(--text-primary)]"
                            />
                            <button 
                                type="submit" 
                                disabled={!chatInput.trim()}
                                className="p-3 bg-[var(--primary-color)] text-white rounded-xl hover:bg-[var(--primary-color)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Panel: Transaction Actions & Details */}
                <div className="space-y-6">
                    {/* Order Summary Card */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-sm p-6">
                        <h3 className="text-lg font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[var(--primary-color)]" /> Order Info
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-[var(--text-secondary)]">Fiat Amount</span>
                                <span className="text-[var(--text-primary)] text-right">
                                    <span className="text-xl font-black text-green-500 mr-1">{Number(orderState?.tradeDetails?.fiatAmount || orderState?.fiatAmount).toLocaleString()}</span>
                                    {orderState?.tradeDetails?.fiatCurrency || orderState?.fiatCurrency}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-[var(--text-secondary)]">Price Rate</span>
                                <span className="text-[var(--text-primary)]">{orderState?.tradeDetails?.price || orderState?.price}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-bold pb-4 border-b border-[var(--border-color)]">
                                <span className="text-[var(--text-secondary)]">Receive Amount</span>
                                <span className="text-[var(--text-primary)]">{Number(orderState?.tradeDetails?.cryptoAmount || orderState?.cryptoAmount).toLocaleString(undefined, { maximumFractionDigits: 3 })} {orderState?.tradeDetails?.cryptoCurrency || orderState?.cryptoCurrency}</span>
                            </div>
                            
                            {/* Merchant Bank Details */}
                            <div className="pt-2 space-y-3">
                                <span className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider block mb-2">Transfer Details</span>
                                <div className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-[var(--text-secondary)]">Bank Name</span>
                                        <span className="text-sm font-bold text-[var(--text-primary)]">{orderState?.paymentMethodDetails?.bankName || orderState?.bankDetails?.bankName || 'Awaiting Details'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-[var(--text-secondary)]">Account Name</span>
                                        <span className="text-sm font-bold text-[var(--text-primary)]">{orderState?.paymentMethodDetails?.accountName || orderState?.bankDetails?.accountName || 'Awaiting Details'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-[var(--text-secondary)] mt-1">Account Number</span>
                                        <div className="flex items-center gap-2 bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] group">
                                            <span className="text-sm font-black text-[var(--primary-color)] font-mono tracking-widest">{orderState?.paymentMethodDetails?.accountNumber || orderState?.bankDetails?.accountNumber || 'Pending Configuration'}</span>
                                            
                                            {orderState?.paymentMethodDetails?.accountNumber && orderState.paymentMethodDetails.accountNumber !== 'N/A' && (
                                                <button 
                                                    title="Copy Account Number"
                                                    onClick={() => {
                                                        const num = orderState?.paymentMethodDetails?.accountNumber || orderState?.bankDetails?.accountNumber;
                                                        if (num) {
                                                            navigator.clipboard.writeText(num);
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 2000);
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-[var(--primary-color)]/10 text-[var(--text-secondary)] hover:text-[var(--primary-color)] rounded-md transition-colors"
                                                >
                                                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Critical Actions */}
                        <div className="mt-8 space-y-3">
                            {isAwaiting && isFiatSender && (
                                <button 
                                    onClick={handleConfirmPayment}
                                    className="w-full py-4 bg-[var(--primary-color)] text-white rounded-xl font-black uppercase tracking-widest shadow-lg hover:shadow-[var(--primary-color)]/25 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-5 h-5" /> I Have Paid
                                </button>
                            )}
                            
                            {isAwaiting && isFiatSender && (
                                <button onClick={handleCancelOrder} className="w-full py-4 bg-transparent border-2 border-[var(--border-color)] text-[var(--text-secondary)] rounded-xl font-bold uppercase tracking-wider hover:border-red-500 hover:text-red-500 transition-colors">
                                    Cancel Order
                                </button>
                            )}

                            {isAwaiting && isCryptoHolder && (
                                <div className="text-center text-sm font-bold text-orange-500 animate-pulse bg-orange-500/10 py-3 rounded-xl border border-orange-500/20">
                                    Awaiting Buyer Payment...
                                </div>
                            )}

                            {isReleasing && isCryptoHolder && (
                                <button 
                                    onClick={handleReleaseAssets}
                                    className="w-full py-4 bg-green-500 text-white rounded-xl font-black uppercase tracking-widest shadow-lg hover:shadow-green-500/25 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                >
                                    <ShieldCheck className="w-5 h-5" /> Release Assets
                                </button>
                            )}

                            {isReleasing && isFiatSender && (
                                <button className="w-full py-4 bg-transparent border-2 border-[var(--border-color)] text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-wider hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> Open Dispute
                                </button>
                            )}

                            {orderState.status === 'COMPLETED' && (
                                 <button disabled className="w-full py-4 bg-[var(--bg-canvas)] border-2 border-green-500/30 text-green-500 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-default">
                                    <CheckCircle2 className="w-5 h-5" /> Immutable Trade Finalized
                                </button>
                            )}

                            {orderState.status === 'CANCELLED' && (
                                 <button disabled className="w-full py-4 bg-red-500/10 border-2 border-red-500/30 text-red-500 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-default">
                                    <AlertCircle className="w-5 h-5" /> Trade Cancelled
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-xs font-bold text-yellow-600 dark:text-yellow-400 space-y-2">
                        <div className="flex gap-2 items-center mb-1">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="uppercase tracking-wider">Security Notice</span>
                        </div>
                        <p>Never transfer crypto directly to a user's wallet. All assets are safely locked in the Hive Escrow smart contract during this session.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
