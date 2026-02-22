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
    isLengthInstalled: async (): Promise<boolean> => {
        return !!(window as any).hive_keychain;
    },

    /**
     * Log in using Hive Keychain (Sign Buffer for proof of identity)
     */
    login: async (username: string): Promise<{ success: boolean; result?: any; error?: string }> => {
        if (!(await authService.isLengthInstalled())) {
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
                name: "Breakaway",
                description: "Breakaway Communities",
                icon: "https://images.hive.blog/u/hive-106444/avatar/large"
            };

            const auth = {
                username,
                token: undefined,
                expire: undefined,
                key: `${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`
            };

            // Structured challenge object as per working example
            const messageObj: any = {
                signed_message: {
                    type: "code",
                    app: "breakaway.communities"
                },
                authors: [username],
                timestamp: Date.now()
            };

            const challenge = JSON.stringify(messageObj);

            import("hive-auth-wrapper").then(({ default: HAS }) => {
                HAS.authenticate(auth, APP_META, { challenge, key_type: "posting" }, (evt: any) => {
                    // Extract data for the QR code as per the working example
                    const qr_data = { ...evt };
                    delete qr_data.cmd;
                    delete qr_data.expire;
                    qr_data.host = "wss://hive-auth.arcange.eu/";

                    const json = JSON.stringify(qr_data);
                    const uri = `has://auth_req/${btoa(json)}`;
                    onChallenge({ qr: uri, uuid: evt.uuid });
                })
                    .then((res: any) => {
                        // Authentication successful
                        // Return the auth object (with the key we generated) and the result (with token/expire)
                        resolve({ success: true, result: res, session: auth });
                    })
                    .catch((err: any) => {
                        console.error("HAS Rejected:", err);
                        resolve({ success: false, error: typeof err === 'string' ? err : (err?.message || "HiveAuth rejected") });
                    });
            }).catch(err => {
                console.error("HAS Module Import Error:", err);
                resolve({ success: false, error: "Failed to load HiveAuth wrapper" });
            });
        });
    }
};
