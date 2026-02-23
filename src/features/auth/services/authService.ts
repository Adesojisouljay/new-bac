import { KeychainSDK } from 'keychain-sdk';

// Initialize the SDK with the window object (required for browser extension)
const keychain = new KeychainSDK(window);

export interface AuthUser {
    username: string;
    memoKey?: string;
}

export interface StoredAccount {
    username: string;
    method: 'keychain' | 'hiveauth';
}

const ACCOUNTS_KEY = 'hive_accounts';
const ACTIVE_USER_KEY = 'hive_user';

export const accountManager = {
    getAll(): StoredAccount[] {
        try {
            return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        } catch { return []; }
    },

    add(username: string, method: StoredAccount['method']) {
        const accounts = this.getAll();
        if (!accounts.find(a => a.username === username)) {
            accounts.push({ username, method });
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        }
        localStorage.setItem('hive_auth_method', method);
        this.setActive(username);
    },

    remove(username: string) {
        const remaining = this.getAll().filter(a => a.username !== username);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remaining));

        // If the removed user was the active one, clear the active status
        // DO NOT automatically switch to another user
        if (this.getActive() === username) {
            this.logout();
        }
    },

    logout() {
        localStorage.removeItem(ACTIVE_USER_KEY);
    },

    setActive(username: string) {
        localStorage.setItem(ACTIVE_USER_KEY, username);
    },

    getActive(): string | null {
        return localStorage.getItem(ACTIVE_USER_KEY);
    }
};

/**
 * Authentication Service
 * Supports Hive Keychain and HiveAuth (HAS)
 */

export const authService = {
    /**
     * Checks if Hive Keychain is installed
     */
    isKeychainInstalled: async (): Promise<boolean> => {
        return !!(window as any).hive_keychain;
    },

    /**
     * Log in using Hive Keychain (Sign Buffer for proof of identity)
     */
    login: async (username: string): Promise<{ success: boolean; result?: any; error?: string }> => {
        if (!(await authService.isKeychainInstalled())) {
            return { success: false, error: 'Hive Keychain not installed' };
        }

        try {
            // Create a challenge string (timestamp) to sign
            const message = `Login to Breakaway: ${Date.now()}`;

            const response = await keychain.login({
                username,
                message,
                method: 'Posting', // Requesting Posting authority signature
                title: 'Login to Breakaway Communities'
            } as any); // Type assertion needed due to SDK type limitations in some versions

            if (response.success) {
                return { success: true, result: response };
            } else {
                return { success: false, error: typeof response.error === 'string' ? response.error : 'Login failed' };
            }

        } catch (error: any) {
            console.error('Auth Error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    },

    /**
     * Log in using HiveAuth (HAS)
     * @param username - Hive username
     * @param onChallenge - Callback receiving the auth data (QR, etc)
     */
    loginWithHiveAuth: (
        username: string,
        onChallenge: (data: { qr: string; uuid: string }) => void
    ): Promise<{ success: boolean; result?: any; session?: any; error?: string }> => {
        return new Promise((resolve) => {
            // App metadata
            const APP_META = {
                name: "BAC",
                description: "BAC",
                icon: "https://breakaway-communities.netlify.app/logo192.png"
            };

            const auth = {
                username,
                token: undefined,
                expire: undefined,
                key: "11edc52b-2918-4d71-9058-f7285e29d894" // Stable key from working example
            };

            // Structured challenge object as per working example
            const messageObj: any = {
                signed_message: {
                    type: "code",
                    app: "breakaway.app"
                },
                authors: [username],
                timestamp: Date.now()
            };

            const challenge = JSON.stringify(messageObj);

            import("hive-auth-wrapper").then(({ default: HAS }) => {
                HAS.authenticate(auth, APP_META, { challenge, key_type: "active" }, (evt: any) => {
                    const qr_data = { ...evt };
                    delete qr_data.cmd;
                    delete qr_data.expire;
                    qr_data.host = "wss://hive-auth.arcange.eu/";

                    const json = JSON.stringify(qr_data);
                    const uri = `has://auth_req/${btoa(json)}`;
                    onChallenge({ qr: uri, uuid: evt.uuid });
                })
                    .then((res: any) => {
                        // Extract challenge signature if present
                        if (res.data && res.data.challenge && res.data.challenge.challenge) {
                            messageObj.signatures = [res.data.challenge.challenge];
                        }
                        resolve({ success: true, result: res, session: auth });
                    })
                    .catch((err: any) => {
                        console.error("HAS Authentication error:", err);
                        resolve({ success: false, error: typeof err === 'string' ? err : (err?.message || "HiveAuth failed") });
                    });
            }).catch(err => {
                console.error("HAS Module Import Error:", err);
                resolve({ success: false, error: "Failed to load HiveAuth wrapper" });
            });
        });
    },

    /**
     * Check if a user has delegated Posting authority to the platform relay account
     */
    checkDelegation: async (username: string, relayAccount: string): Promise<boolean> => {
        try {
            const { hiveClient } = await import('../../../services/hive/client');
            const [account] = await hiveClient.database.getAccounts([username]);
            if (!account) return false;
            return account.posting.account_auths.some(auth => auth[0] === relayAccount);
        } catch (error) {
            console.error("Delegation check failed:", error);
            return false;
        }
    },

    /**
     * Request the user to delegate Posting authority to the relay account
     */
    authorizeRelay: async (username: string, relayAccount: string): Promise<{ success: boolean; error?: string }> => {
        return new Promise((resolve) => {
            const keychain = (window as any).hive_keychain;
            if (keychain) {
                keychain.requestAddAccountAuth(username, relayAccount, 'Posting', (response: any) => {
                    if (response.success) resolve({ success: true });
                    else resolve({ success: false, error: response.message });
                });
            } else {
                resolve({ success: false, error: "Relay authorization currently requires Hive Keychain. Please use a desktop browser to enable one-tap voting." });
            }
        });
    }
};
