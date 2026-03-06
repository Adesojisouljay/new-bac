import { useState, useEffect } from 'react';
import { X, Wallet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
    web3WalletService,
    mnemonicStorage,
    addressStorage,
    decryptMnemonic,
    UNLOCK_MESSAGE,
    Web3WalletInfo,
} from '../../../services/web3WalletService';
import { fetchHiveMetadata } from '../../../services/hiveMetadataService';
import { authService } from '../../auth/services/authService';
import { signingService } from '../../../services/signingService';
import { useNotification } from '../../../contexts/NotificationContext';
import { lightningService } from '../../../services/lightningService';

interface Web3TipModalProps {
    /** The Hive username of the person being tipped */
    recipientUsername: string;
    onClose: () => void;
    onSuccess?: () => void;
}


const CHAIN_ACCENT: Record<string, string> = {
    BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', TRON: '#ef0027',
    BNB: '#f0b90b', APTOS: '#00bcd4', BASE: '#0052ff', POLYGON: '#8247e5',
    ARBITRUM: '#28a0f0', USDT_TRC20: '#26a17b', USDT_BEP20: '#26a17b', USDT_ERC20: '#26a17b',
    TON: '#0088cc', SATS: '#EAB308',
};

const INTEGRATED_CHAINS = [
    'BTC', 'ETH', 'SOL', 'TRON', 'BNB', 'APTOS', 'BASE', 'POLYGON', 'ARBITRUM',
    'USDT_TRC20', 'USDT_BEP20', 'USDT_ERC20', 'SATS'
];

const SYMBOL_MAP: Record<string, string> = {
    'TRX': 'TRON',
    'MATIC': 'POLYGON'
};

type Step = 'select_chain' | 'enter_amount' | 'unlocking' | 'sending' | 'done' | 'error';

