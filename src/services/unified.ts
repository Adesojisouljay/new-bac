import { hiveClient } from './hive/client';
import { transactionService, WalletOperation } from '../features/wallet/services/transactionService';

export interface Post {
    id: string;
    author: string;
    permlink: string;
    title: string;
    body: string;
    created: string;
    json_metadata: any;
    // Hive specific fields
    pending_payout_value?: string;
    total_payout_value?: string;
    author_payout_value?: string;
    curator_payout_value?: string;
    beneficiary_payout_value?: string;
    active_votes?: any[];
    children?: number;
    stats?: any;
    reblogged_by?: string[];
    author_reputation?: number;
    community?: string;
    community_title?: string;
    category?: string;
    cashout_time?: string;
    max_accepted_payout?: string;
    percent_hbd?: number;
    // Community role fields from bridge API
    author_role?: string;  // e.g. 'owner', 'admin', 'mod', 'member', 'guest'
    author_title?: string; // Custom title set by community (e.g. 'Lead Dev')
}

export interface Subscriber {
    user: string;
    role: string;
    title: string;
    joined: string;
}

export interface Activity {
    type: string;
    date: string;
    msg: string;
    score?: number;
    id?: number;
}

export interface MarketTicker {
    latest: string;
    lowest_ask: string;
    highest_bid: string;
    percent_change: string;
    hive_volume: string;
    hbd_volume: string;
}

export interface OrderBook {
    bids: { order_price: { base: string; quote: string }; real_price: string }[];
    asks: { order_price: { base: string; quote: string }; real_price: string }[];
}

export interface MarketTrade {
    date: string;
    current_pays: string;
    open_pays: string;
}

export interface TrendingTag {
    id: string;
    title: string;
}

export interface OpenOrder {
    id: number;
    orderid: number;
    created: string;
    sell_price: { base: string; quote: string };
    real_price: string;
    seller: string;
}

export interface CommunityDetails {
    id: string;
    title: string;
    about: string;
    subscribers: number;
    pending_rewards: number | string;
    authors: number;
    team: string[];
    description?: string;
    flag_text?: string;
    is_nsfw?: boolean;
    lang?: string;
    created_at?: string;
    avatar_url?: string;
    cover_url?: string;
    rules?: string; // New field for rules/long description
    roles?: [string, string, string][]; // [username, role, title]
}

