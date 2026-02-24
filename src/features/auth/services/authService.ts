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

// Shared HiveAuth settings
export const HAS_SERVER = "wss://hive-auth.arcange.eu/";
export const HAS_STATIC_KEY = "11edc52b-2918-4d71-9058-f7285e29d894";
export const APP_META = {
    name: "BAC",
    description: "BAC",
    icon: "https://breakaway-communities.netlify.app/logo192.png"
};

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
    login: async (username: string): Promise<{ success: boolean; result?: any; message?: string; error?: string }> => {
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
                return {
                    success: true,
                    result: response.result, // Use the inner result which contains the signature
                    message: message // Return the string that was signed
                };
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
    ): Promise<{ success: boolean; result?: any; session?: any; challenge?: string; error?: string }> => {
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
                key: HAS_STATIC_KEY
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
                    qr_data.host = HAS_SERVER;

                    const json = JSON.stringify(qr_data);
                    const uri = `has://auth_req/${btoa(json)}`;
                    onChallenge({ qr: uri, uuid: evt.uuid });
                })
                    .then((res: any) => {
                        resolve({
                            success: true,
                            result: res.data,
                            session: auth,
                            challenge: challenge // Return the JSON string that was signed
                        });
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
            console.log(`Checking delegation for ${username} to ${relayAccount}`);
            const { hiveClient } = await import('../../../services/hive/client');
            const [account] = await hiveClient.database.getAccounts([username]);

            if (!account) {
                console.log("Account not found for delegation check");
                return false;
            }

            console.log("Account posting auths:", JSON.stringify(account.posting.account_auths));
            const isDelegated = account.posting.account_auths.some(auth => auth[0] === relayAccount);
            console.log("Is delegated result:", isDelegated);
            return isDelegated;
        } catch (error) {
            console.error("Delegation check failed:", error);
            return false;
        }
    },

    /**
     * Request the user to delegate Posting authority to the relay account
     */
    authorizeRelay: async (
        username: string,
        relayAccount: string,
        method: 'keychain' | 'hiveauth',
        onChallenge?: (data: { qr: string; uuid: string }) => void,
        existingSession?: any
    ): Promise<{ success: boolean; error?: string }> => {
        return new Promise(async (resolve) => {
            if (method === 'keychain') {
                const keychain = (window as any).hive_keychain;
                if (keychain) {
                    console.log(`Keychain: Requesting add account authority for ${username} to ${relayAccount}`);
                    keychain.requestAddAccountAuthority(username, relayAccount, 'Posting', 1, (response: any) => {
                        console.log("Keychain response:", response);
                        if (response.success) resolve({ success: true });
                        else resolve({ success: false, error: response.message });
                    });
                } else {
                    resolve({ success: false, error: "Hive Keychain not installed" });
                }
            } else {
                if (!onChallenge) {
                    resolve({ success: false, error: "HiveAuth requires challenge callback" });
                    return;
                }

                try {
                    const { hiveClient } = await import('../../../services/hive/client');
                    const [account] = await hiveClient.database.getAccounts([username]);
                    if (!account) {
                        resolve({ success: false, error: "Account not found" });
                        return;
                    }

                    // Prepare updated posting authority
                    const posting = { ...account.posting };
                    const exists = posting.account_auths.some(auth => auth[0] === relayAccount);

                    if (exists) {
                        resolve({ success: true });
                        return;
                    }

                    posting.account_auths.push([relayAccount, 1]);
                    // Sort to maintain consistency
                    posting.account_auths.sort((a, b) => a[0].localeCompare(b[0]));

                    const op = ["account_update", {
                        account: username,
                        posting: posting,
                        memo_key: account.memo_key,
                        json_metadata: account.json_metadata
                    }];

                    // Use HAS to broadcast account_update
                    let auth = {
                        username,
                        token: undefined,
                        expire: undefined,
                        key: HAS_STATIC_KEY
                    };

                    // Use existing session if provided, otherwise check localStorage
                    if (existingSession && existingSession.username === username) {
                        auth = { ...existingSession };
                    } else {
                        const storedSession = localStorage.getItem('hive_auth_session');
                        if (storedSession) {
                            try {
                                const session = JSON.parse(storedSession);
                                if (session.username === username) {
                                    auth.token = session.token;
                                    auth.expire = session.expire;
                                    auth.key = session.key;
                                }
                            } catch (e) { }
                        }
                    }

                    if (!auth.token) {
                        resolve({ success: false, error: "Session token missing. Please log in again." });
                        return;
                    }

                    const { default: HAS } = await import("hive-auth-wrapper");
                    HAS.broadcast(auth, 'active', [op], (evt: any) => {
                        const qr_data = {
                            account: auth.username,
                            uuid: evt.uuid,
                            key: auth.key,
                            host: HAS_SERVER
                        };
                        const json = JSON.stringify(qr_data);
                        const uri = `has://sign_req/${btoa(json)}`;
                        onChallenge({ qr: uri, uuid: evt.uuid });
                    })
                        .then((res: any) => resolve({ success: true, result: res } as any))
                        .catch((err: any) => {
                            console.error("HAS Broadcast Error (Delegation):", err);
                            resolve({ success: false, error: typeof err === 'string' ? err : (err?.message || "HAS Authorization Failed") });
                        });

                } catch (error: any) {
                    console.error("Authorize Relay Error:", error);
                    resolve({ success: false, error: error.message || "Authorization flow failed" });
                }
            }
        });
    }
};
