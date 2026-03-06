import { useEffect, useState, useCallback, useRef } from 'react';
import {
    web3WalletService,
    mnemonicStorage,
    addressStorage,
    RawWallet,
    RawWallets,
    Web3WalletInfo,
    encryptMnemonic,
    decryptMnemonic,
    UNLOCK_MESSAGE,
} from '../../../services/web3WalletService';
import {
    fetchHiveMetadata,
    updateHiveMetadata,
    buildHiveWalletTokens,
} from '../../../services/hiveMetadataService';
import { NotificationService } from '../../../services/notifications';
import { CopyButton } from '../components/CopyButton';
import { QRModal } from '../components/QRModal';
import { MnemonicModal } from '../components/MnemonicModal';
import { useNotification } from '../../../contexts/NotificationContext';
import { SendModal } from '../components/SendModal';
import { ImportModal } from '../components/ImportModal';
import { Web3ActivityFeed } from '../components/Web3ActivityFeed';
import { SwapModal } from '../components/SwapModal';
import { QRCodeSVG } from 'qrcode.react';
import { authService } from '../../auth/services/authService';

// ─── Chain colour accents ────────────────────────────────────────────────────
const CHAIN_ACCENT: Record<string, string> = {
    BTC: '#f7931a',
    ETH: '#627eea',
    SOL: '#9945ff',
    TRON: '#ef0027',
    BNB: '#f0b90b',
    APTOS: '#00bcd4',
    BASE: '#0052ff',
    POLYGON: '#8247e5',
    ARBITRUM: '#28a0f0',
    USDT_TRC20: '#26a17b',
    USDT_BEP20: '#26a17b',
};

interface Web3WalletsProps {
    username: string;
}

