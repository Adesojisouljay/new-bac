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
import { socketService } from '../../../services/socketService';

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
    DOGE: '#ba9f33',
    LTC: '#345d9d',
    SOL_USDT: '#26a17b',
    USDT_TRC20: '#26a17b',
    USDT_BEP20: '#26a17b',
    USDT_ERC20: '#26a17b',
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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [authQR, setAuthQR] = useState<string | null>(null);
    const [activeUser, setActiveUser] = useState<string | null>(localStorage.getItem('hive_user'));
    const normalizedActiveUser = activeUser?.replace(/^@/, '').toLowerCase();
    const isOwner = normalizedActiveUser === username.replace(/^@/, '').toLowerCase();
    const previousBalancesRef = useRef<Record<string, number>>({});
    const [needsSync, setNeedsSync] = useState(false);

    const checkSync = useCallback(async (derived: RawWallets) => {
        const cleanUsername = username.replace(/^@/, '').toLowerCase();
        const activeClean = localStorage.getItem('hive_user')?.replace(/^@/, '').toLowerCase();
        const isCurrentlyOwner = activeClean === cleanUsername;

        console.log(`[checkSync] isOwner: ${isCurrentlyOwner}, Username: ${cleanUsername}, Active: ${activeClean}`);

        if (!isCurrentlyOwner) return;
        try {
            const hiveTokens = await fetchHiveMetadata(username);
            const derivedTokens = buildHiveWalletTokens(derived);

            // Detect missing tokens or mismatched addresses
            const mismatch = derivedTokens.some(dt => {
                if (dt.type !== 'CHAIN' || !dt.meta.address) return false;
                const ht = hiveTokens.find(t => t.symbol === dt.symbol);
                return !ht || ht.meta.address !== dt.meta.address;
            });

            if (mismatch) {
                console.log('[Web3Wallets] Hive metadata mismatch detected. Sync recommended.');
                setNeedsSync(true);
                showNotification('New tokens found in your wallet! Please click "Sync to Hive" to link them to your profile.', 'info');
            } else {
                console.log('[Web3Wallets] Hive metadata is up to date.');
                setNeedsSync(false);
            }
        } catch (err) {
            console.error('[Web3Wallets] Sync check failed:', err);
        }
    }, [username, showNotification]);

    // Listen for auth changes to update isOwner reactively
    useEffect(() => {
        const handleAuthChange = () => {
            setActiveUser(localStorage.getItem('hive_user'));
        };
        window.addEventListener('bac-auth-change', handleAuthChange);
        window.addEventListener('storage', handleAuthChange);
        return () => {
            window.removeEventListener('bac-auth-change', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
        };
    }, []);

    const fetchBalances = useCallback(async (wallets: RawWallets, isSilent = false) => {
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
    }, [showNotification, username]);

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

            // Check if Hive metadata needs sync
            await checkSync(derived);

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
    }, [showNotification, username, fetchBalances]);

    // ── Webhook Socket Listener for Background Deposits ──────────────────────
    useEffect(() => {
        if (!username || walletInfo.length === 0) return;

        const handleWeb3Deposit = (data: any) => {
            console.log('[Socket] Web3 Deposit Notification:', data);

            // Trigger a silent refresh to update UI with latest balances
            // We reconstruct the mock wallets structure for fetchBalances
            const currentWallets: any = { mnemonic: '' };
            walletInfo.forEach(w => {
                currentWallets[w.chain] = { address: w.address, imageUrl: w.imageUrl };
            });

            fetchBalances(currentWallets as RawWallets, true); // Silent refresh
        };

        socketService.on('web3_deposit', handleWeb3Deposit);
        return () => socketService.off('web3_deposit', handleWeb3Deposit);
    }, [username, walletInfo, fetchBalances]);

    // ── Polling Fallback for Unsupported Webhook Chains (TRON) ────────────────
    useEffect(() => {
        if (walletInfo.length === 0) return;

        const needsPolling = walletInfo.some(w => ['TRON', 'USDT_TRC20'].includes(w.chain));
        if (!needsPolling) return;

        const pollId = setInterval(() => {
            const currentWallets: any = { mnemonic: '' };
            walletInfo.forEach(w => {
                currentWallets[w.chain] = { address: w.address, imageUrl: w.imageUrl };
            });
            fetchBalances(currentWallets as RawWallets, true); // Silent refresh
        }, 120000); // Poll every 2 minutes for Tron

        return () => clearInterval(pollId);
    }, [walletInfo, username, fetchBalances]);

    // ── Load state on mount ──────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            console.log(`[Web3Wallets] Initializing for ${username}...`);
            setLoading(true);
            try {
                // 1. Check for persistent signature (Auto-Unlock)
                const storedSignature = web3WalletService.signatureStorage.get(username);
                const encryptedMnemonic = mnemonicStorage.getEncrypted(username);
                const salt = mnemonicStorage.getSalt(username);

                console.log(`[Web3Wallets] Storage check - Signature: ${!!storedSignature}, Encrypted: ${!!encryptedMnemonic}, Salt: ${!!salt}`);

                if (storedSignature && encryptedMnemonic && salt) {
                    try {
                        console.log('[Web3Wallets] Attempting Auto-Unlock...');
                        const mnemonic = await decryptMnemonic(encryptedMnemonic, salt, storedSignature);
                        const derived = await web3WalletService.deriveAddresses(mnemonic);
                        console.log('[Web3Wallets] Auto-Unlock successful!');
                        setRawWallets(derived);
                        fetchBalances(derived);
                        checkSync(derived);
                        setLoading(false);
                        return; // Auto-unlocked!
                    } catch (e) {
                        console.warn('[AutoUnlock] Decryption failed or error during derivation:', e);
                        // Optional: Clear signature if decryption specifically fails (likely invalid signature)
                        // web3WalletService.signatureStorage.clear(username);
                    }
                }

                // 2. Fallback to View-Only mode
                console.log('[Web3Wallets] Falling back to View-Only mode');
                const tokens = await fetchHiveMetadata(username);
                const cachedAddresses = addressStorage.get(username);
                const combinedWallets: Record<string, { address: string; imageUrl: string }> = {};

                tokens.filter(t => t.type === 'CHAIN').forEach(t => {
                    if (t.symbol && t.meta.address) {
                        combinedWallets[t.symbol] = {
                            address: t.meta.address,
                            imageUrl: t.meta.imageUrl || ''
                        };
                    }
                });

                if (cachedAddresses) {
                    Object.entries(cachedAddresses).forEach(([chain, data]) => {
                        combinedWallets[chain] = data;
                    });
                }

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

                setWalletInfo(initialInfo);
                if (initialInfo.length > 0) {
                    fetchBalances(mockWallets as RawWallets, true); // Silent refresh
                }
            } catch (err) {
                console.error('[Web3Wallets] Initialization error:', err);
            } finally {
                setLoading(false);
            }
        };

        if (username) init();
    }, [username, fetchBalances, checkSync]);

    // ── Unlock Wallet with Keychain Signature ────────────────────────────────
    const handleUnlock = async (targetChain?: string) => {
        const encrypted = mnemonicStorage.getEncrypted(username);
        const salt = mnemonicStorage.getSalt(username);

        if (!encrypted || !salt) {
            // Fallback to import if phrase is missing
            setShowImport(true);
            showNotification('No encrypted recovery phrase found on this device. Please import your phrase to continue.', 'info');
            return;
        }

        const cleanUsername = username.replace(/^@/, '').toLowerCase();
        const activeClean = activeUser?.replace(/^@/, '').toLowerCase();

        // Safety check: Don't sign for someone else
        if (cleanUsername !== activeClean) {
            throw new Error(`Cannot unlock wallet: Active user is @${activeClean}, but this wallet belongs to @${cleanUsername}. Please switch accounts.`);
        }

        try {
            const signature = await authService.signMessage(
                cleanUsername,
                UNLOCK_MESSAGE,
                'Posting',
                ({ qr }) => {
                    setAuthQR(qr);
                    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                    if (mobile) window.location.href = qr;
                }
            );

            if (signature.success && signature.result) {
                // Save signature for persistence
                web3WalletService.signatureStorage.set(username, signature.result);

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
                : 'This will create a new Web3 backup phrase for BTC, ETH, SOL and more. Your wallet will be encrypted using your Hive identity and linked to your Hive account. Continue?'
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

        try {
            const cleanUsername = username.replace(/^@/, '').toLowerCase();
            const signatureRes = await authService.signMessage(
                cleanUsername,
                UNLOCK_MESSAGE,
                'Posting',
                ({ qr }) => {
                    setAuthQR(qr);
                    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                    if (mobile) window.location.href = qr;
                }
            );

            if (!signatureRes.success || !signatureRes.result) {
                throw new Error(signatureRes.error || 'Signature required to secure wallet');
            }

            // Save signature for persistence
            web3WalletService.signatureStorage.set(username, signatureRes.result);

            const { encrypted, salt } = await encryptMnemonic(mnemonic, signatureRes.result);
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
            'Revoke Keychain Access?',
            'You are about to revoke Keychain access for this wallet. To grant access again in the future, you will need to provide your 12-word recovery phrase. Continue?'
        );
        if (!confirmed) return;
        mnemonicStorage.clear(username);
        addressStorage.clear(username);
        web3WalletService.signatureStorage.clear(username);
        setRawWallets(null);
        setWalletInfo([]);
        setNeedsSync(false);
    };

    const handleSync = async () => {
        if (!rawWallets) return;
        setGenerating(true);
        try {
            const tokens = buildHiveWalletTokens(rawWallets);
            await updateHiveMetadata(username, tokens);
            setNeedsSync(false);
            showNotification('Hive metadata synced successfully!', 'success');
        } catch (err: any) {
            showNotification(err.message || 'Sync failed', 'error');
        } finally {
            setGenerating(false);
        }
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
        return <MnemonicModal
            mnemonic={pendingMnemonic}
            username={username}
            onConfirm={finalizeGeneration}
            onClose={() => setPendingMnemonic(null)}
        />;
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
    const CHAIN_ORDER = ['BTC', 'ETH', 'SOL', 'SOL_USDT', 'TRON', 'BNB', 'DOGE', 'LTC', 'APTOS', 'BASE', 'POLYGON', 'ARBITRUM', 'USDT_TRC20', 'USDT_BEP20', 'USDT_ERC20'];

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
                        {/* 1. VIEW-ONLY fallback: Secret phrase missing from this device - Only show Enable Access */}
                        {!mnemonicStorage.getEncrypted(username) && walletInfo.length > 0 && (
                            <button
                                onClick={() => setShowImport(true)}
                                className="flex-1 md:flex-none px-6 py-3 text-xs font-bold uppercase tracking-widest bg-[var(--primary-color)] text-white hover:brightness-110 transition-all rounded-xl shadow-lg shadow-[var(--primary-color)]/20 flex items-center gap-2"
                                title="Import your phrase to enable sending/signing"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Enable Full Access
                            </button>
                        )}

                        {/* 2. Phrase Present: Show Unlock (if locked) OR Remove (if unlocked) */}
                        {mnemonicStorage.getEncrypted(username) && isOwner && (
                            <>
                                {!rawWallets ? (
                                    <button
                                        onClick={() => handleUnlock()}
                                        className="flex-1 md:flex-none px-6 py-3 text-xs font-bold uppercase tracking-widest bg-[var(--primary-color)] text-white hover:brightness-110 active:scale-95 transition-all rounded-xl shadow-lg shadow-[var(--primary-color)]/20 flex items-center gap-2"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        Grant Keychain Access
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {needsSync && (
                                            <button
                                                onClick={handleSync}
                                                disabled={generating}
                                                className="px-6 py-3 text-xs font-bold uppercase tracking-widest bg-amber-500 text-white hover:brightness-110 active:scale-95 transition-all rounded-xl shadow-lg shadow-amber-500/20 animate-pulse flex items-center gap-2"
                                                title="New tokens found! Click to sync your Hive profile metadata"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Sync to Hive
                                            </button>
                                        )}
                                        <button
                                            onClick={handleReset}
                                            className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/5 transition-colors border border-red-500/20 rounded-xl"
                                        >
                                            Revoke Keychain Access
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Tab Navigation & View Toggle */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)]">
                <div className="flex gap-4">
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

                {activeMainTab === 'assets' && (
                    <div className="flex bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg p-1 mb-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-[var(--bg-card)] text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            title="Grid View"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-[var(--bg-card)] text-[var(--primary-color)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            title="List View"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                )}
            </div>

            {
                activeMainTab === 'assets' ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500" : "flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"}>
                        {mergedCards.map((card: any) => {
                            const accent = CHAIN_ACCENT[card.chain] || 'var(--primary-color)';
                            const isUnlocked = !!(rawWallets || unlockedChains[card.chain]);

                            if (viewMode === 'list') {
                                return (
                                    <div
                                        key={card.chain}
                                        className="group relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 hover:bg-[var(--bg-canvas)] transition-all duration-300 flex flex-col md:flex-row items-center gap-4 overflow-hidden shadow-sm hover:shadow-md"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-white/[0.03] -mr-8 -mt-8 rounded-full pointer-events-none" />

                                        <div className="flex items-center gap-4 w-full md:w-56 shrink-0 z-10">
                                            <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shadow-inner relative shrink-0" style={{ backgroundColor: `${accent}15` }}>
                                                <div className="absolute inset-0 rounded-[14px] border border-white/5" />
                                                {card.imageUrl ? <img src={card.imageUrl} alt={card.chain} className="w-7 h-7 object-contain" /> : <span className="font-bold text-sm" style={{ color: accent }}>{card.chain[0]}</span>}

                                                {/* Mini status dot */}
                                                <div className="absolute -bottom-1 -right-1">
                                                    {!isUnlocked && isOwner && <div className="w-3.5 h-3.5 rounded-full bg-[var(--bg-card)] flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-amber-500" title="Locked" /></div>}
                                                    {isUnlocked && <div className="w-3.5 h-3.5 rounded-full bg-[var(--bg-card)] flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-green-500" title="Unlocked" /></div>}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-[var(--text-primary)] text-sm md:text-base leading-tight truncate">{card.chain}</h4>
                                                <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-tighter opacity-70 truncate">
                                                    {card.address ? `${card.address.slice(0, 6)}...${card.address.slice(-4)}` : 'Mainnet'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full flex flex-col justify-center z-10 md:pl-4">
                                            <div className="text-lg md:text-xl font-black text-[var(--text-primary)] tracking-tight">
                                                {loadingInfo ? <div className="h-6 w-24 bg-[var(--bg-canvas)] rounded-lg animate-pulse" /> : card.balance !== null ? `${card.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : <span className="opacity-20">—</span>}
                                            </div>
                                            {!loadingInfo && card.usdValue !== null && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs font-bold text-[var(--text-secondary)] opacity-70">≈ ${card.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                    {card.change24h !== null && (
                                                        <span className={`text-[10px] font-black ${card.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {card.change24h >= 0 ? '↑' : '↓'} {Math.abs(card.change24h).toFixed(2)}%
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-row gap-2 shrink-0 z-10 w-full md:w-auto h-full items-center justify-end border-t md:border-t-0 border-[var(--border-color)] pt-3 md:pt-0">
                                            {isOwner && (
                                                <button
                                                    onClick={() => {
                                                        if (!mnemonicStorage.getEncrypted(username)) {
                                                            setShowImport(true);
                                                            showNotification('Recovery phrase not found. Please import it to enable sending.', 'warning');
                                                            return;
                                                        }
                                                        setSendTarget(card as any);
                                                    }}
                                                    className={`px-5 py-2 h-9 text-xs font-black uppercase tracking-widest rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] transition-all ${!isUnlocked ? 'opacity-50 grayscale' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]'}`}
                                                >
                                                    Send
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setQrTarget(card as any)}
                                                className="px-5 py-2 h-9 text-xs font-black uppercase tracking-widest rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--primary-color)] hover:text-white transition-all"
                                            >
                                                Receive
                                            </button>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(card.address);
                                                    showNotification(`${card.chain} address copied!`, 'success');
                                                }}
                                                className="p-2 h-9 w-9 flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-card)] rounded-xl text-[var(--text-secondary)] transition-all tooltip-trigger"
                                                title="Copy Address"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            // Grid View Fallback
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
                                                    onClick={() => {
                                                        if (!mnemonicStorage.getEncrypted(username)) {
                                                            setShowImport(true);
                                                            showNotification('Recovery phrase not found. Please import it to enable sending.', 'warning');
                                                            return;
                                                        }
                                                        setSendTarget(card as any);
                                                    }}
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
                )
            }

            {/* QR Modal */}
            {
                qrTarget && (
                    <QRModal
                        address={qrTarget.address}
                        chain={qrTarget.chain}
                        imageUrl={qrTarget.imageUrl}
                        onClose={() => setQrTarget(null)}
                    />
                )
            }

            {/* Swap Modal */}
            {
                swapTarget && (
                    <SwapModal
                        initialFromAsset={swapTarget as any}
                        rawWallets={rawWallets}
                        onClose={() => setSwapTarget(null)}
                        onSuccess={(hash) => {
                            showNotification(`Swap initiated! Hash: ${hash}`, 'success');
                            fetchBalances(rawWallets!);
                        }}
                    />
                )
            }

            {/* Send Modal */}
            {
                sendTarget && (
                    <SendModal
                        username={username}
                        chain={sendTarget.chain}
                        address={sendTarget.address}
                        imageUrl={sendTarget.imageUrl}
                        privateKey={rawWallets ? (rawWallets[sendTarget.chain] as any)?.privateKey : unlockedChains[sendTarget.chain]?.privateKey}
                        balance={sendTarget.balance || 0}
                        allWallets={walletInfo}
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
                )
            }

            {/* HiveAuth QR Overlay */}
            {
                authQR && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Sign with Keychain</h3>
                                <p className="text-xs text-[var(--text-secondary)]">Please scan or click the QR code to authorize with your Keychain mobile app.</p>
                            </div>
                            <div className="flex justify-center p-4 bg-white rounded-2xl mx-auto w-fit">
                                <QRCodeSVG value={authQR} size={200} />
                            </div>

                            {/* Mobile Deep Link Shortcut */}
                            <button
                                onClick={() => {
                                    window.location.href = authQR;
                                }}
                                className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl flex items-center justify-center gap-2 md:hidden"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open in Wallet App
                            </button>

                            <button
                                onClick={() => setAuthQR(null)}
                                className="w-full py-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )
            }
            {
                showImport && (
                    <ImportModal
                        onClose={() => setShowImport(false)}
                        onImport={onImportPhrase}
                    />
                )
            }
        </div >
    );
}
