import { useState, useEffect } from 'react';
import { X, Send, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { web3WalletService, mnemonicStorage } from '../../../services/web3WalletService';
import { NotificationService } from '../../../services/notifications';
import { signingService } from '../../../services/signingService';
import { useNotification } from '../../../contexts/NotificationContext';
import { fetchHiveMetadata } from '../../../services/hiveMetadataService';
import { User, Wallet as WalletIcon, Loader2, CheckCircle2 as ConfirmedIcon } from 'lucide-react';

interface SendModalProps {
    username: string;
    chain: string;
    address: string;
    imageUrl?: string;
    privateKey?: string;
    balance: number;
    onUnlock: () => Promise<any>;
    onClose: () => void;
    onSuccess: (amount: string, hash: string) => void;
}

export function SendModal({ username, chain, address, imageUrl, privateKey, balance, onUnlock, onClose, onSuccess }: SendModalProps) {
    const [to, setTo] = useState('');
    const [sendMode, setSendMode] = useState<'username' | 'address'>('username');
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [fee, setFee] = useState<number | null>(null);
    const [fetchingFee, setFetchingFee] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const { showNotification } = useNotification();

    // Solana rent-exemption buffer (~0.0021 SOL)
    const RENT_BUFFER = chain === 'SOL' ? 0.0021 : 0;
    const spendableBalance = Math.max(0, balance - RENT_BUFFER);

    useEffect(() => {
        const resolveUsername = async () => {
            if (sendMode !== 'username' || !to) {
                setResolvedAddress(null);
                setResolveError(null);
                return;
            }

            const cleanUsername = to.replace(/^@/, '').trim().toLowerCase();
            if (!cleanUsername) return;

            setIsResolving(true);
            setResolveError(null);
            try {
                const tokens = await fetchHiveMetadata(cleanUsername);
                const chainToken = tokens.find(t => t.symbol === chain && t.type === 'CHAIN');

                if (chainToken?.meta?.address) {
                    setResolvedAddress(chainToken.meta.address);
                } else {
                    setResolvedAddress(null);
                    setResolveError(`@${cleanUsername} has no ${chain} address linked.`);
                }
            } catch (err) {
                console.error('Resolution error:', err);
                setResolveError('Failed to resolve Hive user data.');
            } finally {
                setIsResolving(false);
            }
        };

        const timer = setTimeout(resolveUsername, 600);
        return () => clearTimeout(timer);
    }, [to, sendMode, chain]);

    useEffect(() => {
        const fetchFee = async () => {
            const destination = sendMode === 'username' ? resolvedAddress : to;
            if (destination && amount && !isNaN(Number(amount))) {
                setFetchingFee(true);
                try {
                    const res = await web3WalletService.estimateFee(chain, address, destination, Number(amount));
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
    }, [to, resolvedAddress, sendMode, amount, chain, address]);

    // Hide BottomNav when modal is open
    useEffect(() => {
        document.body.setAttribute('data-hide-nav', 'true');
        return () => {
            document.body.removeAttribute('data-hide-nav');
        };
    }, []);

    const handleSend = async () => {
        let currentPrivateKey = privateKey;

        // If not unlocked, trigger seamless unlock first
        if (!currentPrivateKey) {
            setLoading(true);
            try {
                const derived = await onUnlock();
                // deriveSingleAddress returns exactly { address, publicKey, privateKey, imageUrl }
                // deriveAddresses returns { BTC: {...}, ETH: {...} }
                // `onUnlock` calls deriveSingleAddress which returns the flat object for the single chain.
                if (derived) {
                    if (derived.privateKey) {
                        currentPrivateKey = derived.privateKey;
                    } else if (derived[chain] && (derived[chain] as any).privateKey) {
                        currentPrivateKey = (derived[chain] as any).privateKey;
                    }
                }

                if (!currentPrivateKey) {
                    showNotification('Authorization succeeded but keys were not found', 'error');
                    setLoading(false);
                    return;
                }
                showNotification('Wallet authorized successfully!', 'success');
                // Continue with transaction...
            } catch (err: any) {
                showNotification(err.message || 'Authorization failed', 'error');
                setLoading(false);
                return;
            }
        }

        const destination = sendMode === 'username' ? resolvedAddress : to;

        if (!destination || !amount || isNaN(Number(amount))) {
            setError('Please enter a valid recipient and amount');
            return;
        }

        if (Number(amount) > spendableBalance) {
            setError(chain === 'SOL'
                ? `Insufficient spendable balance. Solana requires keeping ~0.0021 SOL for rent.`
                : 'Insufficient balance'
            );
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Get transaction parameters (nonce, gas, blockhash, etc.)
            const params = await web3WalletService.getTxParams(chain, address, destination, Number(amount));

            let signedTx = '';

            // 2. Sign locally based on the chain
            if (chain === 'ETH' || chain === 'BNB') {
                signedTx = await signingService.signEthTransaction(currentPrivateKey, {
                    to: destination,
                    value: (Number(amount) * 1e18).toString(), // simplified wei conversion
                    nonce: params.nonce,
                    gasLimit: params.gasLimit,
                    gasPrice: params.gasPrice,
                    chainId: params.chainId
                });
            } else if (chain === 'SOL') {
                signedTx = await signingService.signSolTransaction(currentPrivateKey, {
                    from: address,
                    to: destination,
                    amount: Number(amount),
                    recentBlockhash: params.recentBlockhash
                });
            } else if (chain === 'SOL_USDT') {
                signedTx = await signingService.signSolTokenTransaction(currentPrivateKey, {
                    from: address,
                    to: destination,
                    amount: Number(amount),
                    mintAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                    recentBlockhash: params.recentBlockhash,
                    ataExists: params.ataExists
                });
            } else if (chain === 'BTC') {
                signedTx = await signingService.signBtcTransaction(currentPrivateKey, {
                    from: address,
                    to: destination,
                    amount: Number(amount),
                    utxos: params.utxos,
                    feeRate: params.feeRate
                });
            } else if (chain === 'TRON') {
                // TRON backend gives us the transaction object
                signedTx = await signingService.signTronTransaction(currentPrivateKey, {
                    to: destination,
                    amount: Number(amount),
                    transaction: params.transaction
                });
            } else if (chain === 'APTOS') {
                signedTx = await signingService.signAptosTransaction(currentPrivateKey, {
                    to: destination,
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

            // Call onSuccess immediately to update parent state, but DON'T auto-close
            onSuccess(amount, hash);

            // 4. Record to Hive for permanent cross-device history (Fire and forget)
            // We do this AFTER onSuccess and we do not await it so the UI doesn't hang on the Keychain prompt
            web3WalletService.logTransactionToHive(username, {
                chain,
                to: destination,
                amount: Number(amount),
                hash,
                type: 'send'
            }).catch(e => console.warn('Failed to log tx to Hive:', e));

        } catch (err: any) {
            setError(err.message || 'Transaction failed');
            showNotification(err.message || 'Failed to send transaction', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (txHash) {
        return (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Transaction Sent!</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-6 break-all font-mono opacity-70">
                        {txHash}
                    </p>
                    <div className="flex flex-col gap-3">
                        <a
                            href={NotificationService.getExplorerUrl(chain, txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-xl hover:bg-[var(--bg-card)] transition-all flex items-center justify-center gap-2"
                        >
                            View on Explorer ↗
                        </a>
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
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
                        <p className="text-xs text-[var(--text-secondary)] font-medium">Total: {balance.toFixed(6)} {chain}</p>
                    </div>
                </div>
                {!mnemonicStorage.getEncrypted(username) && (
                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 items-start animate-in zoom-in-95 duration-300">
                        <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">View-Only Mode</p>
                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                Recovery phrase not found on this device. You can view balances, but you must <strong>Import your Phrase</strong> from the main wallet tab to enable sending.
                            </p>
                        </div>
                    </div>
                )}

                {/* Modes */}
                <div className="flex bg-[var(--bg-canvas)] p-1 rounded-2xl mb-6 border border-[var(--border-color)]">
                    <button
                        onClick={() => { setSendMode('username'); setTo(''); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${sendMode === 'username' ? 'bg-[var(--bg-card)] text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <User size={14} />
                        Hive User
                    </button>
                    <button
                        onClick={() => { setSendMode('address'); setTo(''); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${sendMode === 'address' ? 'bg-[var(--bg-card)] text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <WalletIcon size={14} />
                        Wallet Address
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 ml-1">
                            {sendMode === 'username' ? 'Hive Username' : 'Recipient Address'}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                placeholder={sendMode === 'username' ? "Enter username (e.g. @adesoji)" : `Enter ${chain} address`}
                                className={`w-full bg-[var(--bg-canvas)] border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all placeholder:opacity-30 ${resolveError ? 'border-red-500/50' : 'border-[var(--border-color)] focus:border-[var(--primary-color)]'}`}
                            />
                            {isResolving && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 size={16} className="animate-spin text-[var(--primary-color)]" />
                                </div>
                            )}
                            {resolvedAddress && !isResolving && sendMode === 'username' && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                    <ConfirmedIcon size={16} />
                                </div>
                            )}
                        </div>

                        {sendMode === 'username' && (
                            <div className="mt-2 min-h-[1.5rem]">
                                {isResolving && (
                                    <p className="text-[10px] text-[var(--text-secondary)] animate-pulse pl-1">Resolving Hive user data...</p>
                                )}
                                {resolveError && (
                                    <p className="text-[10px] text-red-500 pl-1 font-medium">{resolveError}</p>
                                )}
                                {resolvedAddress && !isResolving && (
                                    <div className="flex flex-col gap-0.5 pl-1">
                                        <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Address Resolved</p>
                                        <p className="text-[11px] font-mono text-[var(--text-secondary)] break-all opacity-80 leading-tight">
                                            {resolvedAddress}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-[var(--bg-canvas)] rounded-2xl p-4 border border-[var(--border-color)] mb-2">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1">Spendable Balance</p>
                                <p className="text-xl font-black text-[var(--text-primary)]">
                                    {spendableBalance.toFixed(6)} <span className="text-xs font-bold opacity-40">{chain}</span>
                                </p>
                            </div>
                            {chain === 'SOL' && (
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter">Rent Protected</p>
                                    <p className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60">0.0021 SOL</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 ml-1">Amount to Send</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all placeholder:opacity-30"
                            />
                            <button
                                onClick={() => setAmount(spendableBalance.toString())}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--primary-color)] hover:brightness-110 px-2 py-1 bg-[var(--primary-color)]/10 rounded-lg transition-all"
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
                                    <p className={`text-xs font-bold ${(fee !== null && (Number(amount) + fee) > balance) || Number(amount) > spendableBalance ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
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
                        disabled={loading || !to || !amount || (!privateKey && !mnemonicStorage.getEncrypted(username))}
                        className={`w-full py-4 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:shadow-none ${!privateKey ? 'bg-[var(--primary-color)] shadow-[var(--primary-color)]/25' : 'bg-green-600 shadow-green-600/25'}`}
                    >
                        {loading ? 'Processing...' : (
                            !mnemonicStorage.getEncrypted(username) ? 'Import Phrase to Send' : (!privateKey ? 'Confirm (Sign with Keychain)' : `Send ${amount} ${chain}`)
                        )}
                        {!loading && (privateKey ? <ShieldCheck size={18} /> : <Send size={16} />)}
                    </button>
                </div>
            </div>
        </div>
    );
}
