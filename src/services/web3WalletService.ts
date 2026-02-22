const WEB3_API_URL = import.meta.env.VITE_WEB3_WALLET_API_URL || 'http://localhost:4001';
import { deriveAllWallets } from './derivationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawWallet {
    address: string;
    publicKey?: string;
    privateKey?: string; // Strictly in-memory
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
    BASE?: RawWallet;
    POLYGON?: RawWallet;
    ARBITRUM?: RawWallet;
    USDT_TRC20?: RawWallet;
    USDT_BEP20?: RawWallet;
    [chain: string]: RawWallet | string | undefined;
}

export interface Web3WalletInfo {
    chain: string;
    symbol: string;
    address: string;
    publicKey?: string;
    imageUrl: string;
    balance: number;
    price: number;
    change24h: number;
    usdValue: number;
}

const ENCRYPTED_MNEMONIC_KEY = 'web3_mnemonic_enc';
const SALT_KEY = 'web3_salt';
export const UNLOCK_MESSAGE = 'Sign this message to securely encrypt/decrypt your multi-chain Web3 recovery phrase. This signature acts as your local vault key and never leaves your device.';

const normalize = (name: string) => name.replace(/^@/, '');

export const mnemonicStorage = {
    getEncrypted: (username: string): string | null => {
        const norm = normalize(username);
        const pref = `@${norm}`;
        const val = localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`) ||
            localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${pref}`);

        // Migration: If we found it with the prefixed key but not the normalized one, save it to the normalized one
        if (val && !localStorage.getItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`)) {
            console.log(`[Storage] Migrating encrypted mnemonic for ${norm}`);
            localStorage.setItem(`${ENCRYPTED_MNEMONIC_KEY}_${norm}`, val);
            const salt = localStorage.getItem(`${SALT_KEY}_${pref}`);
            if (salt) localStorage.setItem(`${SALT_KEY}_${norm}`, salt);
        }
        return val;
    },
    getSalt: (username: string): string | null => {
        const norm = normalize(username);
        return localStorage.getItem(`${SALT_KEY}_${norm}`) ||
            localStorage.getItem(`${SALT_KEY}_@${norm}`);
    },
    set: (username: string, encryptedMnemonic: string, salt: string) => {
        const norm = normalize(username);
        console.log(`[Storage] Saving keys for ${norm}`);
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

export const addressStorage = {
    get: (username: string): Record<string, { address: string; imageUrl: string }> | null => {
        const data = localStorage.getItem(`${PUBLIC_ADDRESSES_KEY}_${normalize(username)}`);
        return data ? JSON.parse(data) : null;
    },
    set: (username: string, addresses: Record<string, { address: string; imageUrl: string }>) => {
        localStorage.setItem(`${PUBLIC_ADDRESSES_KEY}_${normalize(username)}`, JSON.stringify(addresses));
    },
    clear: (username: string) => {
        localStorage.removeItem(`${PUBLIC_ADDRESSES_KEY}_${normalize(username)}`);
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
    console.log('[Web3Service] Attempting decryption...');
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
    console.log('[Web3Service] Decryption successful');
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
            ARBITRUM: `${ICON_BASE}/16547/large/arbitrum-shield.png`,
            USDT_TRC20: `${ICON_BASE}/325/large/tether.png`,
            USDT_BEP20: `${ICON_BASE}/325/large/tether.png`,
            USDT_ERC20: `${ICON_BASE}/325/large/tether.png`,
        };

        const rawWallets: any = { mnemonic };
        for (const [chain, data] of Object.entries(derived)) {
            rawWallets[chain] = {
                address: data.address,
                publicKey: data.publicKey,
                privateKey: data.privateKey,
                imageUrl: ICONS[chain] || ''
            };
        }
        return rawWallets as RawWallets;
    },

    /**
     * Fetch balances + USD prices for all derived wallets.
     * POST /api/wallet/info  { wallets }
     */
    /**
     * Fetch balances + USD prices for all derived wallets.
     * POST /api/wallet/info  { wallets }
     */
    getWalletInfo: async (wallets: RawWallets): Promise<Web3WalletInfo[]> => {
        const res = await fetch(`${WEB3_API_URL}/api/wallet/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallets }),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`Wallet info fetch failed (${res.status}):`, text);
            throw new Error(`Wallet info fetch failed (${res.status})`);
        }
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Wallet info fetch failed');
        return data.walletInfo as Web3WalletInfo[];
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
        if (!res.ok) throw new Error(`Broadcast failed (${res.status})`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Broadcast failed');
        return data.hash;
    },

    /**
     * Send transaction (Legacy / Utility based).
     */
    sendTransaction: async (chain: string, to: string, amount: number, wallet: any) => {
        const res = await fetch(`${WEB3_API_URL}/api/wallet/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chain, to, amount, wallet }),
        });
        if (!res.ok) throw new Error(`Send failed (${res.status})`);
        return res.json();
    },
};
