import { getHiveProfile } from './hive/client';

export interface HiveWalletToken {
    symbol: string;
    type: 'HIVE' | 'CHAIN';
    meta: {
        show: boolean;
        address?: string;
        publicKey?: string;
        imageUrl?: string;
    };
}

/**
 * Fetches the user's Hive profile and extracts Web3 tokens from posting_json_metadata.
 */
export async function fetchHiveMetadata(username: string): Promise<HiveWalletToken[]> {
    try {
        const account: any = await getHiveProfile(username);
        if (!account) return [];

        let metadata: any = {};
        try {
            metadata = JSON.parse(account.posting_json_metadata || account.json_metadata || '{}');
        } catch (e) {
            try {
                metadata = JSON.parse(account.json_metadata || '{}');
            } catch (e2) {
                metadata = {};
            }
        }

        const tokens = metadata?.profile?.tokens || metadata?.tokens || [];
        return Array.isArray(tokens) ? tokens : [];
    } catch (error) {
        console.error('Failed to fetch Hive metadata:', error);
        return [];
    }
}

/**
 * Updates the user's Hive profile metadata with the provided tokens using Hive Keychain.
 */
export async function updateHiveMetadata(username: string, tokens: HiveWalletToken[]): Promise<any> {
    return new Promise((resolve, reject) => {
        // @ts-ignore - window.hive_keychain
        const keychain = window.hive_keychain;
        if (!keychain) {
            return reject(new Error('Hive Keychain not installed'));
        }

        // 1. Fetch existing profile to preserve other metadata
        getHiveProfile(username).then((account: any) => {
            let metadata: any = {};
            try {
                metadata = JSON.parse(account?.posting_json_metadata || '{}');
            } catch (e) {
                metadata = {};
            }

            // Ensure metadata.profile exists
            if (!metadata.profile) metadata.profile = {};

            // 2. Update tokens
            metadata.profile.tokens = tokens;

            // 3. Prepare broadcast
            const operations = [
                [
                    'account_update2',
                    {
                        account: username,
                        json_metadata: '',
                        posting_json_metadata: JSON.stringify(metadata),
                        extensions: []
                    }
                ]
            ];

            // 4. Broadcast
            keychain.requestBroadcast(
                username,
                operations,
                'Posting',
                (response: any) => {
                    if (response.success) resolve(response);
                    else reject(new Error(response.message || 'Failed to update metadata'));
                }
            );
        }).catch(reject);
    });
}

/**
 * Builds the structure for Hive metadata tokens from raw derived wallets.
 */
export function buildHiveWalletTokens(wallets?: any): HiveWalletToken[] {
    if (!wallets) return [];

    const chains = ['BTC', 'ETH', 'SOL', 'SOL_USDT', 'TRON', 'BNB', 'DOGE', 'LTC', 'APTOS', 'BASE', 'POLYGON', 'ARBITRUM', 'ARB', 'USDT_TRC20', 'USDT_BEP20', 'USDT_ERC20'];

    const tokens: HiveWalletToken[] = [
        { symbol: 'HIVE', type: 'HIVE', meta: { show: true } },
        { symbol: 'HBD', type: 'HIVE', meta: { show: true } },
        { symbol: 'HP', type: 'HIVE', meta: { show: true } },
        { symbol: 'POINTS', type: 'HIVE', meta: { show: true } }
    ];

    chains.forEach((chain) => {
        const data = wallets?.[chain];
        if (!data) return;

        tokens.push({
            symbol: chain,
            type: 'CHAIN',
            meta: {
                show: true,
                address: data.address,
                publicKey: data.publicKey,
                imageUrl: data.imageUrl
            }
        });
    });

    return tokens;
}
