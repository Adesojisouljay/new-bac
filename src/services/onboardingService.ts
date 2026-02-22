import { hiveClient } from './hive/client';
import { PrivateKey, cryptoUtils } from '@hiveio/dhive';
import axios from 'axios';

const POINTS_API_URL = import.meta.env.VITE_POINTS_API_URL || 'http://localhost:4000';

export interface HiveKeys {
    owner: string;
    active: string;
    posting: string;
    memo: string;
    ownerPubkey: string;
    activePubkey: string;
    postingPubkey: string;
    memoPubkey: string;
}

export interface OnboardingState {
    username: string;
    status: 'idle' | 'checking' | 'keys_generated' | 'payment_pending' | 'creating' | 'success' | 'failed';
    error?: string;
    txId?: string;
}

class OnboardingService {
    /**
     * Check if a username is available on the Hive blockchain
     */
    async checkUsernameAvailability(username: string): Promise<boolean> {
        if (!username || username.length < 3) return false;
        try {
            const accounts = await hiveClient.database.getAccounts([username]);
            return accounts.length === 0;
        } catch (error) {
            console.error('Error checking username availability:', error);
            throw new Error('Failed to verify username availability');
        }
    }

    /**
     * Get the current account creation fee in HIVE
     */
    async getAccountCreationFee(): Promise<string> {
        try {
            const props = await hiveClient.database.getChainProperties();
            return props.account_creation_fee.toString();
        } catch (error) {
            console.error('Error fetching account creation fee:', error);
            return '3.000 HIVE'; // Fallback
        }
    }

    /**
     * Get the number of Account Creation Tokens (ACT) for a creator
     */
    async getCreatorACTBalance(creator: string): Promise<number> {
        try {
            const [account] = await hiveClient.database.getAccounts([creator]);
            return account ? (account as any).pending_claimed_accounts : 0;
        } catch (error) {
            console.error('Error fetching creator ACT balance:', error);
            return 0;
        }
    }

    /**
     * Generate Hive keys locally from a master password
     */
    generateKeys(username: string, password: string): HiveKeys {
        const roles: (keyof HiveKeys)[] = ['owner', 'active', 'posting', 'memo'];
        const keys: any = {};

        roles.forEach((role) => {
            const privKey = PrivateKey.fromLogin(username, password, role as any);
            keys[role] = privKey.toString();
            keys[`${role}Pubkey`] = privKey.createPublic().toString();
        });

        return keys as HiveKeys;
    }

    /**
     * Generate a random secure master password
     */
    generateMasterPassword(): string {
        const seed = Math.random().toString() + Date.now().toString();
        const hash = cryptoUtils.sha256(seed);
        // Convert Buffer to string if necessary, though dhive's PrivateKey.fromSeed handles Buffer
        return 'P' + PrivateKey.fromSeed(hash as any).toString();
    }

    /**
     * Create a Hive account using HIVE payment via Keychain
     */
    async createAccountWithPayment(
        creator: string,
        newUsername: string,
        keys: HiveKeys,
        fee: string,
        jsonMetadata: string = ''
    ): Promise<{ success: boolean; txId?: string; error?: string }> {
        return new Promise((resolve) => {
            const keychain = (window as any).hive_keychain;
            if (!keychain) {
                return resolve({ success: false, error: 'Hive Keychain not found' });
            }

            const op = [
                'account_create',
                {
                    fee: fee,
                    creator: creator,
                    new_account_name: newUsername,
                    owner: {
                        weight_threshold: 1,
                        account_auths: [],
                        key_auths: [[keys.ownerPubkey, 1]],
                    },
                    active: {
                        weight_threshold: 1,
                        account_auths: [],
                        key_auths: [[keys.activePubkey, 1]],
                    },
                    posting: {
                        weight_threshold: 1,
                        account_auths: [],
                        key_auths: [[keys.postingPubkey, 1]],
                    },
                    memo_key: keys.memoPubkey,
                    json_metadata: jsonMetadata,
                },
            ];

            keychain.requestBroadcast(
                creator,
                [op],
                'active',
                (response: any) => {
                    if (response.success) {
                        resolve({ success: true, txId: response.result.id });
                    } else {
                        resolve({ success: false, error: response.message || 'Payment failed' });
                    }
                }
            );
        });
    }

