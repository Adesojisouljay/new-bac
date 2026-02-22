const POINTS_API_URL = import.meta.env.VITE_POINTS_API_URL || 'http://localhost:4000';

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
        community: string
    ): Promise<boolean> => {
        try {
            const ts = Date.now().toString();
            const message = `${username}${ts}`;

            // Use the Keychain browser extension directly
            const keychain = (window as any).hive_keychain;
            if (!keychain) return false;

            const signed = await new Promise<{ success: boolean; result: string }>((resolve) => {
                keychain.requestSignBuffer(
                    username,
                    message,
                    'Posting',
                    (resp: any) => resolve(resp)
                );
            });

            if (!signed.success) return false;

            const res = await fetch(
                `${POINTS_API_URL}/auth/login?username=${encodeURIComponent(username)}&ts=${ts}&sig=${encodeURIComponent(signed.result)}&community=${encodeURIComponent(community)}`
            );

            if (!res.ok) return false;

            const data = await res.json();
            const token = data?.response?.token;
            if (token) {
                setPointsToken(token);
                return true;
            }
            return false;
        } catch (e) {
            console.error('[Points] Login failed:', e);
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
};