export function Web3Wallets({ username }: Web3WalletsProps) {
    const { showNotification, showConfirm } = useNotification();

    const [rawWallets, setRawWallets] = useState<RawWallets | null>(null);
    const [walletInfo, setWalletInfo] = useState<Web3WalletInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [qrTarget, setQrTarget] = useState<Web3WalletInfo | null>(null);
    const [generating, setGenerating] = useState(false);
    const [sendTarget, setSendTarget] = useState<Web3WalletInfo | null>(null);
    const [swapTarget, setSwapTarget] = useState<Web3WalletInfo | null>(null);
    const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [unlockedChains, setUnlockedChains] = useState<Record<string, RawWallet>>({});
    const [activeMainTab, setActiveMainTab] = useState<'assets' | 'history'>('assets');
    const [authQR, setAuthQR] = useState<string | null>(null);
    const currentUser = localStorage.getItem('hive_user');
    const normalizedCurrentUser = currentUser?.replace(/^@/, '');
    const isOwner = normalizedCurrentUser === username;
    const previousBalancesRef = useRef<Record<string, number>>({});

    const deriveAndFetch = useCallback(async (mnemonic: string, targetChain?: string) => {
        // Use a less destructive loader for selective derivations so we don't unmount child modals
        if (targetChain) {
            setLoadingInfo(true);
        } else {
            setLoading(true);
        }
        try {
            if (targetChain) {
                // Selective derivation
                const wallet = await web3WalletService.deriveSingleAddress(mnemonic, targetChain);
                setUnlockedChains(prev => ({ ...prev, [targetChain]: wallet }));
                setLoadingInfo(false);
                return wallet;
            }

            const derived = await web3WalletService.deriveAddresses(mnemonic);

            // Update local public address cache
            const publicCache: any = {};
            Object.entries(derived).forEach(([chain, data]) => {
                if (chain !== 'mnemonic') {
                    publicCache[chain] = { address: (data as any).address, imageUrl: (data as any).imageUrl };
                }
            });
            addressStorage.set(username, publicCache);

            setRawWallets(derived);
            fetchBalances(derived);
            return derived;
        } catch (err: any) {
            showNotification(`Failed to derive wallets: ${err.message}`, 'error');
            throw err;
        } finally {
            if (targetChain) {
                setLoadingInfo(false);
            } else {
                setLoading(false);
            }
        }
    }, [showNotification, username]);

    const fetchBalances = async (wallets: RawWallets, isSilent = false) => {
        if (!isSilent) setLoadingInfo(true);
        try {
            const info = await web3WalletService.getWalletInfo(wallets);

            // 1. Check for deposits (keep this accurate!)
            info.forEach(newCard => {
                const prevBalance = previousBalancesRef.current[newCard.chain];
                if (prevBalance !== undefined && newCard.balance > prevBalance) {
                    const amount = newCard.balance - prevBalance;
                    const msg = `Deposit Received: +${amount.toFixed(6)} ${newCard.chain}`;
                    showNotification(msg, 'success');
                    NotificationService.addLocalNotification(username, msg, 'deposit', 'wallet', undefined, newCard.chain, newCard.address);
                }
                // Update ref
                previousBalancesRef.current[newCard.chain] = newCard.balance;
            });

            // 2. Merge new results with existing state to avoid flicker and maintain stale prices
            setWalletInfo(prev => {
                if (prev.length === 0) return info;
                const next = [...prev];
                info.forEach(latest => {
                    const idx = next.findIndex(p => p.chain === latest.chain);
                    if (idx === -1) {
                        next.push(latest);
                    } else {
                        const old = next[idx];

                        // Handle failed fetch (null balance) by keeping the old balance
                        const balance = latest.balance !== null ? latest.balance : old.balance;

                        // Stale Price Preservation: If balance > 0 but new price is 0/null, keep the old price if we have it
                        const oldPrice = old.price || 0;
                        const latestPrice = latest.price || 0;
                        const price = (balance !== null && balance > 0 && latestPrice <= 0 && oldPrice > 0) ? oldPrice : latestPrice;

                        const usdValue = balance !== null ? balance * price : old.usdValue;
                        const change24h = (latest.change24h === 0 && (old.change24h || 0) !== 0) ? old.change24h : latest.change24h;

                        next[idx] = { ...latest, balance, price, usdValue, change24h };
                    }
                });
                return next;
            });
        } catch (err: any) {
            console.warn('Balance fetch failed (non-critical):', err.message);
        } finally {
            if (!isSilent) setLoadingInfo(false);
        }
    };

    // ── Polling for Background Deposits ─────────────────────────────────────
    const walletAddresses = walletInfo.map(w => w.address).join(',');
    useEffect(() => {
        if (walletInfo.length === 0) return;

        const pollId = setInterval(() => {

            const currentWallets: any = { mnemonic: '' };
            walletInfo.forEach(w => {
                currentWallets[w.chain] = { address: w.address, imageUrl: w.imageUrl };
            });
            fetchBalances(currentWallets as RawWallets, true); // Silent refresh
        }, 180000); // Poll every 3 minutes (180000ms)

        return () => clearInterval(pollId);
    }, [walletAddresses, username]); // Only reset if the list of addresses changes

    // ── Load state on mount ──────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {

            setLoading(true);
            try {
                // 1. Check Hive Blockchain for public metadata

                const tokens = await fetchHiveMetadata(username);


                // 2. Check local Address Cache (most reliable for current user)
                const cachedAddresses = addressStorage.get(username);


                // 3. Prepare View-Only Wallets (Merge Remote Metadata + Local Cache)
                const combinedWallets: Record<string, { address: string; imageUrl: string }> = {};

                // A. Start with remote metadata (ground truth from Hive)
                tokens.filter(t => t.type === 'CHAIN').forEach(t => {
                    if (t.symbol && t.meta.address) {
                        combinedWallets[t.symbol] = {
                            address: t.meta.address,
                            imageUrl: t.meta.imageUrl || ''
                        };
                    }
                });

                // B. Overlay with local cache (public addresses we know)
                if (cachedAddresses) {
                    Object.entries(cachedAddresses).forEach(([chain, data]) => {
                        combinedWallets[chain] = data;
                    });
                }

                // C. Build initial info and mock wallets for balance fetching
                const initialInfo: Web3WalletInfo[] = [];
                const mockWallets: any = { mnemonic: '' };

                Object.entries(combinedWallets).forEach(([chain, data]) => {
                    initialInfo.push({
                        chain,
                        symbol: chain,
                        address: data.address,
                        imageUrl: data.imageUrl,
                        balance: 0,
                        price: null,
                        change24h: null,
                        usdValue: null
                    });
                    mockWallets[chain] = data;
                });

                if (initialInfo.length > 0) {

                    setWalletInfo(initialInfo);
                    // Crucial: Use the constructed mockWallets for immediate balance fetching
                    fetchBalances(mockWallets as RawWallets);
                }



            } catch (err: any) {
                console.error('[Web3Wallets] Initialization CRITICAL error:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [username]);

    // ── Unlock Wallet with Keychain Signature ────────────────────────────────
    const handleUnlock = async (targetChain?: string) => {
        const encrypted = mnemonicStorage.getEncrypted(username);
        const salt = mnemonicStorage.getSalt(username);
        if (!encrypted || !salt) throw new Error('No encrypted wallet found');

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        try {
            const signature = await authService.signMessage(
                username,
                UNLOCK_MESSAGE,
                'Posting',
                ({ qr }) => {
                    setAuthQR(qr);
                    if (isMobile) window.location.href = qr;
                }
            );

            if (signature.success && signature.result) {
                const mnemonic = await decryptMnemonic(encrypted, salt, signature.result);
                const result = await deriveAndFetch(mnemonic, targetChain);
                setAuthQR(null);
                return result;
            } else {
                throw new Error(signature.error || 'Signature failed. If you reset your keys, you may need to "Import Existing Phrase" to re-authorize this device.');
            }
        } catch (err: any) {
            setAuthQR(null);
            throw err;
        }
    };

    // ── Generate a brand-new wallet ───────────────────────────────────────────
    const handleGenerate = async () => {
        const hasExisting = walletInfo.length > 0;

        const confirmed = await showConfirm(
            hasExisting ? 'Overwrite Existing Hive-Linked Wallets?' : 'Generate New Web3 Wallet',
            hasExisting
                ? 'We found existing multi-chain addresses linked to your Hive profile. Generating a NEW wallet will REPLACE those links on Hive. If you still have your phrase for the existing addresses, use the "Import" option instead. Continue generating new?'
                : 'This will create a new BIP-39 backup phrase for BTC, ETH, SOL and more. Your wallet will be encrypted using your Hive identity. Continue?'
        );
        if (!confirmed) return;

        setGenerating(true);
        try {
            const mnemonic = await web3WalletService.generateMnemonic();
            setPendingMnemonic(mnemonic);
        } catch (err: any) {
            showNotification(`Wallet generation failed: ${err.message}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleImport = () => {

        setShowImport(true);
    };

    const onImportPhrase = async (phrase: string) => {
        const cleanPhrase = phrase.trim();
        try {
            const derived = await web3WalletService.deriveAddresses(cleanPhrase);
            let shouldUpdateHive = true;

            // Validate against existing Hive metadata if present
            if (walletInfo.length > 0) {
                const hiveEth = walletInfo.find(w => w.chain === 'ETH')?.address;
                const derivedEth = derived['ETH']?.address;

                if (hiveEth && derivedEth) {
                    if (hiveEth.toLowerCase() === derivedEth.toLowerCase()) {
                        // Perfect match, no need to update Hive
                        shouldUpdateHive = false;
                    } else {
                        const proceed = await showConfirm(
                            'Mnemonic Mismatch',
                            'The phrase you entered generates DIFFERENT addresses than the one linked to your Hive profile. If you proceed, you will over-write your Hive profile. Continue?'
                        );
                        if (!proceed) return;
                    }
                }
            }

            await finalizeVault(cleanPhrase, shouldUpdateHive);
            setShowImport(false);
        } catch (err: any) {
            showNotification(`Import failed: ${err.message}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    // ── Finalize Vault (shared by Generate & Import) ──────────────────────────
    const finalizeVault = async (mnemonic: string, updateHive: boolean) => {
        setGenerating(true);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        try {
            const signature = await authService.signMessage(
                username,
                UNLOCK_MESSAGE,
                'Posting',
                ({ qr }) => {
                    setAuthQR(qr);
                    if (isMobile) window.location.href = qr;
                }
            );

            if (!signature.success || !signature.result) {
                throw new Error(signature.error || 'Signature required to secure wallet');
            }

            const { encrypted, salt } = await encryptMnemonic(mnemonic, signature.result);
            mnemonicStorage.set(username, encrypted, salt);

            const derived = await web3WalletService.deriveAddresses(mnemonic);

            // Update local public address cache
            const publicCache: any = {};
            Object.entries(derived).forEach(([chain, data]) => {
                if (chain !== 'mnemonic') {
                    publicCache[chain] = { address: (data as any).address, imageUrl: (data as any).imageUrl };
                }
            });
            addressStorage.set(username, publicCache);

            if (updateHive) {
                const tokens = buildHiveWalletTokens(derived);
                await updateHiveMetadata(username, tokens);
            }

            setRawWallets(derived);
            fetchBalances(derived);
            setPendingMnemonic(null);
            setAuthQR(null);
            showNotification(updateHive ? 'Web3 Wallet initialized and linked!' : 'Local access secured!', 'success');
        } catch (err: any) {
            setAuthQR(null);
            showNotification(err.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    // ── Finalize Generation after Backup ──────────────────────────────────────
    const finalizeGeneration = () => {
        if (!pendingMnemonic) return;
        finalizeVault(pendingMnemonic, true).catch(err => {
            showNotification(err.message, 'error');
        });
    };

    // ── Clear / reset wallet ──────────────────────────────────────────────────
    const handleReset = async () => {
        const confirmed = await showConfirm(
            'Remove Web3 Wallet',
            'This will remove your locally stored encrypted phrase. You will NOT be able to access these wallets unless you have your 12-word recovery phrase. Continue?'
        );
        if (!confirmed) return;
        mnemonicStorage.clear(username);
        addressStorage.clear(username);
        setRawWallets(null);
        setWalletInfo([]);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Loading state
    // ─────────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-44 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]" />
                ))}
            </div>
        );
    }


    // ─────────────────────────────────────────────────────────────────────────
    // Mnemonic Modal (One-time)
    // ─────────────────────────────────────────────────────────────────────────
    if (pendingMnemonic) {
        return <MnemonicModal mnemonic={pendingMnemonic} username={username} onConfirm={finalizeGeneration} />;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // No wallet → CTA
    // ─────────────────────────────────────────────────────────────────────────
    if (!rawWallets && walletInfo.length === 0) {
        if (!isOwner) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-6 animate-in fade-in duration-700">
                    <div className="w-20 h-20 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-4xl shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/[0.02]" />
                        🔗
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-[var(--text-primary)] mb-2 tracking-tight">No Web3 Wallet Found</h3>
                        <p className="text-sm text-[var(--text-secondary)] max-w-xs opacity-70">
                            This account hasn't linked any multi-chain addresses yet.
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-3xl shadow-sm">
                    🔑
                </div>
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Web3 Wallet Found</h3>
                    <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                        Generate a secure, non-custodial wallet for BTC, ETH, SOL, TRON, BNB, APTOS, Base, Polygon and Arbitrum linked to your Hive account.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="px-8 py-3.5 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[var(--primary-color)]/25 disabled:opacity-60"
                    >
                        {generating ? 'Generating…' : 'Initialize New Wallet'}
                    </button>
                    <button
                        onClick={handleImport}
                        className="px-8 py-3.5 bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-2xl hover:bg-[var(--bg-card)] transition-all"
                    >
                        Import Existing Phrase
                    </button>
                </div>

                {showImport && (
                    <ImportModal
                        onClose={() => setShowImport(false)}
                        onImport={onImportPhrase}
                    />
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Merge remote Hive metadata + fetched info
    // ─────────────────────────────────────────────────────────────────────────
    const CHAIN_ORDER = ['BTC', 'ETH', 'SOL', 'TRON', 'BNB', 'APTOS', 'BASE', 'POLYGON', 'ARBITRUM', 'USDT_TRC20', 'USDT_BEP20', 'USDT_ERC20'];

    const mergedCards = CHAIN_ORDER.map(chain => {
        const raw = rawWallets ? (rawWallets[chain] as any) : null;
        const info = walletInfo.find(w => w.chain === chain);
        return {
            chain,
            address: raw?.address || info?.address || '',
            imageUrl: raw?.imageUrl || info?.imageUrl || '',
            balance: info?.balance ?? null,
            usdValue: info?.usdValue ?? null,
            price: info?.price ?? null,
            change24h: info?.change24h ?? null
        };
    }).filter(c => c.address);

    const totalUsd = walletInfo.reduce((sum, w: any) => sum + (w.usdValue || 0), 0);

    return (
        <div className="space-y-8">
            {/* Portfolio Header */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] scale-150 rotate-12 pointer-events-none text-9xl">🔗</div>

                <div className="relative z-10 w-full md:w-auto text-center md:text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">Multi-Chain Portfolio</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                        <span className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
                            {loadingInfo ? (
                                <span className="inline-block w-32 h-10 bg-[var(--bg-canvas)] rounded-xl animate-pulse" />
                            ) : (
                                `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            )}
                        </span>
                        <span className="text-sm font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md">USD</span>
                    </div>
                </div>

                {isOwner && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleReset}
                            className="flex-1 md:flex-none px-6 py-3 text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/5 transition-colors border border-red-500/20 rounded-xl"
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-[var(--border-color)]">
                <button
                    onClick={() => setActiveMainTab('assets')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeMainTab === 'assets' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    Assets
                    {activeMainTab === 'assets' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-color)] rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveMainTab('history')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeMainTab === 'history' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    History
                    {activeMainTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-color)] rounded-full" />}
                </button>
            </div>

            {activeMainTab === 'assets' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {mergedCards.map((card: any) => {
                        const accent = CHAIN_ACCENT[card.chain] || 'var(--primary-color)';
                        const isUnlocked = !!(rawWallets || unlockedChains[card.chain]);
                        return (
                            <div
                                key={card.chain}
                                className="group relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[32px] p-6 hover:shadow-2xl hover:shadow-[var(--primary-color)]/5 transition-all duration-500 hover:-translate-y-1 overflow-hidden flex flex-col gap-4"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-white/[0.03] -mr-8 -mt-8 rounded-full" />

                                {/* Top: Icon + Chain */}
                                <div className="flex items-center justify-between z-10">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner relative"
                                            style={{ backgroundColor: `${accent}15` }}
                                        >
                                            <div className="absolute inset-0 rounded-xl border border-white/5" />
                                            {card.imageUrl ? (
                                                <img src={card.imageUrl} alt={card.chain} className="w-6 h-6 object-contain" />
                                            ) : (
                                                <span className="font-bold text-xs" style={{ color: accent }}>{card.chain[0]}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[var(--text-primary)] leading-tight">{card.chain}</h4>
                                            <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-tighter opacity-70">Mainnet</p>
                                        </div>
                                    </div>
                                    {card.change24h !== null && (
                                        <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${card.change24h >= 0 ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                            {card.change24h >= 0 ? '↑' : '↓'} {Math.abs(card.change24h).toFixed(2)}%
                                        </div>
                                    )}
                                    {!isUnlocked && isOwner && (
                                        <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                            Locked
                                        </div>
                                    )}
                                    {isUnlocked && (
                                        <div className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                            </svg>
                                            Unlocked
                                        </div>
                                    )}
                                </div>

                                {/* Balance Info */}
                                <div className="py-2 z-10">
                                    <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                                        {loadingInfo ? (
                                            <div className="h-8 w-24 bg-[var(--bg-canvas)] rounded-lg animate-pulse" />
                                        ) : card.balance !== null ? (
                                            `${card.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                                        ) : (
                                            <span className="opacity-20">—</span>
                                        )}
                                        <span className="text-xs font-bold text-[var(--text-secondary)] ml-2 opacity-50">{card.chain}</span>
                                    </div>
                                    {!loadingInfo && card.usdValue !== null && (
                                        <p className="text-xs font-bold text-[var(--text-secondary)] mt-1 opacity-70">
                                            ≈ ${card.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    )}
                                </div>

                                {/* Address Display */}
                                <div
                                    onClick={() => {
                                        navigator.clipboard.writeText(card.address);
                                        showNotification(`${card.chain} address copied!`, 'success');
                                    }}
                                    className="bg-[var(--bg-canvas)]/50 border border-[var(--border-color)] rounded-2xl p-3 flex items-center gap-2 group/addr z-10 cursor-pointer hover:bg-[var(--bg-card)] transition-all"
                                >
                                    <code className="text-[10px] font-mono font-bold text-[var(--text-secondary)] flex-1 truncate opacity-80 group-hover/addr:opacity-100 transition-opacity">
                                        {card.address}
                                    </code>
                                    <div className="flex gap-1">
                                        <CopyButton text={card.address} size="sm" />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setQrTarget(card as any);
                                            }}
                                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all active:scale-90"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 z-10 mt-auto">
                                    {isOwner && (
                                        <>
                                            <button
                                                onClick={() => setSendTarget(card as any)}
                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] transition-all group/btn ${!isUnlocked ? 'opacity-50 grayscale' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]'}`}
                                            >
                                                Send
                                            </button>
                                            {['ETH', 'BNB', 'BASE', 'POLYGON', 'ARBITRUM', 'USDT_BEP20'].includes(card.chain) && (
                                                <button
                                                    disabled
                                                    className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-secondary)] opacity-30 cursor-not-allowed flex items-center justify-center gap-1.5"
                                                >
                                                    Swap
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button
                                        onClick={() => setQrTarget(card as any)}
                                        className={`${isOwner ? 'w-full' : 'w-full'} py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--primary-color)] hover:text-white transition-all`}
                                    >
                                        Receive
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Web3ActivityFeed username={username} />
                </div>
            )}

            {/* QR Modal */}
            {qrTarget && (
                <QRModal
                    address={qrTarget.address}
                    chain={qrTarget.chain}
                    imageUrl={qrTarget.imageUrl}
                    onClose={() => setQrTarget(null)}
                />
            )}

            {/* Swap Modal */}
            {swapTarget && (
                <SwapModal
                    initialFromAsset={swapTarget as any}
                    rawWallets={rawWallets}
                    onClose={() => setSwapTarget(null)}
                    onSuccess={(hash) => {
                        showNotification(`Swap initiated! Hash: ${hash}`, 'success');
                        fetchBalances(rawWallets!);
                    }}
                />
            )}

            {/* Send Modal */}
            {sendTarget && (
                <SendModal
                    username={username}
                    chain={sendTarget.chain}
                    address={sendTarget.address}
                    imageUrl={sendTarget.imageUrl}
                    privateKey={rawWallets ? (rawWallets[sendTarget.chain] as any)?.privateKey : unlockedChains[sendTarget.chain]?.privateKey}
                    balance={sendTarget.balance || 0}
                    onUnlock={() => handleUnlock(sendTarget.chain)}
                    onClose={() => setSendTarget(null)}
                    onSuccess={(amt, hash) => {
                        fetchBalances(rawWallets!);
                        const shortHash = hash.slice(0, 8) + '...' + hash.slice(-4);
                        NotificationService.addLocalNotification(
                            username,
                            `Sent: -${Number(amt).toFixed(6)} ${sendTarget.chain} (Hash: ${shortHash})`,
                            'send',
                            'wallet',
                            hash,
                            sendTarget.chain
                        );
                    }}
                />
            )}

            {/* HiveAuth QR Overlay */}
            {authQR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Sign with Keychain</h3>
                            <p className="text-xs text-[var(--text-secondary)]">Please scan or click the QR code to authorize with your Keychain mobile app.</p>
                        </div>
                        <div className="flex justify-center p-4 bg-white rounded-2xl mx-auto w-fit">
                            <QRCodeSVG value={authQR} size={200} />
                        </div>
                        <button
                            onClick={() => setAuthQR(null)}
                            className="w-full py-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
