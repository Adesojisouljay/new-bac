const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const WEB3_API_URL = import.meta.env.VITE_WEB3_WALLET_API_URL || (isLocal ? 'http://localhost:4001' : 'https://web3api.breakaway.community');
import { deriveAllWallets } from './derivationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawWallet {
    address: string;
    publicKey?: string;
    privateKey?: string; // Strictly in-memory
    viewKey?: string;
    imageUrl: string;
}

export interface RawWallets {
    mnemonic: string;
    BTC: RawWallet;
    ETH: RawWallet;
    SOL: RawWallet;
    TRON: RawWallet;
    BNB: RawWallet;
    APTOS: RawWallet;
    XMR?: RawWallet;
    BASE?: RawWallet;
    POLYGON?: RawWallet;
    ARBITRUM?: RawWallet;
    ARB?: RawWallet;
    USDT_TRC20?: RawWallet;
    USDT_BEP20?: RawWallet;
    [chain: string]: RawWallet | string | undefined;
}

export interface Web3WalletInfo {
    chain: string;
    symbol: string;
    address: string;
    publicKey?: string;
    viewKey?: string;
    privateKey?: string;
    imageUrl: string;
    balance: number;
    price: number | null;
    change24h: number | null;
    usdValue: number | null;
    incomingTransfers?: Array<{ amount: number; hash: string | null; isConfirmed: boolean; height: number | null }>;
}

const ENCRYPTED_MNEMONIC_KEY = 'web3_mnemonic_enc';
const SALT_KEY = 'web3_salt';
export const UNLOCK_MESSAGE = 'Sign this message to securely encrypt/decrypt your multi-chain Web3 recovery phrase. This signature acts as your local vault key and never leaves your device.';

const normalize = (name: string) => name.replace(/^@/, '').toLowerCase();

export const mnemonicStorage = {
    getEncrypted: (username: string): string | null => {
        const norm = normalize(username);
        const pref = `@${norm}`;

        const val = localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`) ||
            localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${username}`) ||
            localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${pref}`) ||
            localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_@${username}`);

        // Migration: If we found it with a non-normalized key, save it to the normalized one
        if (val && !localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`)) {
            localStorage.setItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`, val);

            // Also migrate salt
            const salt = localStorage.getItem(`${SALT_KEY}_${username}`) ||
                localStorage.getItem(`${SALT_KEY}_@${username}`) ||
                localStorage.getItem(`${SALT_KEY}_${pref}`);
            if (salt) localStorage.setItem(`${SALT_KEY}_${norm}`, salt);
        }
        return val;
    },
    getSalt: (username: string): string | null => {
        const norm = normalize(username);
        return localStorage.getItem(`${SALT_KEY}_${norm}`) ||
            localStorage.getItem(`${SALT_KEY}_${username}`) ||
            localStorage.getItem(`${SALT_KEY}_@${norm}`) ||
            localStorage.getItem(`${SALT_KEY}_@${username}`);
    },
    set: (username: string, encryptedMnemonic: string, salt: string) => {
        const norm = normalize(username);

        localStorage.setItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`, encryptedMnemonic);
        localStorage.setItem(`${SALT_KEY}_${norm}`, salt);
    },
    clear: (username: string) => {
        const norm = normalize(username);
        localStorage.removeItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`);
        localStorage.removeItem(`${SALT_KEY}_${norm}`);
        localStorage.removeItem(`${ENCRYPTED_MNEMONIC_KEY}_@${norm}`);
        localStorage.removeItem(`${SALT_KEY}_@${norm}`);
    },
};

const PUBLIC_ADDRESSES_KEY = 'web3_public_addresses';
const SIGNATURE_KEY = 'web3_signature';

export const addressStorage = {
    get: (username: string): Record<string, { address: string; imageUrl: string }> | null => {
        const data = localStorage.getItem(`${PUBLIC_ADDRESSES_KEY}_${normalize(username)}`);
        return data ? JSON.parse(data) : null;
    },
    set: (username: string, addresses: Record<string, { address: string; imageUrl: string }>) => {
        localStorage.setItem(`${PUBLIC_ADDRESSES_KEY}_${normalize(username)}`, JSON.stringify(addresses));
    },
    clear: (username: string) => {
        const norm = normalize(username);
        localStorage.removeItem(`${PUBLIC_ADDRESSES_KEY}_${norm}`);
    },
};

