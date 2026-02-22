import { useState, useEffect } from 'react';
import { X, Send, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { web3WalletService } from '../../../services/web3WalletService';
import { signingService } from '../../../services/signingService';
import { useNotification } from '../../../contexts/NotificationContext';

interface SendModalProps {
    chain: string;
    address: string;
    imageUrl?: string;
    privateKey?: string;
    balance: number;
    onUnlock: () => Promise<void>;
    onClose: () => void;
    onSuccess: (amount: string, hash: string) => void;
}

export function SendModal({ chain, address, imageUrl, privateKey, balance, onUnlock, onClose, onSuccess }: SendModalProps) {
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [fee, setFee] = useState<number | null>(null);
    const [fetchingFee, setFetchingFee] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchFee = async () => {
            if (to && amount && !isNaN(Number(amount))) {
                setFetchingFee(true);
                try {
                    const res = await web3WalletService.estimateFee(chain, address, to, Number(amount));
                    if (res.success) {
                        const feeVal = typeof res.fee === 'object' ? res.fee.fee : res.fee;
                        setFee(Number(feeVal));
                    }
                } catch (err) {
                    console.warn('Fee estimation failed');
                } finally {
                    setFetchingFee(false);
                }
            } else {
                setFee(null);
            }
        };
        const timer = setTimeout(fetchFee, 500);
        return () => clearTimeout(timer);
    }, [to, amount, chain, address]);

    const handleSend = async () => {
        if (!privateKey) {
            setLoading(true);
            try {
                await onUnlock();
                showNotification('Wallet authorized successfully!', 'success');
            } catch (err: any) {
                showNotification(err.message || 'Authorization failed', 'error');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (!to || !amount || isNaN(Number(amount))) {
            setError('Please enter a valid recipient and amount');
            return;
        }

        if (Number(amount) > balance) {
            setError('Insufficient balance');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Get transaction parameters (nonce, gas, blockhash, etc.)
            const params = await web3WalletService.getTxParams(chain, address, to, Number(amount));

            let signedTx = '';

            // 2. Sign locally based on the chain
            if (chain === 'ETH' || chain === 'BNB') {
                signedTx = await signingService.signEthTransaction(privateKey, {
                    to,
                    value: (Number(amount) * 1e18).toString(), // simplified wei conversion
                    nonce: params.nonce,
                    gasLimit: params.gasLimit,
                    gasPrice: params.gasPrice,
                    chainId: params.chainId
                });
            } else if (chain === 'SOL') {
                signedTx = await signingService.signSolTransaction(privateKey, {
                    from: address,
                    to,
                    amount: Number(amount),
                    recentBlockhash: params.recentBlockhash
                });
            } else if (chain === 'BTC') {
                signedTx = await signingService.signBtcTransaction(privateKey, {
                    from: address,
                    to,
                    amount: Number(amount),
                    utxos: params.utxos,
                    feeRate: params.feeRate
                });
            } else if (chain === 'TRON') {
                // TRON backend gives us the transaction object
                signedTx = await signingService.signTronTransaction(privateKey, {
                    to,
                    amount: Number(amount),
                    transaction: params.transaction
                });
            } else if (chain === 'APTOS') {
                signedTx = await signingService.signAptosTransaction(privateKey, {
                    to,
                    amount: Number(amount),
                    sequenceNumber: params.sequenceNumber,
                    chainId: params.chainId
                });
            } else {
                throw new Error(`Local signing for ${chain} not yet implemented`);
            }

            // 3. Broadcast the raw signed transaction
            const hash = await web3WalletService.broadcastTransaction(chain, signedTx);

            setTxHash(hash);
            showNotification(`Successfully sent ${amount} ${chain}`, 'success');
            setTimeout(() => {
                onSuccess(amount, hash);
                onClose();
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Transaction failed');
            showNotification(err.message || 'Failed to send transaction', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (txHash) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Transaction Sent!</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-6 break-all font-mono opacity-70">
                        {txHash}
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    {imageUrl ? (
                        <img src={imageUrl} alt={chain} className="w-10 h-10 rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                        <div className="w-10 h-10 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-xl flex items-center justify-center">
                            <Send size={20} />
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Send {chain}</h3>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">Available: {balance.toFixed(6)} {chain}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 ml-1">Recipient Address</label>
                        <input
                            type="text"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder={`Enter ${chain} address`}
                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all placeholder:opacity-30"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 ml-1">Amount</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all placeholder:opacity-30"
                            />
                            <button
                                onClick={() => setAmount(balance.toString())}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--primary-color)] hover:brightness-110"
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {amount && !isNaN(Number(amount)) && (
                        <div className="space-y-2 pt-2 border-t border-[var(--border-color)]/30">
                            <div className="flex justify-between items-center text-xs px-1">
                                <span className="text-[var(--text-secondary)]">Amount to Send</span>
                                <span className="text-[var(--text-primary)] font-bold">{Number(amount).toFixed(6)} {chain}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs px-1">
                                <span className="text-[var(--text-secondary)]">Network Fee (Gas)</span>
                                {fetchingFee ? (
                                    <span className="text-[var(--text-secondary)] animate-pulse text-[10px]">Calculating...</span>
                                ) : (
                                    <span className="text-[var(--text-primary)] font-bold">
                                        {fee !== null && typeof fee === 'number' ? fee.toFixed(6) : '--'} {chain}
                                    </span>
                                )}
                            </div>
                            <div className="bg-[var(--primary-color)]/5 rounded-xl p-4 flex justify-between items-center mt-2 border border-[var(--primary-color)]/10">
                                <div>
                                    <p className="text-lg font-bold text-[var(--text-primary)]">
                                        {Number(amount).toFixed(6)} {chain}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Total Deduction</p>
                                    <p className={`text-xs font-bold ${(fee !== null && (Number(amount) + fee) > balance) ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
                                        {fee !== null ? (Number(amount) + fee).toFixed(6) : '--'} {chain}
                                    </p>
                                </div>
                            </div>
                            {fee !== null && (Number(amount) + fee) > balance && (
                                <p className="text-[10px] text-red-500 font-bold text-center animate-pulse mt-1">
                                    ⚠️ Total deduction exceeds your available balance
                                </p>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-red-500 bg-red-500/5 p-3 rounded-xl text-xs font-bold border border-red-500/10">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSend}
                        disabled={loading || !to || !amount}
                        className={`w-full py-4 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:shadow-none ${!privateKey ? 'bg-[var(--primary-color)] shadow-[var(--primary-color)]/25' : 'bg-green-600 shadow-green-600/25'}`}
                    >
                        {loading ? 'Processing...' : (
                            !privateKey ? 'Authorize to Sign' : `Confirm Send ${amount} ${chain}`
                        )}
                        {!loading && (privateKey ? <ShieldCheck size={18} /> : <Send size={16} />)}
                    </button>
                </div>
            </div>
        </div>
    );
}