    /**
     * Create a Hive account using an Account Creation Token (ACT) via Keychain
     */
    async createAccountWithToken(
        creator: string,
        newUsername: string,
        keys: HiveKeys,
        jsonMetadata: string = ''
    ): Promise<{ success: boolean; txId?: string; error?: string }> {
        return new Promise((resolve) => {
            const keychain = (window as any).hive_keychain;
            if (!keychain) {
                return resolve({ success: false, error: 'Hive Keychain not found' });
            }

            const op = [
                'create_claimed_account',
                {
                    creator: creator,
                    new_account_name: newUsername,
                    owner: {
                        weight_threshold: 1,
                        account_auths: [],
                        key_auths: [[keys.ownerPubkey, 1]],
                    },
                    active: {
                        weight_threshold: 1,
                        account_auths: [],
                        key_auths: [[keys.activePubkey, 1]],
                    },
                    posting: {
                        weight_threshold: 1,
                        account_auths: [],
                        key_auths: [[keys.postingPubkey, 1]],
                    },
                    memo_key: keys.memoPubkey,
                    json_metadata: jsonMetadata,
                    extensions: [],
                },
            ];

            keychain.requestBroadcast(
                creator,
                [op],
                'active',
                (response: any) => {
                    if (response.success) {
                        resolve({ success: true, txId: response.result.id });
                    } else {
                        resolve({ success: false, error: response.message || 'Token submission failed' });
                    }
                }
            );
        });
    }
    /**
     * Get the conversion rate from HIVE to SATS
     */
    async getHiveToSats(hiveAmount: number): Promise<number> {
        try {
            const res = await axios.get(
                "https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=btc"
            );
            const hivePriceBTC = res.data?.hive?.btc || 0;
            return Math.round(hiveAmount * hivePriceBTC * 100_000_000);
        } catch (error) {
            console.error("Error fetching HIVE price:", error);
            return Math.round(hiveAmount * 0.000003 * 100_000_000); // 100% fallback estimate
        }
    }

    /**
     * Get a Lightning invoice from v4v.app
     */
    async getInvoice(beneficiary: string, username: string, satsAmount: number): Promise<any> {
        try {
            const response = await axios.get("https://api.v4v.app/v1/new_invoice_hive", {
                params: {
                    hive_accname: beneficiary,
                    amount: satsAmount,
                    currency: "SATS",
                    receive_currency: "sats",
                    usd_hbd: false,
                    app_name: "BAC",
                    expiry: 300,
                    message: username,
                    qr_code: "none"
                },
                headers: { accept: "application/json" }
            });
            return response.data;
        } catch (error: any) {
            console.error("Error fetching invoice:", error.response?.data || error.message);
            throw new Error("Failed to generate Lightning invoice");
        }
    }

    /**
     * Use dhive to create a local cryptographic signature identical to what Hive Keychain produces
     */
    signUnlockMessageLocally(postingKeyStr: string, message: string): string {
        const privKey = PrivateKey.fromString(postingKeyStr);
        const hash = cryptoUtils.sha256(message);
        const signature = privKey.sign(hash);
        // Signature.toString() in dhive returns the hex representation required by the web3 wallet encryptor
        return signature.toString();
    }

    /**
     * Submit the Lightning account creation request to the community backend
     */
    async submitLightningRequest(username: string, keys: HiveKeys, invoiceData: any, jsonMetadata: string = ''): Promise<any> {
        try {
            const data = {
                username: username,
                accountKeys: {
                    ownerPubkey: keys.ownerPubkey,
                    activePubkey: keys.activePubkey,
                    postingPubkey: keys.postingPubkey,
                    memoPubkey: keys.memoPubkey
                },
                token: "HIVE",
                payment_addr: invoiceData.payment_addr,
                payment_hash: invoiceData.payment_hash,
                payment_request: invoiceData.payment_request,
                r_hash: invoiceData.r_hash,
                v4vMemo: invoiceData.memo,
                satsAmount: invoiceData.amount,
                jsonMetadata: jsonMetadata
            };

            const response = await axios.post(`${POINTS_API_URL}/lightning-account`, data);
            return response.data;
        } catch (error: any) {
            console.error("Error submitting lightning request:", error.response?.data || error.message);
            throw new Error(error.response?.data?.error || "Failed to submit request to backend");
        }
    }

    /**
     * Poll the backend for the status of a Hive account creation request
     */
    async checkAccountStatus(username: string): Promise<{ exists: boolean; created: boolean; status?: string; account?: any; error?: string }> {
        try {
            const response = await axios.get(`${POINTS_API_URL}/account-status/${username}`);
            return response.data;
        } catch (error) {
            console.error("Error checking account status:", error);
            return { exists: false, created: false };
        }
    }
}

export const onboardingService = new OnboardingService();