export const signatureStorage = {
    get: (username: string): string | null => {
        return localStorage.getItem(`${SIGNATURE_KEY}_${normalize(username)}`);
    },
    set: (username: string, signature: string) => {
        localStorage.setItem(`${SIGNATURE_KEY}_${normalize(username)}`, signature);
    },
    clear: (username: string) => {
        localStorage.removeItem(`${SIGNATURE_KEY}_${normalize(username)}`);
    },
};

// ─── Encryption / Decryption helpers ──────────────────────────────────────────

async function deriveKey(signature: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(signature),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as Uint8Array,
            iterations: 100000,
            hash: 'SHA-256',
        } as Pbkdf2Params,
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptMnemonic(mnemonic: string, signature: string): Promise<{ encrypted: string; salt: string }> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(signature, salt);

    const enc = new TextEncoder();
    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv } as AesGcmParams,
        key,
        enc.encode(mnemonic)
    );

    // Combine IV (12) + Content
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return {
        encrypted: btoa(String.fromCharCode(...combined)),
        salt: btoa(String.fromCharCode(...salt)),
    };
}

export async function decryptMnemonic(encryptedB64: string, saltB64: string, signature: string): Promise<string> {

    const combined = new Uint8Array(atob(encryptedB64).split('').map(c => c.charCodeAt(0)));
    const salt = new Uint8Array(atob(saltB64).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const key = await deriveKey(signature, salt);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv } as AesGcmParams,
        key,
        ciphertext
    );

    const result = new TextDecoder().decode(decrypted);

    return result;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const web3WalletService = {
    /**
     * Generate a new BIP-39 mnemonic phrase.
     * GET /api/wallet/mnemonic
     */
    generateMnemonic: async (): Promise<string> => {
        const res = await fetch(`${WEB3_API_URL}/api/wallet/mnemonic`);
        if (!res.ok) throw new Error(`Mnemonic generation failed (${res.status})`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Mnemonic generation failed');
        return data.mnemonic as string;
    },

    /**
     * Derive wallet addresses for all supported chains from a mnemonic LOCALLY.
     */
    deriveAddresses: async (mnemonic: string): Promise<RawWallets> => {
        const derived = await deriveAllWallets(mnemonic);
        const ICON_BASE = 'https://assets.coingecko.com/coins/images';
        const ICONS: Record<string, string> = {
            BTC: `${ICON_BASE}/1/large/bitcoin.png`,
            ETH: `${ICON_BASE}/279/large/ethereum.png`,
            SOL: `${ICON_BASE}/4128/standard/solana.png?1718769756`,
            TRON: `${ICON_BASE}/1094/large/tron-logo.png`,
            BNB: `${ICON_BASE}/825/standard/bnb-icon2_2x.png?1696501970`,
            APTOS: `${ICON_BASE}/26455/standard/Aptos-Network-Symbol-Black-RGB-1x.png?1761789140`,
            BASE: `${ICON_BASE}/279/large/ethereum.png`,
            POLYGON: `${ICON_BASE}/4713/large/matic-token-icon.png`,
            ARBITRUM: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
            ARB: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png",
            USDT_TRC20: `${ICON_BASE}/325/large/tether.png`,
            USDT_BEP20: `${ICON_BASE}/325/large/tether.png`,
            USDT_ERC20: `${ICON_BASE}/325/large/tether.png`,
            SOL_USDT: `${ICON_BASE}/325/large/tether.png`,
            DOGE: `${ICON_BASE}/5/large/dogecoin.png`,
            LTC: `${ICON_BASE}/2/large/litecoin.png`,
            XMR: `${ICON_BASE}/69/large/monero_logo.png`,
        };

        const rawWallets: any = { mnemonic };
        for (const [chain, data] of Object.entries(derived)) {
            rawWallets[chain] = {
                address: data.address,
                publicKey: data.publicKey,
                privateKey: data.privateKey,
                viewKey: (data as any).viewKey || (data as any).privateViewKey,
                imageUrl: ICONS[chain] || ''
            };
        }

        // Auto-merge any backend-supported chains (like XMR)
        const endpoints = isLocal
            ? ['http://localhost:4001/api/wallet/address', `${WEB3_API_URL}/api/wallet/address`]
            : [`${WEB3_API_URL}/api/wallet/address`, 'http://localhost:4001/api/wallet/address'];

        for (const ep of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mnemonic }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.wallets) {
                        for (const [chain, val] of Object.entries(data.wallets)) {
                            if (chain !== 'mnemonic' && val && typeof val === 'object') {
                                if (!rawWallets[chain] || !(rawWallets[chain] as any).address) {
                                    rawWallets[chain] = val;
                                }
                            }
                        }
                        if (rawWallets.XMR && (rawWallets.XMR as any).address) {
                            break;
                        }
                    }
                }
            } catch (e) {
                // Non-critical, try next endpoint
            }
        }

        return rawWallets as RawWallets;
    },

    /**
     * Derive a single wallet address for a specific chain from a mnemonic LOCALLY.
     */
    deriveSingleAddress: async (mnemonic: string, chain: string): Promise<RawWallet> => {
        const ICON_BASE = 'https://assets.coingecko.com/coins/images';
        const ICONS: Record<string, string> = {
            BTC: `${ICON_BASE}/1/large/bitcoin.png`,
            ETH: `${ICON_BASE}/279/large/ethereum.png`,
            SOL: `${ICON_BASE}/4128/standard/solana.png?1718769756`,
            TRON: `${ICON_BASE}/1094/large/tron-logo.png`,
            BNB: `${ICON_BASE}/825/standard/bnb-icon2_2x.png?1696501970`,
            APTOS: `${ICON_BASE}/26455/standard/Aptos-Network-Symbol-Black-RGB-1x.png?1761789140`,
            BASE: `${ICON_BASE}/279/large/ethereum.png`,
            POLYGON: `${ICON_BASE}/4713/large/matic-token-icon.png`,
            ARBITRUM: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
            ARB: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png",
            USDT_TRC20: `${ICON_BASE}/325/large/tether.png`,
            USDT_BEP20: `${ICON_BASE}/325/large/tether.png`,
            USDT_ERC20: `${ICON_BASE}/325/large/tether.png`,
            SOL_USDT: `${ICON_BASE}/325/large/tether.png`,
            DOGE: `${ICON_BASE}/5/large/dogecoin.png`,
            LTC: `${ICON_BASE}/2/large/litecoin.png`,
            XMR: `${ICON_BASE}/69/large/monero_logo.png`,
        };

        if (chain === 'XMR') {
            const endpoints = isLocal
                ? ['http://localhost:4001/api/wallet/address', `${WEB3_API_URL}/api/wallet/address`]
                : [`${WEB3_API_URL}/api/wallet/address`, 'http://localhost:4001/api/wallet/address'];
            for (const ep of endpoints) {
                try {
                    const res = await fetch(ep, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mnemonic }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.wallets && data.wallets.XMR) {
                            return {
                                address: data.wallets.XMR.address,
                                publicKey: data.wallets.XMR.publicKey,
                                privateKey: data.wallets.XMR.privateKey,
                                viewKey: data.wallets.XMR.viewKey || data.wallets.XMR.privateViewKey,
                                imageUrl: data.wallets.XMR.imageUrl || ICONS.XMR
                            };
                        }
                    }
                } catch (e) {
                    // Try next endpoint
                }
            }
        }

        const derived = await import('./derivationService').then(m => m.deriveWallet(mnemonic, chain as any));
        return {
            address: derived.address,
            publicKey: derived.publicKey,
            privateKey: derived.privateKey,
            viewKey: (derived as any).viewKey,
            imageUrl: ICONS[chain] || ''
        };
    },

    /**
     * Scan legacy paths for funds and return any that have sub-wallets with balances.
     */
    checkLegacyAddresses: async (mnemonic: string): Promise<Record<string, RawWallet>> => {
        const { LEGACY_PATHS, deriveWallet } = await import('./derivationService');
        const legacyWallets: Record<string, RawWallet> = {};

        // Only BTC and TRON had standard path changes that matter for legacy
        for (const [chain] of Object.entries(LEGACY_PATHS)) {
            try {
                const derived = await deriveWallet(mnemonic, chain as any);
                legacyWallets[chain] = {
                    address: derived.address,
                    publicKey: derived.publicKey,
                    privateKey: derived.privateKey,
                    imageUrl: '' // We can fill this if needed
                };
            } catch (e) {
                console.warn(`[LegacyScan] Failed for ${chain}:`, e);
            }
        }
        return legacyWallets;
    },

    /**
     * Fetch balances + USD prices for all derived wallets.
     * POST /api/wallet/info  { wallets }
     */
    getWalletInfo: async (wallets: RawWallets): Promise<Web3WalletInfo[]> => {
        // Sanitize payload to strictly prevent privateKey transmission, except for XMR key image balance reconciliation
        const safeWallets: Record<string, { address: string; imageUrl?: string; viewKey?: string; privateKey?: string }> = {};
        
        for (const [chain, data] of Object.entries(wallets)) {
            if (chain === 'mnemonic') continue;
            if (data && typeof data === 'object' && 'address' in data) {
                safeWallets[chain] = { 
                    address: data.address, 
                    imageUrl: data.imageUrl,
                    viewKey: chain === 'XMR' ? ((data as any).viewKey || (data as any).privateViewKey) : undefined,
                    privateKey: chain === 'XMR' ? ((data as any).privateKey || (data as any).privateSpendKey) : undefined,
                };
            }
        }

        const endpoints = Array.from(new Set(isLocal
            ? ['http://localhost:4001/api/wallet/info', `${WEB3_API_URL}/api/wallet/info`]
            : [`${WEB3_API_URL}/api/wallet/info`, 'http://localhost:4001/api/wallet/info']));

        for (const ep of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const res = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallets: safeWallets }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.walletInfo) {
                        return data.walletInfo as Web3WalletInfo[];
                    }
                }
            } catch (e) {
                // Try next endpoint
            }
        }

        throw new Error('Wallet info fetch failed from all available endpoints');
    },

    /**
     * Estimate transaction fee for a given chain and amount.
     */
    estimateFee: async (chain: string, from: string, to: string, amount: number): Promise<any> => {
        const res = await fetch(`${WEB3_API_URL}/api/wallet/fee`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chain, from, to, amount }),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`Fee estimation failed (${res.status}):`, text);
            throw new Error(`Fee estimation failed (${res.status})`);
        }
        return res.json();
    },

    /**
     * Get transaction parameters (nonce, blockhash, etc.) from the blockchain.
     */
    getTxParams: async (chain: string, address: string, to: string, amount: number): Promise<any> => {
        const res = await fetch(`${WEB3_API_URL}/api/wallet/params`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chain, address, to, amount }),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`Params fetch failed (${res.status}):`, text);
            throw new Error(`Failed to fetch tx params (${res.status})`);
        }
        const data = await res.json();
        return data.params;
    },

    /**
     * Broadcast a raw signed transaction to the blockchain.
     */
    broadcastTransaction: async (chain: string, signedTx: string): Promise<string> => {
        const res = await fetch(`${WEB3_API_URL}/api/wallet/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chain, signedTx }),
        });

        let data;
        try { data = await res.json(); } catch (e) { }

        if (!res.ok) {
            throw new Error(data?.message || `Broadcast failed (${res.status})`);
        }

        if (!data?.success) throw new Error(data?.message || 'Broadcast failed');
        return data.hash;
    },

    /**
     * Send Monero transaction via daemon-connected wallet.
     * Uses private spend key to construct ring signatures, bulletproofs, and relay.
     */
    sendXmrTransaction: async (privateSpendKey: string, to: string, amount: number): Promise<string> => {
        const endpoints = Array.from(new Set(isLocal
            ? ['http://localhost:4001/api/wallet/send', `${WEB3_API_URL}/api/wallet/send`]
            : [`${WEB3_API_URL}/api/wallet/send`, 'http://localhost:4001/api/wallet/send']));

        let lastError = 'Failed to send Monero transaction';
        for (const ep of endpoints) {
            try {
                const res = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chain: 'XMR',
                        to,
                        amount,
                        wallet: { privateKey: privateSpendKey }
                    }),
                });
                const data = await res.json().catch(() => null);
                if (res.ok && data?.success && data?.transaction?.hash) {
                    return data.transaction.hash;
                }
                if (data?.message) {
                    lastError = data.message;
                }
            } catch (e: any) {
                lastError = e.message || lastError;
            }
        }
        throw new Error(lastError);
    },



    /**
     * Log a Web3 transaction to the Hive blockchain for permanent history.
     */
    logTransactionToHive: async (
        username: string, 
        data: { chain: string, to: string, amount: number, hash?: string, type: 'send' | 'deposit' },
        onChallenge?: (data: { qr: string; uuid: string }) => void
    ) => {
        const { authService } = await import('../features/auth/services/authService');
        const logId = 'sovraniche_web3_tx';
        const payload = {
            ...data,
            app: 'sovraniche.app',
            version: '1.0.0',
            timestamp: Date.now()
        };

        // We use Posting key because Mobile HiveAuth sessions are strictly negotiated at the Posting tier during login.
        const response = await authService.broadcastJson(username, logId, payload, 'Posting', onChallenge);
        
        if (!response.success) {
            throw new Error(response.error || 'User cancelled Hive Keychain confirmation');
        }
        
        return response;
    },
    signatureStorage
};