export const UnifiedDataService = {
    /**
     * Fetches detailed community information including stats and metadata.
     */
    getCommunityDetails: async (name: string): Promise<CommunityDetails | null> => {
        try {
            // 1. Fetch Bridge Community Data (Stats, Team, Basics)
            const bridgeData = await hiveClient.call('bridge', 'get_community', { name, observer: '' });

            if (!bridgeData) return null;

            // 2. Fetch Account Data (For Avatar/Cover/Bio)
            let avatar_url = '';
            let cover_url = '';

            try {
                const accounts = await hiveClient.database.getAccounts([name]);
                if (accounts.length > 0) {
                    const metadata = JSON.parse(accounts[0].posting_json_metadata || '{}');
                    avatar_url = metadata.profile?.profile_image || '';
                    cover_url = metadata.profile?.cover_image || '';
                }
            } catch (e) {
                console.warn('Failed to fetch community account metadata', e);
            }

            return {
                id: name,
                title: bridgeData.title,
                about: bridgeData.about,
                subscribers: bridgeData.subscribers,
                pending_rewards: bridgeData.sum_pending,
                authors: bridgeData.num_authors,
                team: bridgeData.team ? bridgeData.team.map((t: any) => t[0]) : [], // Extract usernames
                description: bridgeData.description,
                flag_text: bridgeData.flag_text,
                is_nsfw: bridgeData.is_nsfw,
                lang: bridgeData.lang,
                created_at: bridgeData.created,
                avatar_url,
                cover_url,
                rules: bridgeData.flag_text || '', // Use flag_text for rules as identified
                roles: bridgeData.team || []
            };
        } catch (error) {
            console.error('Failed to fetch community details:', error);
            return null;
        }
    },

    /**
     * Lists or searches communities.
     * @param query - Optional search query to filter communities by name/title.
     * @param limit - Max number of communities to return.
     * @param last - Last community name from previous page for pagination.
     */
    listCommunities: async (query: string = '', limit: number = 25, last: string = '') => {
        try {
            const params: any = {
                limit,
                sort: 'rank'
            };

            if (query && query.trim()) {
                params.query = query.trim();
            }
            if (last) {
                params.last = last;
            }

            const result = await hiveClient.call('bridge', 'list_communities', params);
            return (Array.isArray(result) ? result : []);
        } catch (error) {
            console.error('Failed to list communities:', error);
            return [];
        }
    },

    /**
     * Fetches the community feed (discussions)
     */
    getCommunityFeed: async (
        tag: string,
        sort: 'trending' | 'created' | 'hot' | 'promoted' | 'payout' | 'muted' = 'created',
        limit: number = 20,
        start_author?: string,
        start_permlink?: string
    ): Promise<Post[]> => {
        try {
            // 1. Try Off-chain API (simulated for now)
            // return await apiClient.get<Post[]>(`/feed/${tag}?sort=${sort}&limit=${limit}`);
            throw new Error('API not ready');
        } catch (apiError) {
            // 2. Fallback to Hive Bridge API
            try {
                const params: any = {
                    tag: tag === 'global' ? '' : tag,
                    sort,
                    limit: limit, // Strict limit of 20 for Bridge API
                };

                if (start_author && start_permlink) {
                    params.start_author = start_author;
                    params.start_permlink = start_permlink;
                }

                console.log('Bridge API query:', { params });

                // Use bridge.get_ranked_posts for better community feed support
                const result = await hiveClient.call('bridge', 'get_ranked_posts', params);

                if (!result || !Array.isArray(result)) return [];

                // If paginating, drop the first item if it matches start cursor
                // Bridge API also uses inclusive pagination
                let posts = result;
                if (start_author && start_permlink && posts.length > 0) {
                    if (posts[0].author === start_author && posts[0].permlink === start_permlink) {
                        posts = posts.slice(1);
                    }
                }

                return posts.map((post: any) => ({
                    id: `${post.author}/${post.permlink}`,
                    author: post.author,
                    permlink: post.permlink,
                    title: post.title,
                    body: post.body,
                    created: post.created,
                    json_metadata: post.json_metadata, // Bridge API returns object usually, but let's be safe
                    pending_payout_value: post.pending_payout_value,
                    total_payout_value: post.total_payout_value,
                    curator_payout_value: post.curator_payout_value,
                    active_votes: post.active_votes,
                    children: post.children,
                    // Bridge specific fields often include stats
                    stats: post.stats,
                    reblogged_by: post.reblogged_by || [],
                    community: post.community,
                    community_title: post.community_title,
                    author_reputation: UnifiedDataService.formatReputation(post.author_reputation),
                    cashout_time: post.payout_at || post.cashout_time,
                    max_accepted_payout: post.max_accepted_payout || '1000000.000 HBD',
                    percent_hbd: post.percent_hbd || 10000,
                    author_role: post.author_role,
                    author_title: post.author_title
                }));
            } catch (hiveError) {
                console.error('Hive feed fetch failed:', hiveError);
                return [];
            }
        }
    },

    /**
     * Fetches the following feed (posts from people the user follows)
     */
    getFollowingFeed: async (
        username: string,
        limit: number = 20,
        start_author?: string,
        start_permlink?: string
    ): Promise<Post[]> => {
        try {
            const params: any = {
                account: username,
                sort: 'feed',
                limit
            };

            if (start_author && start_permlink) {
                params.start_author = start_author;
                params.start_permlink = start_permlink;
            }

            const result = await hiveClient.call('bridge', 'get_account_posts', params);

            if (!result || !Array.isArray(result)) return [];

            let posts = result;
            if (start_author && start_permlink && posts.length > 0) {
                if (posts[0].author === start_author && posts[0].permlink === start_permlink) {
                    posts = posts.slice(1);
                }
            }

            return posts.map((post: any) => ({
                id: `${post.author}/${post.permlink}`,
                author: post.author,
                permlink: post.permlink,
                title: post.title,
                body: post.body,
                created: post.created,
                json_metadata: post.json_metadata,
                pending_payout_value: post.pending_payout_value,
                total_payout_value: post.total_payout_value,
                curator_payout_value: post.curator_payout_value,
                active_votes: post.active_votes || [],
                children: post.children,
                stats: post.stats,
                reblogged_by: post.reblogged_by || [],
                community: post.community,
                community_title: post.community_title,
                category: post.category,
                author_reputation: UnifiedDataService.formatReputation(post.author_reputation),
                cashout_time: post.payout_at || post.cashout_time,
                max_accepted_payout: post.max_accepted_payout || '1000000.000 HBD',
                percent_hbd: post.percent_hbd || 10000,
                author_role: post.author_role,
                author_title: post.author_title
            }));
        } catch (error) {
            console.error('Failed to fetch following feed:', error);
            return [];
        }
    },

    /**
     * Fetches the list of users that a specific user is following.
     * condenser_api.get_following is paginated with a max limit of 100 per request.
     */
    getFollowing: async (username: string, limit: number = 1000): Promise<string[]> => {
        try {
            let following: string[] = [];
            let startAccount = '';

            while (following.length < limit) {
                const requestLimit = Math.min(100, limit - following.length + (startAccount ? 1 : 0));
                const result = await hiveClient.call('condenser_api', 'get_following', [username, startAccount, 'blog', requestLimit]);

                if (!result || !Array.isArray(result) || result.length === 0) break;

                // If paginating, the first result is the `startAccount` from the previous request
                const accounts = startAccount ? result.slice(1) : result;
                if (accounts.length === 0) break;

                following = following.concat(accounts.map((item: any) => item.following));
                startAccount = result[result.length - 1].following;

                // If we got fewer results than requested, we've reached the end
                if (result.length < requestLimit) break;
            }

            return following;
        } catch (error) {
            console.error('Failed to fetch following list:', error);
            return [];
        }
    },

    /**
     * Fetches the list of communities that a specific user is subscribed to.
     */
    getSubscriptions: async (username: string): Promise<string[]> => {
        try {
            const result = await hiveClient.call('bridge', 'list_all_subscriptions', { account: username });
            if (!result || !Array.isArray(result)) return [];
            return result.map((item: any) => item[0]); // item format: [community_id, title, role, label]
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
            return [];
        }
    },


    /**
     * Fetches a post.
     * Strategy: Try API first (for indexed/faster data), fall back to Hive blockchain.
     */
    getPost: async (author: string, permlink: string): Promise<Post | null> => {
        try {
            // 1. Try Off-chain API (simulated for now)
            // return await apiClient.get<Post>(`/posts/${author}/${permlink}`);
            throw new Error('API not ready');
        } catch (apiError) {
            console.warn('API fetch failed, falling back to Hive:', apiError);

            // 2. Fallback to Hive (Bridge API for richer data)
            try {
                const result: any = await hiveClient.call('bridge', 'get_post', { author, permlink });
                if (!result || result.author === '') {
                    // Fallback to get_content if bridge fails or returns empty (sometimes happens)
                    const fallback: any = await hiveClient.database.call('get_content', [author, permlink]);
                    if (!fallback || fallback.author === '') return null;
                    return {
                        id: `${fallback.author}/${fallback.permlink}`,
                        author: fallback.author,
                        permlink: fallback.permlink,
                        title: fallback.title,
                        body: fallback.body,
                        created: fallback.created,
                        json_metadata: typeof fallback.json_metadata === 'string'
                            ? JSON.parse(fallback.json_metadata || '{}')
                            : fallback.json_metadata,
                        pending_payout_value: fallback.pending_payout_value,
                        total_payout_value: fallback.total_payout_value,
                        author_payout_value: fallback.author_payout_value || fallback.total_payout_value, // Fallback for get_content
                        curator_payout_value: fallback.curator_payout_value,
                        beneficiary_payout_value: fallback.beneficiary_payout_value || '0.000 HBD',
                        active_votes: fallback.active_votes,
                        children: fallback.children,
                        reblogged_by: [], // get_content doesn't have it
                        community: fallback.community,
                        community_title: fallback.community_title,
                        author_reputation: UnifiedDataService.formatReputation(fallback.author_reputation),
                        cashout_time: fallback.cashout_time,
                        max_accepted_payout: fallback.max_accepted_payout,
                        percent_hbd: fallback.percent_hbd
                        // author_role / author_title not available from get_content fallback
                    };
                }

                return {
                    id: `${result.author}/${result.permlink}`,
                    author: result.author,
                    permlink: result.permlink,
                    title: result.title,
                    body: result.body,
                    created: result.created,
                    json_metadata: typeof result.json_metadata === 'string'
                        ? JSON.parse(result.json_metadata || '{}')
                        : result.json_metadata,
                    pending_payout_value: result.pending_payout_value,
                    total_payout_value: result.total_payout_value,
                    author_payout_value: result.author_payout_value,
                    curator_payout_value: result.curator_payout_value,
                    beneficiary_payout_value: result.beneficiary_payout_value,
                    active_votes: result.active_votes,
                    children: result.children,
                    reblogged_by: result.reblogged_by || [],
                    community: result.community,
                    community_title: result.community_title,
                    author_reputation: UnifiedDataService.formatReputation(result.author_reputation),
                    cashout_time: result.payout_at || result.cashout_time,
                    max_accepted_payout: result.max_accepted_payout || '1000000.000 HBD',
                    percent_hbd: result.percent_hbd || 10000,
                    author_role: result.author_role,
                    author_title: result.author_title
                };
            } catch (hiveError) {
                console.error('Hive fetch failed:', hiveError);
                throw hiveError;
            }
        }
    },

    /**
     * Fetches the full list of active votes for a post, including percentages.
     */
    getActiveVotes: async (author: string, permlink: string): Promise<any[]> => {
        try {
            const result = await hiveClient.database.call('get_active_votes', [author, permlink]);
            return Array.isArray(result) ? result : [];
        } catch (error) {
            console.error('Failed to fetch active votes:', error);
            return [];
        }
    },

    /**
     * Fetches the edit history of a post.
     * Searches blockchain history for 'comment' operations matching author/permlink.
     */
    getPostHistory: async (author: string, permlink: string) => {
        try {
            // Fetch account history (author, start_index=-1 for latest, limit=1000)
            const result = await hiveClient.database.getAccountHistory(author, -1, 1000);

            // Filter for comment operations with matching permlink
            const history = result
                .filter((item: any) => {
                    const op = item[1].op;
                    return op[0] === 'comment' && op[1].author === author && op[1].permlink === permlink;
                })
                .map((item: any) => {
                    const op = item[1].op[1];
                    return {
                        timestamp: item[1].timestamp,
                        body: op.body,
                        title: op.title,
                        json_metadata: typeof op.json_metadata === 'string' ? JSON.parse(op.json_metadata || '{}') : op.json_metadata,
                        v: item[0] // Transaction index/version
                    };
                })
                .reverse(); // Latest first

            return history;
        } catch (error) {
            console.error('Failed to fetch post history:', error);
            return [];
        }
    },

    /**
     * Fetches a user profile.
     * Strategy: Get Core Hive data and merge with community-specific metadata from API.
     */
    /**
     * Fetches a user profile using Bridge API for full stats.
     */
    getProfile: async (username: string, observer?: string) => {
        try {
            // Fetch Bridge Data (Best for stats)
            const bridgeProfile = await hiveClient.call('bridge', 'get_profile', {
                account: username,
                observer: observer || undefined
            });

            // Fetch Direct Account Data (Best for latest metadata/images)
            const accounts = await hiveClient.database.getAccounts([username]);

            let name = username;
            let about = '';
            let avatar_url = '';
            let cover_url = '';
            let website = '';
            let location = '';

            // 1. Try Bridge Data First (Baselines)
            if (bridgeProfile) {
                name = bridgeProfile.name || username;
                about = bridgeProfile.metadata?.profile?.about || '';
                avatar_url = bridgeProfile.metadata?.profile?.profile_image || '';
                cover_url = bridgeProfile.metadata?.profile?.cover_image || '';
                website = bridgeProfile.metadata?.profile?.website || '';
                location = bridgeProfile.metadata?.profile?.location || '';
            }

            // 2. Override with Direct Account Data (Prioritize Posting Metadata)
            if (accounts && accounts.length > 0) {
                const account = accounts[0];
                let directMeta: any = {};

                // Parse Posting Metadata (Preferred)
                try {
                    if (account.posting_json_metadata) {
                        directMeta = JSON.parse(account.posting_json_metadata);
                    }
                } catch (e) { /* ignore */ }

                // Fallback to Active Metadata if Posting is empty for profile
                if (!directMeta.profile && account.json_metadata) {
                    try {
                        const jsonMeta = JSON.parse(account.json_metadata);
                        directMeta = { ...jsonMeta, ...directMeta };
                        if (!directMeta.profile) directMeta.profile = jsonMeta.profile;
                    } catch (e) { /* ignore */ }
                }

                // Apply Overrides if present
                if (directMeta.profile) {
                    if (directMeta.profile.name) name = directMeta.profile.name;
                    if (directMeta.profile.about) about = directMeta.profile.about;
                    if (directMeta.profile.profile_image) avatar_url = directMeta.profile.profile_image;
                    if (directMeta.profile.cover_image) cover_url = directMeta.profile.cover_image;
                    if (directMeta.profile.website) website = directMeta.profile.website;
                    if (directMeta.profile.location) location = directMeta.profile.location;
                }
            }

            return {
                name: name,
                created: bridgeProfile?.created || accounts[0]?.created || new Date().toISOString(),
                reputation: UnifiedDataService.formatReputation(bridgeProfile?.reputation || accounts[0]?.reputation),
                stats: {
                    followers: bridgeProfile?.stats?.followers || 0,
                    following: bridgeProfile?.stats?.following || 0,
                    post_count: bridgeProfile?.post_count || accounts[0]?.post_count || 0,
                    rank: bridgeProfile?.stats?.rank || 0
                },
                metadata: {
                    profile: {
                        name,
                        about,
                        profile_image: avatar_url,
                        cover_image: cover_url,
                        website,
                        location,
                        // Some indexers provide a list of communities the user is involved in
                        communities: bridgeProfile?.metadata?.profile?.communities || []
                    },
                    context: bridgeProfile?.context || { followed: false, muted: false }
                },
                avatar_url: avatar_url || `https://images.hive.blog/u/${username}/avatar/large`,
                cover_url: cover_url || '',
            };
        } catch (error) {
            console.error(`Failed to fetch profile for ${username}:`, error);
            // Fallback to minimal profile if everything fails
            return {
                name: username,
                created: new Date().toISOString(),
                reputation: 25,
                stats: { followers: 0, following: 0, post_count: 0, rank: 0 },
                metadata: {},
                avatar_url: `https://images.hive.blog/u/${username}/avatar/large`,
                cover_url: ''
            };
        }
    },

    /**
     * Fetches a user's feed (blog, posts, comments, replies)
     */
    getUserFeed: async (
        username: string,
        type: 'blog' | 'posts' | 'comments' | 'replies' = 'blog',
        limit: number = 20,
        start_author?: string,
        start_permlink?: string
    ): Promise<Post[]> => {
        try {
            const params: any = {
                sort: type,
                account: username,
                limit
            };

            if (start_author && start_permlink) {
                params.start_author = start_author;
                params.start_permlink = start_permlink;
            }

            const result = await hiveClient.call('bridge', 'get_account_posts', params);

            if (!result || !Array.isArray(result)) return [];

            // Bridge pagination is inclusive, so we might need to slice if paginating
            let posts = result;
            if (start_author && start_permlink && posts.length > 0) {
                // Check if first item is the cursor
                if (posts[0].author === start_author && posts[0].permlink === start_permlink) {
                    posts = posts.slice(1);
                }
            }

            return posts.map((post: any) => ({
                id: `${post.author}/${post.permlink}`,
                author: post.author,
                permlink: post.permlink,
                title: post.title,
                body: post.body,
                created: post.created,
                json_metadata: post.json_metadata,
                pending_payout_value: post.pending_payout_value,
                total_payout_value: post.total_payout_value,
                author_payout_value: post.author_payout_value,
                curator_payout_value: post.curator_payout_value,
                active_votes: post.active_votes || [],
                children: post.children,
                stats: post.stats,
                reblogged_by: post.reblogged_by || [],
                community: post.community,
                community_title: post.community_title,
                category: post.category,
                author_reputation: UnifiedDataService.formatReputation(post.author_reputation),
                cashout_time: post.payout_at || post.cashout_time,
                max_accepted_payout: post.max_accepted_payout || '1000000.000 HBD',
                percent_hbd: post.percent_hbd || 10000,
                author_role: post.author_role,
                author_title: post.author_title
            }));

        } catch (error) {
            console.error(`Failed to fetch user ${type}:`, error);
            return [];
        }
    },

    /**
     * Helper to convert raw reputation score to standard 25-70+ scale
     */
    formatReputation: (rawReputation: number | string | undefined): number => {
        if (rawReputation === undefined) return 25;
        let rep = typeof rawReputation === 'string' ? parseFloat(rawReputation) : rawReputation;

        if (isNaN(rep) || rep === 0) return 25;

        // The bridge API often returns already-formatted reputation (e.g. 25, 60, etc)
        // while the core get_accounts returns raw long strings/numbers.
        // Formatted reputation is usually between -100 and 100.
        // Raw reputation is usually a very large number (e.g. 1000000000000).
        if (rep > -100 && rep < 100 && rep !== 0) {
            return Math.floor(rep);
        }

        const isNegative = rep < 0;
        const log = Math.log10(Math.abs(rep));
        let score = log - 9;
        if (isNaN(score) || !isFinite(score)) score = 0;

        score = (isNegative ? -1 : 1) * score * 9 + 25;
        return Math.floor(score);
    },

    /**
     * Fetches user wallet data (balances).
     */
    getWallet: async (username: string) => {
        try {
            const accounts = await hiveClient.database.getAccounts([username]);
            if (!accounts || accounts.length === 0) return null;

            const account = accounts[0];
            const rc = await UnifiedDataService.getRC(username);

            // Fetch global properties for VESTS to HP conversion
            const props = await hiveClient.database.getDynamicGlobalProperties();

            // Fetch HIVE price for estimation
            let hivePrice = 0;
            try {
                const ticker = await UnifiedDataService.getMarketTicker();
                if (ticker) hivePrice = parseFloat(ticker.latest);
            } catch (e) { console.warn('Failed to fetch hive price for wallet estimation', e); }

            return {
                balance: account.balance,
                hbd_balance: account.hbd_balance,
                savings_balance: account.savings_balance,
                savings_hbd_balance: account.savings_hbd_balance,
                vesting_shares: account.vesting_shares,
                delegated_vesting_shares: account.delegated_vesting_shares,
                received_vesting_shares: account.received_vesting_shares,
                // Power down fields
                to_withdraw: account.to_withdraw,
                withdrawn: account.withdrawn,
                vesting_withdraw_rate: account.vesting_withdraw_rate,
                next_vesting_withdrawal: account.next_vesting_withdrawal,
                rc,
                hive_price: hivePrice,
                globalProps: {
                    total_vesting_fund_hive: props.total_vesting_fund_hive,
                    total_vesting_shares: props.total_vesting_shares,
                    hbd_interest_rate: props.hbd_interest_rate
                }
            };
        } catch (error) {
            console.error(`Failed to fetch wallet for ${username}:`, error);
            return null;
        }
    },

    /**
     * Fetches Resource Credits (RC) for a user
     */
    getRC: async (username: string) => {
        try {
            const result = await hiveClient.call('rc_api', 'find_rc_accounts', { accounts: [username] });
            if (!result || !result.rc_accounts || result.rc_accounts.length === 0) return null;

            const rcAccount = result.rc_accounts[0];
            const maxMana = parseFloat(rcAccount.max_rc);
            const currentMana = parseFloat(rcAccount.rc_manabar.current_mana);
            const percentage = maxMana > 0 ? (currentMana / maxMana) * 100 : 0;

            return {
                current: currentMana,
                max: maxMana,
                percentage: percentage.toFixed(2),
                delegated_outbound: rcAccount.delegated_rc || "0",
                received_inbound: rcAccount.received_delegated_rc || "0"
            };
        } catch (error) {
            console.error(`Failed to fetch RC for ${username}:`, error);
            return null;
        }
    },

    /**
     * Fetches account history.
     * @param start - Sequence number to start from (-1 for most recent)
     * @param limit - Number of transactions to return
     */
    getAccountHistory: async (username: string, start: number = -1, limit: number = 20) => {
        try {
            const result = await hiveClient.call('condenser_api', 'get_account_history', [username, start, limit]);
            if (!result || !Array.isArray(result)) return [];

            return result.map((item: any) => {
                const [id, tx] = item;
                return {
                    id,
                    timestamp: tx.timestamp,
                    type: tx.op[0],
                    data: tx.op[1],
                    trx_id: tx.trx_id
                };
            }).reverse(); // Most recent first
        } catch (error) {
            console.error(`Failed to fetch history for ${username}:`, error);
            return [];
        }
    },

    /**
     * Fetches comments for a post (immediate children).
     */
    getComments: async (author: string, permlink: string): Promise<Post[]> => {
        try {
            const result = await hiveClient.database.call('get_content_replies', [author, permlink]);
            if (!result || !Array.isArray(result)) return [];

            return result.map((post: any) => ({
                id: `${post.author}/${post.permlink}`,
                author: post.author,
                permlink: post.permlink,
                title: post.title,
                body: post.body,
                created: post.created,
                json_metadata: post.json_metadata,
                pending_payout_value: post.pending_payout_value,
                total_payout_value: post.total_payout_value,
                curator_payout_value: post.curator_payout_value,
                children: post.children,
                active_votes: post.active_votes || [],
                reblogged_by: post.reblogged_by || [],
                community: post.community,
                community_title: post.community_title,
                author_reputation: UnifiedDataService.formatReputation(post.author_reputation)
            }));
        } catch (error) {
            console.error(`Failed to fetch comments for ${author}/${permlink}:`, error);
            return [];
        }
    },

    /**
     * Fetches user posts specifically within a community.
     * Note: Bridge API doesn't support direct filtering, so we filter locally.
     */
    getUserCommunityPosts: async (
        username: string,
        communityId: string,
        limit: number = 20,
        start_author?: string,
        start_permlink?: string
    ): Promise<Post[]> => {
        try {
            let filteredPosts: Post[] = [];
            let current_start_author = start_author;
            let current_start_permlink = start_permlink;
            const FETCH_BATCH_SIZE = 20; // Reverted to 20 due to strict API limits on some nodes

            // We fetch in batches until we find enough community posts or run out of history
            // To prevent hanging, we limit the number of attempts
            let attempts = 0;
            const MAX_ATTEMPTS = 15; // Increased attempts to compensate for smaller batches

            const cleanUsername = username.toLowerCase();
            while (filteredPosts.length < limit && attempts < MAX_ATTEMPTS) {
                attempts++;
                const result = await UnifiedDataService.getUserFeed(
                    cleanUsername,
                    'posts', // Switch back to posts to avoid reblog noise
                    FETCH_BATCH_SIZE,
                    current_start_author,
                    current_start_permlink
                );

                if (!result || result.length === 0) break;

                // Filter for this community - check both community and category (case-insensitive)
                const targetId = communityId.toLowerCase();
                const batchFiltered = result.filter((post: Post) =>
                    post.community?.toLowerCase() === targetId ||
                    post.category?.toLowerCase() === targetId
                );
                filteredPosts = [...filteredPosts, ...batchFiltered];

                // Update pagination cursors
                const lastPost = result[result.length - 1];
                current_start_author = lastPost.author;
                current_start_permlink = lastPost.permlink;

                // If result < FETCH_BATCH_SIZE, it means we reached the end
                if (result.length < FETCH_BATCH_SIZE - 5) break;
            }

            // Slice to exactly the requested limit
            return filteredPosts.slice(0, limit);

        } catch (error) {
            console.error(`Failed to fetch community posts for ${username}:`, error);
            return [];
        }
    },

    /**
     * Follows or unfollows a user
     */
    followUser: async (follower: string, following: string, isFollowing: boolean): Promise<boolean> => {
        try {
            const op: WalletOperation = {
                type: 'follow',
                username: follower,
                follower,
                following,
                isFollowing
            };
            const result = await transactionService.broadcast(op);
            if (!result.success) {
                console.error('Follow operation failed:', result.error);
            }
            return result.success;
        } catch (error) {
            console.error('Follow operation threw an error:', error);
            return false;
        }
    },

    /**
     * Mutes or unmutes a user
     */
    muteUser: async (follower: string, following: string, isMuted: boolean): Promise<boolean> => {
        try {
            // Muting uses the same follow operation structure, but with what: ['ignore'] (or [] for unmute)
            // For now, transactionService handles follow/unfollow. 
            // We can extend it for mute if needed, but for now we'll construct the follow op 
            // and assume we need to extend the transactionService to explicitly handle mute state if it diverges from isFollowing structure.
            // Actually, looking at transactionService, follow expects isFollowing boolean to set 'blog' or [].
            // To properly support mute, we would need to edit transactionService FollowOperation to support 'ignore'.
            // For now, we will leave the direct keychain call for MUTE to avoid breaking changes, 
            // since the user's primary request is about following and joining communities.
            return new Promise((resolve) => {
                const keychain = (window as any).hive_keychain;
                if (!keychain) {
                    console.error('Hive Keychain not found');
                    resolve(false);
                    return;
                }

                const json = JSON.stringify([
                    'follow',
                    {
                        follower,
                        following,
                        what: isMuted ? ['ignore'] : [] // Empty array means unmute
                    }
                ]);

                keychain.requestCustomJson(
                    follower,
                    'follow',
                    'Posting',
                    json,
                    isMuted ? `Muting ${following}...` : `Unmuting ${following}...`,
                    (response: any) => {
                        if (response.success) {
                            resolve(true);
                        } else {
                            console.error('Mute operation failed:', response.message);
                            resolve(false);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Mute operation threw an error:', error);
            return false;
        }
    },

    /**
     * Fetches community subscribers.
     */
    getCommunitySubscribers: async (
        community: string,
        limit: number = 50,
        last?: string
    ): Promise<Subscriber[]> => {
        try {
            const params: any = { community, limit };
            if (last) params.last = last;

            const result = await hiveClient.call('bridge', 'list_subscribers', params);
            if (!result || !Array.isArray(result)) return [];

            return result.map((sub: any) => ({
                user: sub[0],
                role: sub[1],
                title: sub[2],
                joined: sub[3]
            }));
        } catch (error) {
            console.error(`Failed to fetch subscribers for ${community}:`, error);
            return [];
        }
    },

    /**
     * Fetches community activities via account notifications.
     */
    getCommunityActivities: async (
        community: string,
        limit: number = 20,
        last_id?: number
    ): Promise<Activity[]> => {
        try {
            const params: any = { account: community, limit };
            if (last_id) params.last_id = last_id;

            const result = await hiveClient.call('bridge', 'account_notifications', params);
            if (!result || !Array.isArray(result)) return [];

            return result.map((n: any) => ({
                type: n.type,
                date: n.date,
                msg: n.msg,
                score: n.score,
                id: n.id
            }));
        } catch (error) {
            console.error(`Failed to fetch activities for ${community}:`, error);
            return [];
        }
    },

    /**
     * Internal Market Methods
     */
    getMarketTicker: async (): Promise<MarketTicker | null> => {
        try {
            return await hiveClient.call('condenser_api', 'get_ticker', []);
        } catch (error) {
            console.error('Failed to fetch market ticker:', error);
            return null;
        }
    },

    getMarketOrderBook: async (limit: number = 20): Promise<OrderBook | null> => {
        try {
            return await hiveClient.call('condenser_api', 'get_order_book', [limit]);
        } catch (error) {
            console.error('Failed to fetch market order book:', error);
            return null;
        }
    },

    getMarketRecentTrades: async (limit: number = 20): Promise<MarketTrade[]> => {
        try {
            return await hiveClient.call('condenser_api', 'get_recent_trades', [limit]);
        } catch (error) {
            console.error('Failed to fetch market recent trades:', error);
            return [];
        }
    },

    getOpenOrders: async (username: string): Promise<OpenOrder[]> => {
        try {
            return await hiveClient.call('condenser_api', 'get_open_orders', [username]);
        } catch (error) {
            console.error(`Failed to fetch open orders for ${username}:`, error);
            return [];
        }
    },

    /**
     * Fetches a list of trending/active communities.
     */
    getTrendingCommunities: async (limit: number = 10, query: string = ''): Promise<CommunityDetails[]> => {
        try {
            const params: any = {
                limit,
                sort: 'rank'
            };

            if (query.trim()) {
                params.query = query.trim();
            }

            const result = await hiveClient.call('bridge', 'list_communities', params);

            if (!result || !Array.isArray(result)) return [];

            return result.map((c: any) => ({
                id: c.name,
                name: c.name,
                title: c.title,
                about: c.about,
                subscribers: c.subscribers,
                pending_rewards: c.sum_pending,
                authors: c.num_authors,
                team: [], // list_communities doesn't return team
                avatar_url: `https://images.hive.blog/u/${c.name}/avatar/small`,
            }));
        } catch (error) {
            console.error('Failed to fetch trending communities:', error);
            return [];
        }
    },

    /**
     * Fetches global Hive market data.
     */
    getHiveGlobals: async () => {
        try {
            const ticker = await UnifiedDataService.getMarketTicker();
            const props = await hiveClient.database.getDynamicGlobalProperties();

            return {
                ticker,
                props
            };
        } catch (error) {
            console.error('Failed to fetch hive globals:', error);
            return null;
        }
    },

    /**
     * Fetches suggested users to follow based on trending activity.
     */
    getSuggestedUsers: async (limit: number = 5): Promise<{ username: string; reputation: number; avatar_url: string }[]> => {
        try {
            const trendingPosts = await UnifiedDataService.getCommunityFeed('global', 'trending', 20);
            const uniqueAuthors = new Map<string, { username: string; reputation: number; avatar_url: string }>();

            for (const post of trendingPosts) {
                if (!uniqueAuthors.has(post.author) && uniqueAuthors.size < limit) {
                    uniqueAuthors.set(post.author, {
                        username: post.author,
                        reputation: post.author_reputation || 25,
                        avatar_url: `https://images.hive.blog/u/${post.author}/avatar/small`
                    });
                }
            }

            return Array.from(uniqueAuthors.values());
        } catch (error) {
            console.error('Failed to fetch suggested users:', error);
            return [];
        }
    },

    /**
     * Searches for Hive profiles by username prefix.
     */
    searchProfiles: async (query: string, limit: number = 10): Promise<{ username: string; reputation: number; avatar_url: string }[]> => {
        try {
            if (!query.trim()) return [];
            const usernames = await hiveClient.call('condenser_api', 'lookup_accounts', [query.toLowerCase().trim(), limit]);

            if (!Array.isArray(usernames)) return [];

            // For now, return basic info. We could fetch full accounts here if needed,
            // but for a search list, username and avatar (generated) are often enough.
            return usernames.map(username => ({
                username,
                reputation: 25, // Default or fetch if needed
                avatar_url: `https://images.hive.blog/u/${username}/avatar/small`
            }));
        } catch (error) {
            console.error('Failed to search profiles:', error);
            return [];
        }
    },

    /**
     * Fetches trending topics (tags).
     */
    getTrendingTags: async (limit: number = 20): Promise<TrendingTag[]> => {
        try {
            const result = await hiveClient.call('bridge', 'get_trending_topics', {
                limit,
                observer: ''
            });

            if (!result || !Array.isArray(result)) return [];

            // Map the [id, title] array format seen in logs
            return result.map((item: any) => {
                if (Array.isArray(item) && item.length >= 2) {
                    return { id: item[0], title: item[1] };
                }
                if (typeof item === 'string') {
                    return { id: item, title: item };
                }
                if (item && typeof item === 'object') {
                    const id = item.name || item.word || item.tag || '';
                    const title = item.title || id;
                    return { id, title };
                }
                return { id: '', title: '' };
            }).filter(t => t.id !== '');
        } catch (error) {
            console.error('Failed to fetch trending tags:', error);
            return [];
        }
    },

    /**
     * Subscribes to a community
     */
    subscribeCommunity: async (username: string, communityId: string): Promise<boolean> => {
        try {
            const op: WalletOperation = {
                type: 'subscribe',
                username,
                community: communityId,
                isSubscribing: true
            };
            const result = await transactionService.broadcast(op);
            if (!result.success) {
                console.error('Subscribe operation failed:', result.error);
            }
            return result.success;
        } catch (error) {
            console.error('Subscribe operation threw an error:', error);
            return false;
        }
    },

    /**
     * Unsubscribes from a community
     */
    unsubscribeCommunity: async (username: string, communityId: string): Promise<boolean> => {
        try {
            const op: WalletOperation = {
                type: 'subscribe',
                username,
                community: communityId,
                isSubscribing: false
            };
            const result = await transactionService.broadcast(op);
            if (!result.success) {
                console.error('Unsubscribe operation failed:', result.error);
            }
            return result.success;
        } catch (error) {
            console.error('Unsubscribe operation threw an error:', error);
            return false;
        }
    }
};
