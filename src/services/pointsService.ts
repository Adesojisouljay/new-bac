const POINTS_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointsBalance {
    username: string;
    communityId: string;
    totalPoints: number;
    unclaimedPoints: number;
}

export interface PointsHistoryEntry {
    _id: string;
    username: string;
    communityId: string;
    actionType: string;
    points: number;
    createdAt: string;
    metadata?: any;
}

export type PointType = 'login' | 'posts' | 'comments' | 'upvote' | 'reblog' | 'delegation' | 'community' | 'checking' | 'transfer_in' | 'transfer_out';

// ─── Token Helpers ─────────────────────────────────────────────────────────────

// We rename this to breakaway_token to signify it's the core system auth token, not just "points"
const AUTH_TOKEN_KEY = 'breakaway_token';

export function getAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const pointsService = {
    /**
     * Authenticate with the backend using a signed proof.
     * This establishes the session JWT needed for the wallet Relay and other protected routes.
     * It then silently triggers a 'login' point award.
     */
    loginToPointsBackend: async (
        username: string,
        community: string,
        method: 'keychain' | 'hiveauth' = 'keychain',
        preSigned?: { sig: any; ts?: string; message?: string },
        onChallenge?: (data: { qr: string; uuid: string }) => void
    ): Promise<boolean> => {
        try {
            // Helper for robust signature extraction
            const extractSig = (obj: any): string | null => {
                if (!obj) return null;
                if (typeof obj === 'string') return obj;
                if (typeof obj !== 'object') return null;

                if (obj.sig && typeof obj.sig === 'string') return obj.sig;
                if (obj.signature && typeof obj.signature === 'string') return obj.signature;
                if (obj.challenge) {
                    if (typeof obj.challenge === 'string') return obj.challenge;
                    if (typeof obj.challenge === 'object') {
                        if (obj.challenge.sig) return obj.challenge.sig;
                        if (obj.challenge.signature) return obj.challenge.signature;
                    }
                }
                if (obj.data?.challenge) return extractSig(obj.data.challenge);

                for (const key of Object.keys(obj)) {
                    if (typeof obj[key] === 'string' && obj[key].length > 80) return obj[key];
                    if (typeof obj[key] === 'object') {
                        const found = extractSig(obj[key]);
                        if (found) return found;
                    }
                }
                return null;
            };

            if (preSigned && preSigned.sig) {
                const ts = preSigned.ts || Date.now().toString();
                let sig = extractSig(preSigned.sig);

                if (!sig) {
                    console.error("[Auth] Failed to extract signature from pre-signed data.");
                    return false;
                }

                const messageArg = preSigned.message ? `&message=${encodeURIComponent(preSigned.message)}` : '';

                const res = await fetch(
                    `${POINTS_API_URL}/auth/login?username=${encodeURIComponent(username)}&ts=${ts}&sig=${encodeURIComponent(sig)}&community=${encodeURIComponent(community)}${messageArg}`
                );

                if (res.ok) {
                    const data = await res.json();
                    const token = data?.response?.token;
                    if (token) {
                        setAuthToken(token);
                        localStorage.removeItem('pending_auth');
                        pointsService.awardPoints(username, community, 'login'); // Silently award login points
                        return true;
                    }
                } else {
                    console.error(`[Auth] Pre-signed auth failed.`);
                    localStorage.removeItem('pending_auth');
                    return false;
                }
            }

            // If we don't have preSigned data, we need to request a signature:
            const ts = Date.now().toString();
            const message = `${username}${ts}`;
            let signature: string;

            if (method === 'keychain') {
                const keychain = (window as any).hive_keychain;
                if (!keychain) {
                    console.error('[Auth] Keychain not found');
                    return false;
                }

                const signed = await new Promise<{ success: boolean; result: string }>((resolve) => {
                    keychain.requestSignBuffer(username, message, 'Posting', (resp: any) => resolve(resp));
                });

                if (!signed.success) {
                    console.error('[Auth] Keychain signature failed');
                    return false;
                }
                signature = signed.result;
            } else {
                // HiveAuth support
                const { default: HAS } = await import("hive-auth-wrapper");
                const { HAS_SERVER, HAS_STATIC_KEY, APP_META } = await import('../features/auth/services/authService');

                const auth = {
                    username,
                    key: HAS_STATIC_KEY,
                    host: HAS_SERVER,
                    token: undefined,
                    expire: undefined
                };

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

                // [Auth Resume] Save state before we might be redirected or refreshed
                localStorage.setItem('pending_auth', JSON.stringify({ username, community, method, ts, message }));

                const challenge_data = { key_type: 'posting' as const, challenge: message };

                const result = await new Promise<any>((resolve) => {
                    HAS.authenticate(auth, APP_META, challenge_data, (evt: any) => {
                        if (onChallenge) {
                            const qr_data = { ...evt, host: HAS_SERVER };
                            delete qr_data.cmd;
                            delete qr_data.expire;
                            const uri = `has://auth_req/${btoa(JSON.stringify(qr_data))}`;
                            onChallenge({ qr: uri, uuid: evt.uuid });
                        }
                    })
                        .then((res: any) => resolve({ success: true, result: res }))
                        .catch((err: any) => resolve({ success: false, error: err }));
                });

                if (!result.success || !result.result) {
                    console.error('[Auth] HiveAuth signature failed:', result.error);
                    localStorage.removeItem('pending_auth');
                    return false;
                }

                const extracted = extractSig(result.result);
                if (!extracted) {
                    console.error('[Auth] Could not extract signature from HAS result');
                    localStorage.removeItem('pending_auth');
                    return false;
                }
                signature = extracted;

                if (result.result.data?.token) {
                    localStorage.setItem('hive_auth_session', JSON.stringify({
                        username,
                        token: result.result.data.token,
                        expire: result.result.data.expire,
                        key: auth.key
                    }));
                }
            }

            const res = await fetch(
                `${POINTS_API_URL}/auth/login?username=${encodeURIComponent(username)}&ts=${ts}&sig=${encodeURIComponent(signature)}&community=${encodeURIComponent(community)}&message=${encodeURIComponent(message)}`
            );

            if (res.ok) {
                const data = await res.json();
                const token = data?.response?.token;
                if (token) {
                    setAuthToken(token);
                    localStorage.removeItem('pending_auth');
                    pointsService.awardPoints(username, community, 'login'); // Silently award login points
                    return true;
                }
            }
            console.error('[Auth] Network error or missing token');
            localStorage.removeItem('pending_auth');
            return false;
        } catch (e) {
            console.error('[Auth] Login failed with error:', e);
            localStorage.removeItem('pending_auth');
            return false;
        }
    },

    resumePendingAuth: async (onChallenge?: (data: { qr: string; uuid: string }) => void): Promise<boolean> => {
        const pending = localStorage.getItem('pending_auth');
        if (!pending) return false;

        try {
            const { username, community, method } = JSON.parse(pending);
            if (method !== 'hiveauth') {
                localStorage.removeItem('pending_auth');
                return false;
            }
            return await pointsService.loginToPointsBackend(username, community, method, undefined, onChallenge);
        } catch (e) {
            console.error("[Auth] Failed to resume pending auth:", e);
            localStorage.removeItem('pending_auth');
            return false;
        }
    },

    /**
     * Award points for a user action 
     * Silent, non-blocking lightweight fetch
     */
    awardPoints: async (
        username: string,
        communityId: string,
        actionType: PointType,
        metadata?: any
    ): Promise<void> => {
        const token = getAuthToken();
        if (!token) return; // Silent fail

        try {
            await fetch(`${POINTS_API_URL}/api/v1/points/award`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ username, communityId, actionType, metadata }),
            }).catch(() => { /* purely silent to prevent interrupting UI flow */ });
        } catch (e) {
            // silent
        }
    },

    /**
     * Fetch the user's aggregated point balance
     */
    getUserPoints: async (
        username: string,
        communityId: string
    ): Promise<PointsBalance> => {
        const res = await fetch(
            `${POINTS_API_URL}/api/v1/points/balance/${encodeURIComponent(username)}/${encodeURIComponent(communityId)}`
        );
        if (!res.ok) return { username, communityId, totalPoints: 0, unclaimedPoints: 0 };
        const data = await res.json();
        return data.data;
    },

    /**
     * Fetch the user's flat point earning history ledger
     */
    getPointsHistory: async (
        username: string,
        communityId: string
    ): Promise<PointsHistoryEntry[]> => {
        const res = await fetch(
            `${POINTS_API_URL}/api/v1/points/ledger/${encodeURIComponent(username)}/${encodeURIComponent(communityId)}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.data as PointsHistoryEntry[];
    },

    /**
     * Claim accumulated points
     */
    claimPoints: async (
        username: string,
        communityId: string
    ): Promise<{ success: boolean; message?: string }> => {
        const token = getAuthToken();
        if (!token) return { success: false, message: "Authentication required" };

        try {
            const res = await fetch(`${POINTS_API_URL}/api/v1/points/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ username, communityId }),
            });

            const data = await res.json();
            return { success: res.ok, message: data.msg || data.message };
        } catch (e) {
            return { success: false, message: 'Network error or server unavailable' };
        }
    },

    /**
     * Transfer points to another user.
     */
    transferPoints: async (
        senderUsername: string,
        receiverUsername: string,
        community: string,
        amount: number
    ): Promise<{ success: boolean; message?: string; error?: string }> => {
        try {
            const res = await fetch(`${POINTS_API_URL}/transactions/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken() || ''}`,
                },
                body: JSON.stringify({ senderUsername, receiverUsername, community, amount }),
            });

            const data = await res.json();
            return { success: res.ok, message: data.message, error: data.message };
        } catch (e) {
            return { success: false, error: 'Network error or server unavailable' };
        }
    },
};
