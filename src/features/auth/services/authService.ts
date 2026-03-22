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
    icon: "https://sovraniche.netlify.app/logo192.png"
};

export const accountManager = {
    getAll(): StoredAccount[] {
        try {
            return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        } catch { return []; }
    },

    add(username: string, method: StoredAccount['method']) {
        const accounts = this.getAll();
        const existingIndex = accounts.findIndex(a => a.username === username);

        if (existingIndex > -1) {
            accounts[existingIndex].method = method;
        } else {
            accounts.push({ username, method });
        }

        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        localStorage.setItem('hive_auth_method', method);
        this.setActive(username);
    },

    remove(username: string) {
        const remaining = this.getAll().filter(a => a.username !== username);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remaining));

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
    login: async (username: string): Promise<{ success: boolean; result?: any; message?: string; ts?: string; error?: string }> => {
        if (!(await authService.isKeychainInstalled())) {
            return { success: false, error: 'Hive Keychain not installed' };
        }

        try {
            // Create a challenge string (username+timestamp) to sign - Aligned with Points backend
            const ts = Date.now().toString();
            const message = `${username}${ts}`;

            const response = await keychain.login({
                username,
                message,
                method: 'Posting',
                title: 'Login to Sovraniche'
            } as any);

            if (response.success) {
                return {
                    success: true,
                    result: response.result,
                    message: message,
                    ts: ts // Return timestamp for pre-signed validation
                };
            } else {
                return { success: false, error: response.error };
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
    ): Promise<{ success: boolean; result?: any; session?: any; challenge?: string; ts?: string; error?: string }> => {
        return new Promise((resolve) => {
            // App metadata
            const APP_META = {
                name: "BAC",
                description: "BAC",
                icon: "https://sovraniche.netlify.app/logo192.png"
            };

            const auth = {
                username,
                token: undefined,
                expire: undefined,
                key: HAS_STATIC_KEY
            };

            // Aligned challenge for One-Tap auth
            const ts = Date.now().toString();
            const challenge = `${username}${ts}`;

            import("hive-auth-wrapper").then(({ default: HAS }) => {
                HAS.authenticate(auth, APP_META, { challenge, key_type: "posting" }, (evt: any) => {
                    const qr_data = { ...evt };
                    delete qr_data.cmd;
                    delete qr_data.expire;
                    qr_data.host = HAS_SERVER;

                    const json = JSON.stringify(qr_data);
                    const uri = `has://auth_req/${btoa(json)}`;
                    onChallenge({ qr: uri, uuid: evt.uuid });
                })
                    .then((res: any) => {
                        // Persist the session
                        const updatedSession = {
                            ...auth,
                            token: res.data.token,
                            expire: res.data.expire,
                            uuid: res.data.uuid
                        };
                        localStorage.setItem('hive_auth_session', JSON.stringify(updatedSession));

                        resolve({
                            success: true,
                            result: res.data,
                            session: updatedSession,
                            challenge: challenge,
                            ts: ts
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
    checkDelegation: async (username: string): Promise<boolean> => {
        const relayAccount = 'breakaway.app';
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
    authorizeRelay: async (
        username: string,
        method: 'keychain' | 'hiveauth',
        onChallenge?: (data: { qr: string; uuid: string }) => void,
        existingSession?: any
    ): Promise<{ success: boolean; result?: any; error?: string }> => {
        const relayAccount = 'breakaway.app';
        return new Promise(async (resolve) => {
            if (method === 'keychain') {
                const keychain = (window as any).hive_keychain;
                if (keychain) {
                    keychain.requestAddAccountAuthority(username, relayAccount, 'Posting', 1, (response: any) => {
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
                    posting.account_auths.sort((a, b) => a[0].localeCompare(b[0]));

                    const op = ["account_update", {
                        account: username,
                        posting: posting,
                        memo_key: account.memo_key,
                        json_metadata: account.json_metadata
                    }];

                    // Use HAS to broadcast account_update (Active key required)
                    let auth = {
                        username,
                        token: undefined,
                        expire: undefined,
                        key: HAS_STATIC_KEY
                    };

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
                        .then((res: any) => {
                            if (res.data) {
                                // Update session token if provided
                                const stored = localStorage.getItem('hive_auth_session');
                                if (stored) {
                                    try {
                                        const session = JSON.parse(stored);
                                        if (res.data.token) session.token = res.data.token;
                                        if (res.data.expire) session.expire = res.data.expire;
                                        localStorage.setItem('hive_auth_session', JSON.stringify(session));
                                    } catch (e) { }
                                }
                            }
                            resolve({ success: true, result: res.data });
                        })
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
    },

    /**
     * Generic signature request for a buffer/message
     */
    signMessage: async (
        username: string,
        message: string,
        keyType: 'Posting' | 'Active' | 'Memo' = 'Posting',
        onChallenge?: (data: { qr: string; uuid: string }) => void
    ): Promise<{ success: boolean; result?: string; error?: string }> => {
        const storedMethod = localStorage.getItem('hive_auth_method');
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        let method = storedMethod || (isMobile ? 'hiveauth' : 'keychain');
        const cleanUsername = username.replace(/^@/, '').toLowerCase();

        if (method === 'keychain') {
            const keychain = (window as any).hive_keychain;
            if (!keychain) {
                if (isMobile) {
                    method = 'hiveauth'; // Force HAS fallback on mobile if extension is missing
                } else {
                    return { success: false, error: 'Hive Keychain not installed' };
                }
            }
        }

        if (method === 'keychain') {
            const keychain = (window as any).hive_keychain;
            return new Promise((resolve) => {
                keychain.requestSignBuffer(cleanUsername, message, keyType, (response: any) => {
                    if (response.success) resolve({ success: true, result: response.result });
                    else resolve({ success: false, error: response.message });
                });
            });
        } else {
            return new Promise((resolve) => {
                const auth = {
                    username: cleanUsername,
                    token: undefined,
                    expire: undefined,
                    key: HAS_STATIC_KEY
                };

                const storedSession = localStorage.getItem('hive_auth_session');
                if (storedSession) {
                    try {
                        const session = JSON.parse(storedSession);
                        // Validate session ownership and expiry
                        if (session.username.replace(/^@/, '').toLowerCase() === cleanUsername && Number(session.expire) > Date.now()) {
                            auth.token = session.token;
                            auth.expire = session.expire;
                            auth.key = session.key;
                        } else {
                            // Clear stale or invalid session
                            localStorage.removeItem('hive_auth_session');
                        }
                    } catch (e) {
                        localStorage.removeItem('hive_auth_session'); // Clear corrupted session
                    }
                }

                import("hive-auth-wrapper").then(({ default: HAS }) => {
                    const isSessionValid = !!(auth.token && auth.expire && Number(auth.expire) > Date.now());

                    const handleEvent = (evt: any) => {
                        let uri = '';

                        // If we have a session, we MUST use sign_req to get the "Sign Buffer" prompt (Screenshot 3)
                        if (isSessionValid) {
                            const qr_data = {
                                account: cleanUsername,
                                uuid: evt.uuid,
                                key: auth.key,
                                host: HAS_SERVER
                            };
                            uri = `has://sign_req/${btoa(JSON.stringify(qr_data))}`;
                        } else {
                            // If no session, auth_req (Screenshot 1) will be used initially.
                            // We include the challenge in the authenticate call to trigger the sign prompt immediately after.
                            const auth_payload = { ...evt };
                            delete auth_payload.cmd;
                            delete auth_payload.expire;
                            auth_payload.host = HAS_SERVER;
                            auth_payload.account = cleanUsername;
                            uri = `has://auth_req/${btoa(JSON.stringify(auth_payload))}`;
                        }

                        if (onChallenge) onChallenge({ qr: uri, uuid: evt.uuid });
                    };

                    const requestPromise = isSessionValid
                        ? HAS.challenge(auth, { challenge: message, key_type: keyType.toLowerCase() as any }, handleEvent)
                        : HAS.authenticate(auth, APP_META, { challenge: message, key_type: keyType.toLowerCase() as any }, handleEvent);

                    requestPromise
                        .then((res: any) => {
                            if (res.data) {
                                // If we got a token back (re-auth or session refresh), save it
                                if (res.data.token) {
                                    const newSession = {
                                        ...auth,
                                        token: res.data.token,
                                        expire: res.data.expire || (Date.now() + 24 * 60 * 60 * 1000)
                                    };
                                    localStorage.setItem('hive_auth_session', JSON.stringify(newSession));
                                }
                                resolve({ success: true, result: res.data.challenge || res.data });
                            } else {
                                resolve({ success: false, error: "No data returned from HiveAuth" });
                            }
                        })
                        .catch((err: any) => {
                            console.error("HAS Sign Error:", err);
                            resolve({ success: false, error: typeof err === 'string' ? err : (err?.message || "HiveAuth failed") });
                        });
                });
            });
        }
    },

    /**
     * Broadcast a custom_json to the Hive blockchain
     */
    broadcastJson: async (
        username: string,
        id: string,
        json: any,
        keyType: 'Posting' | 'Active' = 'Posting',
        onChallenge?: (data: { qr: string; uuid: string }) => void
    ): Promise<{ success: boolean; result?: any; error?: string }> => {
        const storedMethod = localStorage.getItem('hive_auth_method') || 'keychain';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        let method = storedMethod;
        if (method === 'keychain') {
            const keychain = (window as any).hive_keychain;
            if (!keychain) {
                if (isMobile) method = 'hiveauth';
                else return { success: false, error: 'Hive Keychain not installed' };
            }
        }

        const cleanUsername = username.replace(/^@/, '').toLowerCase();

        if (method === 'keychain') {
            const keychain = (window as any).hive_keychain;

            return new Promise((resolve) => {
                keychain.requestCustomJson(cleanUsername, id, keyType, JSON.stringify(json), `Log ${id}`, (response: any) => {
                    if (response.success) resolve({ success: true, result: response.result });
                    else resolve({ success: false, error: response.message });
                });
            });
        } else {
            return new Promise((resolve) => {
                const op = ['custom_json', {
                    required_auths: keyType === 'Active' ? [cleanUsername] : [],
                    required_posting_auths: keyType === 'Posting' ? [cleanUsername] : [],
                    id,
                    json: JSON.stringify(json)
                }];

                const auth = {
                    username: cleanUsername,
                    token: undefined,
                    expire: undefined,
                    key: HAS_STATIC_KEY
                };

                const storedSession = localStorage.getItem('hive_auth_session');
                if (storedSession) {
                    try {
                        const session = JSON.parse(storedSession);
                        if (session.username.replace(/^@/, '').toLowerCase() === cleanUsername) {
                            auth.token = session.token;
                            auth.expire = session.expire;
                            auth.key = session.key;
                        }
                    } catch (e) { }
                }

                import("hive-auth-wrapper").then(({ default: HAS }) => {
                    HAS.broadcast(auth, keyType.toLowerCase() as any, [op], (evt: any) => {
                        const qr_data = {
                            account: cleanUsername,
                            uuid: evt.uuid,
                            key: auth.key,
                            host: HAS_SERVER
                        };
                        const uri = `has://sign_req/${btoa(JSON.stringify(qr_data))}`;
                        if (onChallenge) onChallenge({ qr: uri, uuid: evt.uuid });
                    })
                        .then((res: any) => {
                            resolve({ success: true, result: res.data });
                        })
                        .catch((err: any) => {
                            console.error("HAS Broadcast error:", err);
                            resolve({ success: false, error: typeof err === 'string' ? err : (err?.message || "HiveAuth failed") });
                        });
                });
            });
        }
    }
};