const SatsIcon = ({ className, color }: { className?: string, color?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <circle cx="12" cy="12" r="10" fill={color || "#F7931A"} />
        <path d="M12 7V8.5M12 15.5V17M9 9H13.5C14.8807 9 16 10.1193 16 11.5C16 12.8807 14.8807 14 13.5 14H10.5M10.5 14H14.5C15.6046 14 16.5 14.8954 16.5 16C16.5 17.1046 15.6046 18 14.5 18H9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export function Web3TipModal({ recipientUsername, onClose, onSuccess }: Web3TipModalProps) {

    const { showNotification } = useNotification();
    const senderUsername = (localStorage.getItem('hive_user') || '').replace(/^@/, '');

    // Recipient addresses keyed by chain
    const [recipientAddresses, setRecipientAddresses] = useState<Record<string, string>>({});
    // Sender's unlocked wallets (chain -> { balance, privateKey, address, imageUrl })
    const [senderWallets, setSenderWallets] = useState<Record<string, { balance: number; privateKey: string; address: string; imageUrl: string }>>({});
    // Sender's view-only info (before unlock)
    const [senderInfo, setSenderInfo] = useState<Web3WalletInfo[]>([]);
    const [isLocked, setIsLocked] = useState(false);

    const [loadingRecipient, setLoadingRecipient] = useState(true);
    const [loadingSender, setLoadingSender] = useState(true);
    const [recipientHasWallet, setRecipientHasWallet] = useState(true);

    const [selectedChain, setSelectedChain] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [fee, setFee] = useState<number | null>(null);
    const [fetchingFee, setFetchingFee] = useState(false);
    const [step, setStep] = useState<Step>('select_chain');
    const [txHash, setTxHash] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // ── Load recipient addresses from Hive metadata ──────────────────────────
    useEffect(() => {
        (async () => {
            setLoadingRecipient(true);
            try {
                const tokens = await fetchHiveMetadata(recipientUsername);
                const chainTokens = tokens.filter(t => t.type === 'CHAIN');
                if (chainTokens.length === 0) {
                    setRecipientHasWallet(false);
                } else {
                    const addrMap: Record<string, string> = {};
                    chainTokens.forEach(t => {
                        const normalized = SYMBOL_MAP[t.symbol] || t.symbol;
                        addrMap[normalized] = t.meta?.address || '';
                    });
                    setRecipientAddresses(addrMap);

                    // Auto-select first available chain
                    const firstChain = Object.keys(addrMap).find(c => addrMap[c]);
                    if (firstChain) {
                        setSelectedChain(firstChain);
                        setStep('enter_amount');
                    }
                }
            } catch (err) {
                setRecipientHasWallet(false);
            } finally {
                setLoadingRecipient(false);
            }
        })();
    }, [recipientUsername]);

    // ── Load sender's public wallet info (view-only first) ───────────────────
    useEffect(() => {
        if (!senderUsername) { setLoadingSender(false); return; }
        (async () => {
            setLoadingSender(true);
            try {
                // Check local cache first — fastest
                const cached = addressStorage.get(senderUsername);
                const hasEncrypted = !!mnemonicStorage.getEncrypted(senderUsername);
                setIsLocked(hasEncrypted);

                let info: Web3WalletInfo[] = [];

                if (cached) {
                    // Build mock wallets for balance fetch
                    const mockWallets: any = { mnemonic: '' };
                    Object.entries(cached).forEach(([chain, data]) => { mockWallets[chain] = data; });
                    try {
                        info = await web3WalletService.getWalletInfo(mockWallets);
                        setSenderInfo(info);
                    } catch { /* balances optional */ }
                } else {
                    // Try Hive metadata
                    const tokens = await fetchHiveMetadata(senderUsername);
                    const chainTokens = tokens.filter(t => t.type === 'CHAIN');
                    const mockWallets: any = { mnemonic: '' };
                    info = chainTokens.map(t => {
                        const normalized = SYMBOL_MAP[t.symbol] || t.symbol;
                        return {
                            chain: normalized, symbol: t.symbol,
                            address: t.meta?.address || '', imageUrl: t.meta?.imageUrl || '',
                            balance: 0, price: 0, change24h: 0, usdValue: 0,
                        };
                    });
                    chainTokens.forEach(t => {
                        const normalized = SYMBOL_MAP[t.symbol] || t.symbol;
                        mockWallets[normalized] = { address: t.meta?.address, imageUrl: t.meta?.imageUrl };
                    });
                    if (info.length > 0) {
                        setSenderInfo(info);
                        try {
                            info = await web3WalletService.getWalletInfo(mockWallets);
                            setSenderInfo(info);
                        } catch { /* balances optional */ }
                    }
                }

                // Append SATS info
                try {
                    const satsBalance = await lightningService.getBalance(senderUsername);
                    if (satsBalance !== null) {
                        const satsInfo: Web3WalletInfo = {
                            chain: 'SATS',
                            symbol: 'SATS',
                            address: `${senderUsername}@sovraniche.com`,
                            imageUrl: '',
                            balance: satsBalance,
                            price: 0,
                            change24h: 0,
                            usdValue: 0
                        };
                        setSenderInfo(prev => {
                            const filtered = prev.filter(w => w.chain !== 'SATS');
                            return [...filtered, satsInfo];
                        });
                    }
                } catch (err) {
                    console.error('Failed to load SATS balance:', err);
                }

            } finally {
                setLoadingSender(false);
            }
        })();
    }, [senderUsername]);

    // ── Fetch fee estimate when chain OR amount changes ────────────────────────
    useEffect(() => {
        if (!selectedChain) { setFee(null); return; }
        const recipientAddr = recipientAddresses[selectedChain];
        const senderAddr = senderWallets[selectedChain]?.address || senderInfo.find(i => i.chain === selectedChain)?.address || '';
        if (!senderAddr || !recipientAddr) return;

        const timer = setTimeout(async () => {
            setFetchingFee(true);
            try {
                // Fetch fee using 0 amount for initial "base" fee estimation if amount empty
                const res = await web3WalletService.estimateFee(selectedChain, senderAddr, recipientAddr, Number(amount) || 0);
                if (res.success) setFee(typeof res.fee === 'object' ? res.fee.fee : Number(res.fee));
            } catch { /* ignore */ } finally { setFetchingFee(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [selectedChain, amount, senderWallets, senderInfo, recipientAddresses]);

    // ── Unlock wallet via Keychain signature ──────────────────────────────────
    const handleUnlock = async () => {
        setStep('unlocking');
        try {
            if (selectedChain === 'SATS') {
                const walletData = await lightningService.getOrCreateWallet(senderUsername);
                let rawInkey = '';

                if ((walletData as any).isNew) {
                    rawInkey = (walletData as any).inkey;
                    // For new wallets, we also need to SAVE it (encrypting it via Keychain)
                    await lightningService.saveWallet(senderUsername, walletData.walletId, rawInkey);
                } else if (walletData.encryptedInkey) {
                    // Decrypt existing wallet
                    const sig = await authService.signMessage(senderUsername, UNLOCK_MESSAGE, 'Posting');
                    if (!sig.success || !sig.result) throw new Error('Signature failed');
                    rawInkey = await lightningService.decryptInkey(walletData.encryptedInkey, walletData.salt!, sig.result);
                }

                if (rawInkey) {
                    try {
                        const freshBalance = await lightningService.getBalance(senderUsername, rawInkey);
                        const walletObj = {
                            balance: freshBalance,
                            privateKey: rawInkey,
                            address: `${senderUsername}@sovraniche.com`,
                            imageUrl: ''
                        };

                        setSenderWallets(prev => ({ ...prev, SATS: walletObj }));

                        // Also update senderInfo so balances match
                        setSenderInfo(prev => {
                            const filtered = prev.filter(w => w.chain !== 'SATS');
                            return [...filtered, {
                                chain: 'SATS', symbol: 'SATS', address: walletObj.address,
                                balance: freshBalance, imageUrl: '', price: 0, change24h: 0, usdValue: 0
                            }];
                        });
                    } catch (balErr) {
                        console.error('Failed to get fresh balance after unlock:', balErr);
                        // Still unlock even if balance fetch fails
                        setSenderWallets(prev => ({
                            ...prev,
                            SATS: { balance: 0, privateKey: rawInkey, address: `${senderUsername}@sovraniche.com`, imageUrl: '' }
                        }));
                    }
                }
            } else {
                const encrypted = mnemonicStorage.getEncrypted(senderUsername);
                const salt = mnemonicStorage.getSalt(senderUsername);
                if (!encrypted || !salt) throw new Error('No wallet found');

                const sig = await authService.signMessage(senderUsername, UNLOCK_MESSAGE, 'Posting');
                if (!sig.success || !sig.result) throw new Error('Signature failed');
                const mnemonic = await decryptMnemonic(encrypted, salt, sig.result);
                const derived = await web3WalletService.deriveAddresses(mnemonic);
                const info = await web3WalletService.getWalletInfo(derived as any);
                const walletMap: typeof senderWallets = {};
                info.forEach(w => {
                    const raw = (derived as any)[w.chain];
                    if (raw?.privateKey) {
                        walletMap[w.chain] = { balance: w.balance, privateKey: raw.privateKey, address: w.address, imageUrl: w.imageUrl };
                    }
                });
                setSenderWallets(prev => ({ ...prev, ...walletMap }));
                setSenderInfo(prev => {
                    const next = [...prev];
                    info.forEach(latest => {
                        const idx = next.findIndex(p => p.chain === latest.chain);
                        if (idx === -1) next.push(latest);
                        else next[idx] = latest;
                    });
                    return next;
                });
            }

            setIsLocked(false);
            setStep('enter_amount');
            showNotification('Wallet unlocked!', 'success');
        } catch (err: any) {
            setStep('enter_amount');
            showNotification(err.message || 'Unlock failed', 'error');
        }
    };

    // ── Send the tip ──────────────────────────────────────────────────────────
    const handleSendTip = async () => {
        if (!selectedChain || !amount) return;
        const wallet = senderWallets[selectedChain];

        // Special Handling for SATS (Lightning)
        if (selectedChain === 'SATS') {
            if (!wallet?.privateKey) return;
            setStep('sending');
            try {
                // 1. Generate Invoice for Recipient
                const bolt11 = await lightningService.createInvoice(recipientUsername, Number(amount), `Tip from @${senderUsername}`);

                // 2. Pay it with Sender's Inkey
                const hash = await lightningService.pay(bolt11, wallet.privateKey);

                setTxHash(hash);
                setStep('done');
                if (onSuccess) onSuccess();
                showNotification(`Tipped ${amount} SATS to @${recipientUsername}! ⚡`, 'success');
            } catch (err: any) {
                setErrorMsg(err.message || 'Payment failed');
                setStep('error');
            }
            return;
        }

        const recipientAddr = recipientAddresses[selectedChain];
        if (!recipientAddr || !wallet?.privateKey) return;

        setStep('sending');
        try {
            const params = await web3WalletService.getTxParams(selectedChain, wallet.address, recipientAddr, Number(amount));
            let signedTx = '';

            if (['ETH', 'BNB', 'BASE', 'POLYGON', 'ARBITRUM'].includes(selectedChain)) {
                signedTx = await signingService.signEthTransaction(wallet.privateKey, {
                    to: recipientAddr, value: (Number(amount) * 1e18).toString(),
                    nonce: params.nonce, gasLimit: params.gasLimit,
                    gasPrice: params.gasPrice, chainId: params.chainId,
                });
            } else if (selectedChain === 'SOL') {
                signedTx = await signingService.signSolTransaction(wallet.privateKey, {
                    from: wallet.address, to: recipientAddr,
                    amount: Number(amount), recentBlockhash: params.recentBlockhash,
                });
            } else if (selectedChain === 'BTC') {
                signedTx = await signingService.signBtcTransaction(wallet.privateKey, {
                    from: wallet.address, to: recipientAddr,
                    amount: Number(amount), utxos: params.utxos, feeRate: params.feeRate,
                });
            } else if (selectedChain === 'TRON') {
                signedTx = await signingService.signTronTransaction(wallet.privateKey, {
                    to: recipientAddr, amount: Number(amount), transaction: params.transaction,
                });
            } else if (selectedChain === 'APTOS') {
                signedTx = await signingService.signAptosTransaction(wallet.privateKey, {
                    to: recipientAddr, amount: Number(amount),
                    sequenceNumber: params.sequenceNumber, chainId: params.chainId,
                });
            } else {
                throw new Error(`Signing not supported for ${selectedChain}`);
            }

            const hash = await web3WalletService.broadcastTransaction(selectedChain, signedTx);
            setTxHash(hash);
            setStep('done');
            if (onSuccess) onSuccess();
            showNotification(`Tipped ${amount} ${selectedChain} to @${recipientUsername}! 🎉`, 'success');
        } catch (err: any) {

            setErrorMsg(err.message || 'Transaction failed');
            setStep('error');
        }
    };

    const availableChains = Object.keys(recipientAddresses).filter(chain =>
        recipientAddresses[chain]
    );

    // SATS doesn't require the recipient to have an address pre-configured.
    // LNBits will generate an invoice on the fly tied to their Hive username.
    if (!availableChains.includes('SATS')) {
        availableChains.push('SATS');
    }

    const senderBalance = (chain: string) =>
        senderWallets[chain]?.balance ?? senderInfo.find(i => i.chain === chain)?.balance ?? 0;

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Loading
    // ─────────────────────────────────────────────────────────────────────────
    if (loadingRecipient || loadingSender) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">

                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-10 flex flex-col items-center gap-4 shadow-2xl">
                    <Loader2 className="animate-spin text-[var(--primary-color)]" size={32} />
                    <p className="text-sm text-[var(--text-secondary)]">Loading wallet data…</p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Recipient has no web3 wallet
    // ─────────────────────────────────────────────────────────────────────────
    if (!recipientHasWallet || availableChains.length === 0) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">

                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-[var(--bg-canvas)] rounded-full flex items-center justify-center mx-auto text-3xl">🔗</div>
                    <h3 className="text-lg font-bold">No Web3 Wallet</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                        @{recipientUsername} hasn't set up a Web3 wallet yet and cannot receive crypto tips.
                    </p>
                    <button onClick={onClose} className="w-full py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl font-bold text-sm hover:bg-[var(--bg-card)] transition-all">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Success
    // ─────────────────────────────────────────────────────────────────────────
    if (step === 'done') {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">

                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={36} />
                    </div>
                    <h3 className="text-xl font-bold">Tip Sent! 🎉</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Successfully tipped <span className="font-bold text-[var(--text-primary)]">{amount} {selectedChain}</span> to @{recipientUsername}</p>
                    {txHash && (
                        <p className="text-[10px] font-mono text-[var(--text-secondary)] break-all opacity-60">
                            Tx: {txHash}
                        </p>
                    )}
                    <button onClick={onClose} className="w-full py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[var(--primary-color)]/20">
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Error
    // ─────────────────────────────────────────────────────────────────────────
    if (step === 'error') {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">

                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold">Transaction Failed</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{errorMsg}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setStep('enter_amount')} className="flex-1 py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 transition-all">
                            Try Again
                        </button>
                        <button onClick={onClose} className="flex-1 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] font-bold rounded-xl hover:bg-[var(--bg-card)] transition-all">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const accentColor = selectedChain ? (CHAIN_ACCENT[selectedChain] || 'var(--primary-color)') : 'var(--primary-color)';

    // ─────────────────────────────────────────────────────────────────────────
    // Main modal
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">

            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 px-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-canvas)]/50">
                    <div>
                        <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Wallet size={16} className="text-[var(--primary-color)]" />
                            Tip @{recipientUsername}
                        </h2>
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-80">Send crypto from your Web3 wallet</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">

                    {/* ── Step: Processing ── */}
                    {(step === 'unlocking' || step === 'sending') && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="animate-spin text-[var(--primary-color)]" size={36} />
                            <p className="text-sm font-bold text-[var(--text-secondary)]">
                                {step === 'unlocking' ? 'Unlocking wallet via Keychain…' : 'Broadcasting transaction…'}
                            </p>
                        </div>
                    )}

                    {/* ── Step: Select chain ── */}
                    {(step === 'select_chain' || step === 'enter_amount') && (
                        <>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 block">
                                    Select Chain
                                </label>
                                <div className="max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                    <div className="grid grid-cols-3 gap-2">
                                        {availableChains.map(chain => {
                                            const accent = CHAIN_ACCENT[chain] || '#888';
                                            const info = senderInfo.find(i => i.chain === chain);
                                            const isSelected = selectedChain === chain;
                                            return (
                                                <button
                                                    key={chain}
                                                    onClick={() => { setSelectedChain(chain); setStep('enter_amount'); setAmount(''); }}
                                                    className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${isSelected
                                                        ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5 shadow-md'
                                                        : 'border-[var(--border-color)] hover:border-[var(--text-secondary)] bg-[var(--bg-canvas)]'
                                                        }`}
                                                >
                                                    {chain === 'SATS' ? (
                                                        <div className="w-6 h-6 rounded-lg overflow-hidden shadow-sm">
                                                            <SatsIcon color={accent} />
                                                        </div>
                                                    ) : info?.imageUrl ? (
                                                        <img src={info.imageUrl} alt={chain} className="w-6 h-6 object-contain" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${accent}20`, color: accent }}>{chain[0]}</div>
                                                    )}
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-primary)] truncate max-w-full">{chain.replace('_', ' ')}</span>
                                                    <span className="text-[8px] text-[var(--text-secondary)] opacity-70">
                                                        {info?.balance !== undefined ? info.balance.toFixed(3) : '—'}
                                                    </span>
                                                    {isSelected && (
                                                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--primary-color)]" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* ── Amount + send (once chain selected) ── */}
                            {step === 'enter_amount' && selectedChain && (
                                <>
                                    {/* Sender Wallet Unlock Prompt */}
                                    {/* Sender Wallet Unlock Prompt */}
                                    {((selectedChain === 'SATS' && !senderWallets.SATS) || (selectedChain !== 'SATS' && isLocked && !senderWallets[selectedChain])) && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex items-center gap-3">
                                            <span className="text-lg shrink-0">🔒</span>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-bold text-amber-500">Wallet Locked</p>
                                                <p className="text-[9px] text-[var(--text-secondary)] opacity-70">
                                                    Unlock to sign transactions.
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleUnlock}
                                                className="shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white rounded-lg hover:brightness-110 active:scale-95 transition-all"
                                                style={{ backgroundColor: accentColor }}
                                            >
                                                Unlock
                                            </button>
                                        </div>
                                    )}

                                    {/* Handle Integrated vs Not Yet Integrated */}
                                    {!INTEGRATED_CHAINS.includes(selectedChain) ? (
                                        <div className="space-y-4">
                                            {/* Summary for Unsupported */}
                                            <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col gap-2">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-[var(--text-secondary)]">Available Balance</span>
                                                    <span className="font-black text-[var(--text-primary)]">{senderBalance(selectedChain).toFixed(6)} {selectedChain}</span>
                                                </div>
                                            </div>

                                            <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-6 text-center space-y-3">
                                                <div className="w-12 h-12 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full flex items-center justify-center mx-auto text-xl">
                                                    ⏳
                                                </div>
                                                <h4 className="font-bold text-[var(--text-primary)] text-sm">{selectedChain} Integration Coming Soon</h4>
                                                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                                    We're currently working on adding secure signing support for {selectedChain}.
                                                    In the meantime, you can tip @{recipientUsername} using other coins they support below.
                                                </p>
                                            </div>

                                            {/* Alternative Suggestions */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                                                    Supported Alternatives
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {availableChains
                                                        .filter(c => INTEGRATED_CHAINS.includes(c))
                                                        .map(chain => {
                                                            const info = senderInfo.find(i => i.chain === chain);
                                                            return (
                                                                <button
                                                                    key={chain}
                                                                    onClick={() => setSelectedChain(chain)}
                                                                    className="flex items-center gap-2 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--primary-color)] transition-all text-left"
                                                                >
                                                                    {info?.imageUrl ? (
                                                                        <img src={info.imageUrl} alt={chain} className="w-4 h-4 object-contain" />
                                                                    ) : (
                                                                        <div className="w-4 h-4 bg-[var(--primary-color)]/20 rounded-md" />
                                                                    )}
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-bold text-[var(--text-primary)]">{chain}</span>
                                                                        <span className="text-[8px] text-[var(--text-secondary)] opacity-70">
                                                                            {senderBalance(chain).toFixed(3)}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Prominent Balance + Fee Info Card */}
                                            <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Your Balance</span>
                                                    <span className="text-sm font-black text-[var(--text-primary)]" style={{ color: accentColor }}>
                                                        {senderBalance(selectedChain).toFixed(6)} {selectedChain}
                                                    </span>
                                                </div>
                                                <div className="h-px bg-[var(--border-color)] opacity-50" />
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Network Fee</span>
                                                    {fetchingFee ? (
                                                        <Loader2 className="animate-spin text-[var(--text-secondary)]" size={12} />
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-[var(--text-primary)]">
                                                            {fee !== null ? `≈ ${fee.toFixed(6)}` : '—'} {selectedChain}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Amount input */}
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Tip amount</label>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={amount}
                                                            onChange={e => setAmount(e.target.value)}
                                                            placeholder="0.00"
                                                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 pr-20 text-sm text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all placeholder:opacity-30"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                            <button onClick={() => setAmount(senderBalance(selectedChain).toString())} className="text-[9px] font-black text-[var(--primary-color)] hover:brightness-110">MAX</button>
                                                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">{selectedChain}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Summary Calculation */}
                                                {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                                                    <div className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-3 flex flex-col gap-1.5 text-[10px]">
                                                        <div className="flex justify-between font-bold">
                                                            <span className="text-[var(--text-secondary)] opacity-80">Total to Deduct</span>
                                                            <span className="text-[var(--text-primary)]">
                                                                {(Number(amount) + (fee || 0)).toFixed(6)} {selectedChain}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between border-t border-[var(--border-color)] pt-1.5">
                                                            <span className="font-black text-[var(--text-secondary)] uppercase tracking-wider">Recipient Receives</span>
                                                            <span className="text-sm font-black" style={{ color: accentColor }}>{Number(amount).toFixed(6)} {selectedChain}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Recipient address preview */}
                                                {recipientAddresses[selectedChain] && (
                                                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-canvas)]/30 border border-[var(--border-color)] rounded-xl p-2.5">
                                                        <span className="shrink-0 opacity-50">To:</span>
                                                        <code className="truncate font-mono opacity-40 text-[9px]">{recipientAddresses[selectedChain]}</code>
                                                    </div>
                                                )}

                                                {/* CTA */}
                                                <button
                                                    onClick={handleSendTip}
                                                    disabled={!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !senderWallets[selectedChain]}
                                                    className="w-full py-3.5 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ backgroundColor: accentColor, boxShadow: `0 8px 24px ${accentColor}33` }}
                                                >
                                                    {senderWallets[selectedChain]
                                                        ? `Send ${amount || '0'} ${selectedChain} Tip 💸`
                                                        : 'Unlock wallet to send'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
