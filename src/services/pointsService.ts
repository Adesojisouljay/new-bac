const POINTS_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointsByType {
    points: number;
    awarded_timestamps: number[];
}

export interface PointsBalance {
    username: string;
    communityName: string;
    communityId: string;
    pointsBalance: number;
    unclaimedPoints: number;
    symbol: string;
    points_by_type: {
        posts: PointsByType;
        comments: PointsByType;
        upvote: PointsByType;
        reblog: PointsByType;
        login: PointsByType;
        delegation: PointsByType;
        community: PointsByType;
        checking: PointsByType;
    };
}

export interface PointsHistoryEntry {
    _id: string;
    username: string;
    community: string;
    communityId: string;
    operationType: string;
    pointsEarned: number;
    timestamp: string;
}

export type PointType = 'posts' | 'comments' | 'upvote' | 'reblog' | 'login' | 'delegation' | 'community' | 'checking';

// ─── Token Helpers ─────────────────────────────────────────────────────────────

const POINTS_TOKEN_KEY = 'points_auth_token';

export function getPointsToken(): string | null {
    return localStorage.getItem(POINTS_TOKEN_KEY);
}

export function setPointsToken(token: string): void {
    localStorage.setItem(POINTS_TOKEN_KEY, token);
}

export function clearPointsToken(): void {
    localStorage.removeItem(POINTS_TOKEN_KEY);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const pointsService = {
    /**
     * Authenticate with the points backend using a Keychain-signed proof.
     * Call this right after a successful Keychain login.
     * Stores the JWT in localStorage under 'points_auth_token'.
     *
     * The backend expects: GET /auth/login?username=&ts=&sig=&community=
     * where sig = keychain.signBuffer(username + ts)
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
                    console.error("[Points] Failed to extract signature from pre-signed data.");
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

                        setPointsToken(token);
                        localStorage.removeItem('pending_points_auth');
                        return true;
                    }
                } else {
                    const errText = await res.text().catch(() => 'No error text');
                    console.error(`[Points] Pre-signed auth failed:`, errText);
                    localStorage.removeItem('pending_points_auth');
                    return false;
                }
            }


            const ts = Date.now().toString();
            const message = `${username}${ts}`;
            let signature: string;

            if (method === 'keychain') {
                const keychain = (window as any).hive_keychain;
                if (!keychain) {
                    console.error('[Points] Keychain not found');
                    localStorage.removeItem('pending_points_auth');
                    return false;
                }

                const signed = await new Promise<{ success: boolean; result: string }>((resolve) => {
                    keychain.requestSignBuffer(
                        username,
                        message,
                        'Posting',
                        (resp: any) => resolve(resp)
                    );
                });

                if (!signed.success) {
                    console.error('[Points] Keychain signature failed');
                    localStorage.removeItem('pending_points_auth');
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

                // Try to load existing session to avoid re-auth if possible
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
                localStorage.setItem('pending_points_auth', JSON.stringify({
                    username,
                    community,
                    method,
                    ts,
                    message
                }));

                const challenge_data = {
                    key_type: 'posting' as const,
                    challenge: message
                };

                const result = await new Promise<any>((resolve) => {
                    HAS.authenticate(auth, APP_META, challenge_data, (evt: any) => {

                        if (onChallenge) {
                            const qr_data = { ...evt };
                            delete qr_data.cmd;
                            delete qr_data.expire;
                            qr_data.host = HAS_SERVER;

                            const json = JSON.stringify(qr_data);
                            const uri = `has://auth_req/${btoa(json)}`;
                            onChallenge({ qr: uri, uuid: evt.uuid });
                        }
                    })
                        .then((res: any) => resolve({ success: true, result: res }))
                        .catch((err: any) => {
                            console.error("[Points] HAS Challenge error:", err);
                            resolve({ success: false, error: err });
                        });
                });

                if (!result.success || !result.result) {
                    console.error('[Points] HiveAuth signature failed:', result.error);
                    localStorage.removeItem('pending_points_auth');
                    return false;
                }

                // Use the ultra-robust extraction logic for the response
                const extracted = extractSig(result.result);
                if (!extracted) {
                    console.error('[Points] Could not extract signature from HAS result:', result.result);
                    localStorage.removeItem('pending_points_auth');
                    return false;
                }
                signature = extracted;

                // Persist the session if a new token was received
                if (result.result.data?.token) {
                    const session = {
                        username,
                        token: result.result.data.token,
                        expire: result.result.data.expire,
                        key: auth.key
                    };
                    localStorage.setItem('hive_auth_session', JSON.stringify(session));
                }
            }


            const res = await fetch(
                `${POINTS_API_URL}/auth/login?username=${encodeURIComponent(username)}&ts=${ts}&sig=${encodeURIComponent(signature)}&community=${encodeURIComponent(community)}&message=${encodeURIComponent(message)}`
            );

            if (!res.ok) {
                const errText = await res.text();
                console.error(`[Points] Backend authentication failed (${res.status}):`, errText);
                localStorage.removeItem('pending_points_auth');
                return false;
            }

            const data = await res.json();
            const token = data?.response?.token;
            if (token) {

                setPointsToken(token);
                localStorage.removeItem('pending_points_auth');
                return true;
            }
            console.error('[Points] Token missing in backend response');
            localStorage.removeItem('pending_points_auth');
            return false;
        } catch (e) {
            console.error('[Points] Login failed with error:', e);
            localStorage.removeItem('pending_points_auth');
            return false;
        }
    },

    /**
     * Resume a login that was interrupted by a page refresh (common on mobile).
     */
    resumePendingAuth: async (onChallenge?: (data: { qr: string; uuid: string }) => void): Promise<boolean> => {
        const pending = localStorage.getItem('pending_points_auth');
        if (!pending) return false;

        try {
            const { username, community, method } = JSON.parse(pending);


            // Only HiveAuth needs "resumption" because Keychain is usually synchronous or handled by extension
            if (method !== 'hiveauth') {
                localStorage.removeItem('pending_points_auth');
                return false;
            }

            return await pointsService.loginToPointsBackend(username, community, method, undefined, onChallenge);
        } catch (e) {
            console.error("[Points] Failed to resume pending auth:", e);
            localStorage.removeItem('pending_points_auth');
            return false;
        }
    },

    /**
     * Award points for a user action (fire-and-forget — silent on failure).
     * POST /points  { username, community, communityId, pointType }
     */
    awardPoints: async (
        username: string,
        community: string,
        pointType: PointType,
        communityId?: string
    ): Promise<void> => {
        const token = getPointsToken();
        if (!token) {
            console.warn('[Points] No auth token — skipping award for', pointType);
            return;
        }

        try {
            await fetch(`${POINTS_API_URL}/points`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ username, community, communityId: communityId || community, pointType }),
            });
        } catch (e) {
            console.error('[Points] Award failed:', e);
        }
    },

    /**
     * Fetch the user's points balance for a given community.
     * GET /points?username=&community=
     */
    getUserPoints: async (
        username: string,
        community: string
    ): Promise<PointsBalance[]> => {
        const res = await fetch(
            `${POINTS_API_URL}/points?username=${encodeURIComponent(username)}&community=${encodeURIComponent(community)}`
        );
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Points fetch failed (${res.status})`);
        }
        const data = await res.json();
        return data.userPoints as PointsBalance[];
    },

    /**
     * Fetch the user's points earning history for a given community.
     * GET /points-history/:username/:community
     */
    getPointsHistory: async (
        username: string,
        community: string
    ): Promise<PointsHistoryEntry[]> => {
        const res = await fetch(
            `${POINTS_API_URL}/points-history/${encodeURIComponent(username)}/${encodeURIComponent(community)}`
        );
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `History fetch failed (${res.status})`);
        }
        const data = await res.json();
        return data.data.pointsHistory as PointsHistoryEntry[];
    },
    /**
     * Transfer points to another user.
     * POST /transactions/transfer { senderUsername, receiverUsername, community, amount }
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
                },
                body: JSON.stringify({ senderUsername, receiverUsername, community, amount }),
            });

            const data = await res.json();
            if (res.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.message || 'Transfer failed' };
            }
        } catch (e) {
            console.error('[Points] Transfer failed:', e);
            return { success: false, error: 'Network error or server unavailable' };
        }
    },
};
