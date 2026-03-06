import { authService } from '../features/auth/services/authService';
import { UNLOCK_MESSAGE, encryptMnemonic, decryptMnemonic } from './web3WalletService';

const API_URL = import.meta.env.VITE_POINTS_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface SatsWalletInfo {
    username?: string;
    walletId: string;
    encryptedInkey?: string;
    salt?: string;
    autoSwap?: boolean;
    isNew?: boolean;
    inkey?: string;
    balance?: number;
    config?: {
        swapThreshold: number;
        targetToken: string;
    };
}

export const lightningService = {
    decryptInkey: async (encryptedInkey: string, salt: string, signature: string): Promise<string> => {
        return decryptMnemonic(encryptedInkey, salt, signature);
    },
    /**
     * Get or create a Lightning wallet for the user.
     * If it doesn't exist, the backend will create one on LNBits.
     */
    getOrCreateWallet: async (username: string): Promise<SatsWalletInfo> => {
        const res = await fetch(`${API_URL}/api/lightning/wallet?username=${username}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to fetch Lightning wallet');
        }
        return res.json();
    },

    /**
     * Encrypt and Save a new Lightning wallet to the backend.
     * This is used during initial onboarding.
     */
    saveWallet: async (username: string, walletId: string, inkey: string, autoSwap: boolean = false) => {
        // 1. Get Keychain signature for encryption
        const signature = await authService.signMessage(username, UNLOCK_MESSAGE, 'Posting');
        if (!signature.success || !signature.result) throw new Error('Signature required to secure wallet');

        // 2. Encrypt inkey
        const { encrypted, salt } = await encryptMnemonic(inkey, signature.result);

        // 3. Save to backend
        const res = await fetch(`${API_URL}/api/lightning/wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                walletId,
                encryptedInkey: encrypted,
                salt,
                autoSwap,
                invoiceKey: inkey, // Publicly available for invoices
                rawInkey: inkey    // For backend-side encryption (auto-swap)
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to save Lightning wallet');
        }
        return res.json();
    },

    /**
     * Create a Lightning invoice locally using decrypted inkey.
     */
    createInvoice: async (username: string, amountSats: number, memo?: string): Promise<string> => {
        // 1. Fetch encrypted wallet info
        const wallet = await lightningService.getOrCreateWallet(username);

        let inkey = '';

        if (wallet.isNew && wallet.inkey) {
            inkey = wallet.inkey;
        } else {
            // 2. Get signature to decrypt existing wallet
            const signature = await authService.signMessage(username, UNLOCK_MESSAGE, 'Posting');
            if (!signature.success || !signature.result) throw new Error('Signature required to generate invoice');

            if (!wallet.encryptedInkey || !wallet.salt) throw new Error('Wallet credentials missing');

            // 3. Decrypt inkey
            inkey = await decryptMnemonic(wallet.encryptedInkey, wallet.salt, signature.result);
        }

        // 4. Request invoice via Ba-external-wallet (proxied or direct)
        const res = await fetch(`${API_URL}/api/lightning/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amountSats,
                memo,
                inkey
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to generate invoice');
        }
        const data = await res.json();
        return data.invoice.payment_request;
    },

    /**
     * Get Lightning wallet balance.
     */
    getBalance: async (username: string, providedInkey?: string): Promise<number> => {
        let inkey = providedInkey;

        if (!inkey) {
            // 1. Fetch encrypted wallet info
            const wallet = await lightningService.getOrCreateWallet(username);

            if (wallet.isNew && wallet.inkey) {
                // New wallets return the raw inkey for initial encryption
                inkey = wallet.inkey;
            } else {
                // 2. Get signature to decrypt existing wallet
                const signature = await authService.signMessage(username, UNLOCK_MESSAGE, 'Posting');
                if (!signature.success || !signature.result) throw new Error('Signature required to fetch balance');

                if (!wallet.encryptedInkey || !wallet.salt) throw new Error('Wallet credentials missing');

                // 3. Decrypt inkey
                inkey = await decryptMnemonic(wallet.encryptedInkey, wallet.salt, signature.result);
            }
        }

        // 4. Request balance
        const res = await fetch(`${API_URL}/api/lightning/balance?inkey=${inkey}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to fetch balance');
        }
        const data = await res.json();
        return data.balance; // in sats
    },

    /**
     * Pay a BOLT11 Invoice.
     */
    pay: async (bolt11: string, inkey: string): Promise<string> => {
        const res = await fetch(`${API_URL}/api/lightning/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bolt11, inkey })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Payment failed');
        }
        const data = await res.json();
        return data.payment_hash;
    }
};
