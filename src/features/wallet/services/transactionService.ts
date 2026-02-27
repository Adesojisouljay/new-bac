import { KeychainSDK } from 'keychain-sdk';

const keychain = new KeychainSDK(window);

// Types for wallet operations
export type OperationType = 'transfer' | 'power_up' | 'power_down' | 'delegate' | 'delegate_rc' | 'deposit_savings' | 'withdraw_savings' | 'vote' | 'comment' | 'reblog' | 'limit_order_create' | 'limit_order_cancel' | 'witness_vote' | 'proposal_vote' | 'messaging' | 'follow' | 'subscribe';

interface BaseOperation {
    username: string;
}

interface FollowOperation extends BaseOperation {
    type: 'follow';
    follower: string;
    following: string;
    isFollowing: boolean;
}

interface SubscribeOperation extends BaseOperation {
    type: 'subscribe';
    community: string;
    isSubscribing: boolean;
}

interface TransferOperation extends BaseOperation {
    type: 'transfer';
    to: string;
    amount: string;
    memo: string;
    currency: 'HIVE' | 'HBD';
}

interface PowerUpOperation extends BaseOperation {
    type: 'power_up';
    to: string;
    amount: string;
}

interface PowerDownOperation extends BaseOperation {
    type: 'power_down';
    amount: string;
}

interface DelegateOperation extends BaseOperation {
    type: 'delegate';
    delegatee: string;
    amount: string;
}

interface DelegateRCOperation extends BaseOperation {
    type: 'delegate_rc';
    delegatee: string;
    amount: number; // For RC it's usually a large number, not unit string
}

interface SavingsOperation extends BaseOperation {
    type: 'deposit_savings' | 'withdraw_savings';
    to: string;
    amount: string;
    request_id?: number; // Only for withdraw
}

interface ProfileUpdateOperation extends BaseOperation {
    type: 'profile_update';
    profile: {
        name?: string;
        about?: string;
        location?: string;
        website?: string;
        profile_image?: string;
        cover_image?: string;
    };
}

interface VoteOperation extends BaseOperation {
    type: 'vote';
    author: string;
    permlink: string;
    weight: number; // 10000 = 100%
}

interface CommentOperation extends BaseOperation {
    type: 'comment';
    parent_author: string;
    parent_permlink: string;
    permlink: string;
    title: string;
    body: string;
    json_metadata: string;
    options?: {
        max_accepted_payout: string;
        percent_hbd: number;
        allow_votes: boolean;
        allow_curation_rewards: boolean;
        beneficiaries: { account: string; weight: number }[];
    };
}

interface ReblogOperation extends BaseOperation {
    type: 'reblog';
    author: string;
    permlink: string;
}

interface LimitOrderCreateOperation extends BaseOperation {
    type: 'limit_order_create';
    amount_to_sell: string; // "10.000 HIVE" or "1.000 HBD"
    min_to_receive: string;
    fill_or_kill: boolean;
    expiration: string;
    orderid: number;
}

interface LimitOrderCancelOperation extends BaseOperation {
    type: 'limit_order_cancel';
    orderid: number;
}

interface WitnessVoteOperation extends BaseOperation {
    type: 'witness_vote';
    witness: string;
    approve: boolean;
}

interface ProposalVoteOperation extends BaseOperation {
    type: 'proposal_vote';
    proposal_ids: number[];
    approve: boolean;
}

interface MessagingOperation extends BaseOperation {
    type: 'messaging';
    to: string;
    message: string;
}

export type WalletOperation = TransferOperation | PowerUpOperation | PowerDownOperation | DelegateOperation | DelegateRCOperation | SavingsOperation | ProfileUpdateOperation | VoteOperation | CommentOperation | ReblogOperation | LimitOrderCreateOperation | LimitOrderCancelOperation | WitnessVoteOperation | ProposalVoteOperation | MessagingOperation | FollowOperation | SubscribeOperation;

export const transactionService = {
    /**
     * Broadcasts a wallet operation using the active login method (Keychain or HiveAuth)
     */
    broadcast: async (
        op: WalletOperation,
        onAuthChallenge?: (data: { qr: string; uuid: string }) => void
    ): Promise<{ success: boolean; result?: any; error?: string }> => {
        // Detect login method from localStorage
        const method = localStorage.getItem('hive_auth_method') || 'keychain';
        const username = op.username;

        // Check if this is a Posting-level operation that can be relayed
        const postingOps = ['vote', 'comment', 'reblog', 'profile_update', 'delegate_rc', 'messaging', 'follow', 'subscribe'];

        if (postingOps.includes(op.type)) {
            const relayAccount = 'breakaway.app';
            const { authService } = await import('../../auth/services/authService');
            console.log(`[Transaction] Checking delegation for ${username} to ${relayAccount}...`);
            const isDelegated = await authService.checkDelegation(username, relayAccount);
            console.log(`[Transaction] isDelegated: ${isDelegated}`);

            if (isDelegated) {
                console.log(`🚀 [Relay] Attempting broadcast for ${op.type} via platform relay...`);
                const relayResult = await transactionService.broadcastRelay(op);
                if (relayResult.success) {
                    return relayResult;
                }
                console.warn(`[Relay] Relay failed, falling back to standard signature: ${relayResult.error}`);
                // Continue to standard broadcast below
            }
        }

        if (method === 'keychain') {
            return transactionService.broadcastKeychain(op);
        } else {
            if (!onAuthChallenge) {
                return { success: false, error: "HiveAuth requires a callback for QR code" };
            }
            return transactionService.broadcastHAS(op, onAuthChallenge);
        }
    },

    /**
     * Broadcasts using the platform's relay account
     */
    broadcastRelay: async (op: WalletOperation): Promise<{ success: boolean; result?: any; error?: string }> => {
        try {
            const token = localStorage.getItem('points_auth_token');
            console.log(`[Relay] Using token: ${token ? (token.substring(0, 10) + '...') : 'NULL'}`);
            if (!token) {
                return { success: false, error: "Authentication token missing. Please try logging in again." };
            }

            // Convert WalletOperation to Hive Operation array
            let hiveOps: any[] = [];
            switch (op.type) {
                case 'vote':
                    hiveOps = [["vote", { voter: op.username, author: op.author, permlink: op.permlink, weight: op.weight }]];
                    break;
                case 'comment':
                    const comment = ["comment", {
                        parent_author: op.parent_author,
                        parent_permlink: op.parent_permlink,
                        author: op.username,
                        permlink: op.permlink,
                        title: op.title,
                        body: op.body,
                        json_metadata: op.json_metadata
                    }];
                    hiveOps = [comment];
                    if (op.options) {
                        hiveOps.push(["comment_options", {
                            author: op.username,
                            permlink: op.permlink,
                            max_accepted_payout: op.options.max_accepted_payout,
                            percent_hbd: op.options.percent_hbd,
                            allow_votes: op.options.allow_votes,
                            allow_curation_rewards: op.options.allow_curation_rewards,
                            extensions: [[0, { beneficiaries: op.options.beneficiaries }]]
                        }]);
                    }
                    break;
                case 'reblog':
                    hiveOps = [["custom_json", {
                        required_auths: [],
                        required_posting_auths: [op.username],
                        id: 'follow',
                        json: JSON.stringify(['reblog', { account: op.username, author: op.author, permlink: op.permlink }])
                    }]];
                    break;
                case 'profile_update':
                    hiveOps = [["account_update2", {
                        account: op.username,
                        json_metadata: "",
                        posting_json_metadata: JSON.stringify({ profile: op.profile })
                    }]];
                    break;
                case 'delegate_rc': {
                    const delegateOp = op as DelegateRCOperation;
                    hiveOps = [["custom_json", {
                        required_auths: [],
                        required_posting_auths: [op.username],
                        id: "rc",
                        json: JSON.stringify(["delegate_rc", { from: op.username, delegatees: [delegateOp.delegatee], max_rc: delegateOp.amount }])
                    }]];
                    break;
                }
                case 'messaging': {
                    const msgOp = op as MessagingOperation;
                    hiveOps = [["custom_json", {
                        required_auths: [],
                        required_posting_auths: [op.username],
                        id: "messaging",
                        json: JSON.stringify(["message", { to: msgOp.to, message: msgOp.message, v: '1.0' }])
                    }]];
                    break;
                }
                case 'follow': {
                    const followOp = op as FollowOperation;
                    hiveOps = [["custom_json", {
                        required_auths: [],
                        required_posting_auths: [op.username],
                        id: "follow",
                        json: JSON.stringify(["follow", { follower: followOp.follower, following: followOp.following, what: followOp.isFollowing ? ['blog'] : [] }])
                    }]];
                    break;
                }
                case 'subscribe': {
                    const subOp = op as SubscribeOperation;
                    hiveOps = [["custom_json", {
                        required_auths: [],
                        required_posting_auths: [op.username],
                        id: "community",
                        json: JSON.stringify([subOp.isSubscribing ? 'subscribe' : 'unsubscribe', { community: subOp.community }])
                    }]];
                    break;
                }
                default:
                    return { success: false, error: "Operation type not supported by relay" };
            }

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/hive/relay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: op.username,
                    operations: hiveOps
                })
            });

            const data = await response.json();
            if (data.success) {
                return { success: true, result: data.result };
            } else {
                return { success: false, error: data.error || "Relay broadcast failed" };
            }
        } catch (error: any) {
            console.error("Relay Broadcast Error:", error);
            return { success: false, error: error.message || "Network error during relay broadcast" };
        }
    },

    broadcastKeychain: async (op: WalletOperation) => {
        if (!(window as any).hive_keychain) {
            return { success: false, error: "Hive Keychain not installed" };
        }

        try {
            let result;
            switch (op.type) {
                case 'transfer':
                    result = await keychain.transfer({
                        username: op.username,
                        to: op.to,
                        amount: op.amount,
                        memo: op.memo,
                        currency: op.currency,
                        enforce: false
                    });
                    break;
                case 'power_up':
                    result = await keychain.powerUp({
                        username: op.username,
                        to: op.to,
                        hive: op.amount,
                    } as any);
                    break;
                case 'power_down':
                    result = await keychain.powerDown({
                        username: op.username,
                        hive_power: op.amount,
                    });
                    break;
                case 'delegate':
                    result = await keychain.delegation({
                        username: op.username,
                        delegatee: op.delegatee,
                        amount: op.amount,
                        unit: 'HP'
                    });
                    break;
                case 'delegate_rc':
                    const rcDelegateOp = [
                        "custom_json",
                        {
                            required_auths: [],
                            required_posting_auths: [op.username],
                            id: "rc",
                            json: JSON.stringify([
                                "delegate_rc",
                                {
                                    from: op.username,
                                    delegatees: [op.delegatee],
                                    max_rc: op.amount
                                }
                            ])
                        }
                    ];
                    result = await keychain.broadcast({
                        username: op.username,
                        operations: [rcDelegateOp as any],
                        method: "Posting" as any
                    });
                    break;
                case 'witness_vote':
                    result = await keychain.witnessVote({
                        username: op.username,
                        witness: op.witness,
                        vote: op.approve
                    });
                    break;
                case 'proposal_vote':
                    const proposalOp = [
                        "update_proposal_votes",
                        {
                            voter: op.username,
                            proposal_ids: op.proposal_ids,
                            approve: op.approve,
                            extensions: []
                        }
                    ];
                    result = await keychain.broadcast({
                        username: op.username,
                        operations: [proposalOp as any],
                        method: "Active" as any
                    });
                    break;
                case 'deposit_savings':
                case 'withdraw_savings':
                    const savingsOp = op.type === 'deposit_savings'
                        ? [
                            "transfer_to_savings",
                            {
                                from: op.username,
                                to: op.to,
                                amount: op.amount,
                                memo: ""
                            }
                        ]
                        : [
                            "transfer_from_savings",
                            {
                                from: op.username,
                                request_id: op.request_id || Math.floor(Date.now() / 1000),
                                to: op.to,
                                amount: op.amount,
                                memo: ""
                            }
                        ];

                    result = await keychain.broadcast({
                        username: op.username,
                        operations: [savingsOp as any],
                        method: "Active" as any
                    });
                    break;
                case 'profile_update':
                    const updateOp = [
                        "account_update2",
                        {
                            account: op.username,
                            json_metadata: "",
                            posting_json_metadata: JSON.stringify({ profile: op.profile })
                        }
                    ];

                    result = await keychain.broadcast({
                        username: op.username,
                        operations: [updateOp as any],
                        method: "Posting" as any
                    });
                    break;
                case 'vote':
                    result = await keychain.vote({
                        username: op.username,
                        author: op.author,
                        permlink: op.permlink,
                        weight: op.weight
                    });
                    break;
                case 'comment':
                    // Keychain 'post' method handles comment_options via 'options' param if supported,
                    // but 'post' signature is specific. It accepts arguments, not a generic object in some ver.
                    // Safer to use generic 'broadcast' if options are involved, or check SDK.
                    // SDK Signature for post: (username, title, body, parent_perm, parent_username, json_metadata, permlink, comment_options)

                    if (op.options) {
                        // Use broadcast for complex operations to ensure comment_options is bundled
                        const commentOp = [
                            "comment",
                            {
                                parent_author: op.parent_author,
                                parent_permlink: op.parent_permlink,
                                author: op.username,
                                permlink: op.permlink,
                                title: op.title,
                                body: op.body,
                                json_metadata: op.json_metadata
                            }
                        ];

                        const optionsOp = [
                            "comment_options",
                            {
                                author: op.username,
                                permlink: op.permlink,
                                max_accepted_payout: op.options.max_accepted_payout,
                                percent_hbd: op.options.percent_hbd,
                                allow_votes: op.options.allow_votes,
                                allow_curation_rewards: op.options.allow_curation_rewards,
                                extensions: [
                                    [0, { beneficiaries: op.options.beneficiaries }]
                                ]
                            }
                        ];

                        result = await keychain.broadcast({
                            username: op.username,
                            operations: [commentOp as any, optionsOp as any],
                            method: "Posting" as any
                        });

                    } else {
                        // Standard post
                        result = await keychain.post({
                            username: op.username,
                            title: op.title,
                            body: op.body,
                            parent_perm: op.parent_permlink,
                            parent_username: op.parent_author,
                            json_metadata: op.json_metadata,
                            permlink: op.permlink,
                            to: op.parent_author
                        } as any);
                    }
                    break;
                case 'reblog':
                    const customJson = {
                        required_auths: [],
                        required_posting_auths: [op.username],
                        id: 'follow',
                        json: JSON.stringify([
                            'reblog',
                            {
                                account: op.username,
                                author: op.author,
                                permlink: op.permlink
                            }
                        ])
                    };
                    result = await keychain.custom({
                        username: op.username,
                        id: customJson.id,
                        method: 'Posting' as any,
                        json: customJson.json,
                        display_msg: 'Reblog Post'
                    });
                    break;
                case 'limit_order_create':
                    const createOrderOp = [
                        "limit_order_create",
                        {
                            owner: op.username,
                            orderid: op.orderid,
                            amount_to_sell: op.amount_to_sell,
                            min_to_receive: op.min_to_receive,
                            fill_or_kill: op.fill_or_kill,
                            expiration: op.expiration
                        }
                    ];
                    result = await keychain.broadcast({
                        username: op.username,
                        operations: [createOrderOp as any],
                        method: "Active" as any
                    });
                    break;
                case 'limit_order_cancel':
                    const cancelOrderOp = [
                        "limit_order_cancel",
                        {
                            owner: op.username,
                            orderid: op.orderid
                        }
                    ];
                    result = await keychain.broadcast({
                        username: op.username,
                        operations: [cancelOrderOp as any],
                        method: "Active" as any
                    });
                    break;
                case 'messaging':
                    const msgJson = JSON.stringify(["message", { to: op.to, message: op.message, v: '1.0' }]);
                    result = await keychain.custom({
                        username: op.username,
                        id: 'messaging',
                        method: 'Posting' as any,
                        json: msgJson,
                        display_msg: 'Send Private Message'
                    });
                    break;
                case 'follow': {
                    const followOp = op as FollowOperation;
                    const json = JSON.stringify(["follow", { follower: followOp.follower, following: followOp.following, what: followOp.isFollowing ? ['blog'] : [] }]);
                    result = await keychain.custom({
                        username: op.username,
                        id: 'follow',
                        method: 'Posting' as any,
                        json: json,
                        display_msg: followOp.isFollowing ? `Follow ${followOp.following}` : `Unfollow ${followOp.following}`
                    });
                    break;
                }
                case 'subscribe': {
                    const subOp = op as SubscribeOperation;
                    const json = JSON.stringify([subOp.isSubscribing ? 'subscribe' : 'unsubscribe', { community: subOp.community }]);
                    result = await keychain.custom({
                        username: op.username,
                        id: 'community',
                        method: 'Posting' as any,
                        json: json,
                        display_msg: subOp.isSubscribing ? `Join ${subOp.community}` : `Leave ${subOp.community}`
                    });
                    break;
                }
            }

            return result as { success: boolean; result?: any; error?: string };

        } catch (error: any) {
            return { success: false, error: error.message || "Keychain interaction failed" };
        }
    },

    broadcastHAS: async (
        op: WalletOperation,
        onAuthChallenge: (data: { qr: string; uuid: string }) => void
    ): Promise<{ success: boolean; result?: any; error?: string }> => {
        // Construct the Hive Operation JSON
        let operation: any[] = [];
        let keyType = 'active';

        switch (op.type) {
            case 'transfer':
                operation = [["transfer", {
                    from: op.username,
                    to: op.to,
                    amount: `${op.amount} ${op.currency}`,
                    memo: op.memo
                }]];
                break;
            case 'power_up':
                operation = [["transfer_to_vesting", {
                    from: op.username,
                    to: op.to,
                    amount: `${op.amount} HIVE`
                }]];
                break;
            case 'power_down':
                operation = [["withdraw_vesting", {
                    account: op.username,
                    vesting_shares: `${op.amount} VESTS`
                }]];
                break;
            case 'delegate':
                operation = [["delegate_vesting_shares", {
                    delegator: op.username,
                    delegatee: op.delegatee,
                    vesting_shares: `${op.amount} VESTS`
                }]];
                break;
            case 'delegate_rc':
                operation = [["custom_json", {
                    required_auths: [],
                    required_posting_auths: [op.username],
                    id: "rc",
                    json: JSON.stringify([
                        "delegate_rc",
                        {
                            from: op.username,
                            delegatees: [op.delegatee],
                            max_rc: op.amount
                        }
                    ])
                }]];
                keyType = 'posting';
                break;
            case 'deposit_savings':
                operation = [["transfer_to_savings", {
                    from: op.username,
                    to: op.to,
                    amount: op.amount,
                    memo: ""
                }]];
                break;
            case 'withdraw_savings':
                operation = [["transfer_from_savings", {
                    from: op.username,
                    request_id: op.request_id || Math.floor(Date.now() / 1000),
                    to: op.to,
                    amount: op.amount,
                    memo: ""
                }]];
                break;
            case 'profile_update':
                operation = [["account_update2", {
                    account: op.username,
                    json_metadata: "",
                    posting_json_metadata: JSON.stringify({ profile: op.profile })
                }]];
                keyType = 'posting';
                break;
            case 'vote':
                operation = [["vote", {
                    voter: op.username,
                    author: op.author,
                    permlink: op.permlink,
                    weight: op.weight
                }]];
                keyType = 'posting';
                break;
            case 'comment':
                const commentOp = ["comment", {
                    parent_author: op.parent_author,
                    parent_permlink: op.parent_permlink,
                    author: op.username,
                    permlink: op.permlink,
                    title: op.title,
                    body: op.body,
                    json_metadata: op.json_metadata
                }];
                operation = [commentOp];

                if (op.options) {
                    const optionsOp = ["comment_options", {
                        author: op.username,
                        permlink: op.permlink,
                        max_accepted_payout: op.options.max_accepted_payout,
                        percent_hbd: op.options.percent_hbd,
                        allow_votes: op.options.allow_votes,
                        allow_curation_rewards: op.options.allow_curation_rewards,
                        extensions: [
                            [0, { beneficiaries: op.options.beneficiaries }]
                        ]
                    }];
                    operation.push(optionsOp);
                }
                keyType = 'posting';
                break;
            case 'reblog':
                operation = [["custom_json", {
                    required_auths: [],
                    required_posting_auths: [op.username],
                    id: 'follow',
                    json: JSON.stringify([
                        'reblog',
                        {
                            account: op.username,
                            author: op.author,
                            permlink: op.permlink
                        }
                    ])
                }]];
                keyType = 'posting';
                break;
            case 'limit_order_create':
                operation = [["limit_order_create", {
                    owner: op.username,
                    orderid: op.orderid,
                    amount_to_sell: op.amount_to_sell,
                    min_to_receive: op.min_to_receive,
                    fill_or_kill: op.fill_or_kill,
                    expiration: op.expiration
                }]];
                break;
            case 'limit_order_cancel':
                operation = [["limit_order_cancel", {
                    owner: op.username,
                    orderid: op.orderid
                }]];
                break;
            case 'witness_vote':
                operation = [["account_witness_vote", {
                    account: op.username,
                    witness: op.witness,
                    approve: op.approve
                }]];
                keyType = 'active';
                break;
            case 'proposal_vote':
                operation = [["update_proposal_votes", {
                    voter: op.username,
                    proposal_ids: op.proposal_ids,
                    approve: op.approve,
                    extensions: []
                }]];
                keyType = 'active';
                break;
            case 'messaging':
                operation = [["custom_json", {
                    required_auths: [],
                    required_posting_auths: [op.username],
                    id: 'messaging',
                    json: JSON.stringify(["message", { to: op.to, message: op.message, v: '1.0' }])
                }]];
                keyType = 'posting';
                break;
            case 'follow': {
                const followOp = op as FollowOperation;
                operation = [["custom_json", {
                    required_auths: [],
                    required_posting_auths: [op.username],
                    id: 'follow',
                    json: JSON.stringify(["follow", { follower: followOp.follower, following: followOp.following, what: followOp.isFollowing ? ['blog'] : [] }])
                }]];
                keyType = 'posting';
                break;
            }
            case 'subscribe': {
                const subOp = op as SubscribeOperation;
                operation = [["custom_json", {
                    required_auths: [],
                    required_posting_auths: [op.username],
                    id: 'community',
                    json: JSON.stringify([subOp.isSubscribing ? 'subscribe' : 'unsubscribe', { community: subOp.community }])
                }]];
                keyType = 'posting';
                break;
            }
            default:
                return { success: false, error: "Unsupported operation" };
        }

        return new Promise<{ success: boolean; result?: any; error?: string }>((resolve) => {
            let auth = {
                username: op.username,
                token: undefined,
                expire: undefined,
                key: "11edc52b-2918-4d71-9058-f7285e29d894" // HAS_STATIC_KEY
            };

            // Try to load existing session
            const storedSession = localStorage.getItem('hive_auth_session');
            if (storedSession) {
                try {
                    const session = JSON.parse(storedSession);
                    if (session.username === op.username && session.token && session.key) {
                        auth = {
                            username: session.username,
                            token: session.token,
                            expire: session.expire,
                            key: session.key
                        };
                    }
                } catch (e) {
                    console.error("Failed to parse stored session", e);
                }
            }

            import("hive-auth-wrapper").then(({ default: HAS }) => {
                HAS.broadcast(auth, keyType, operation, (evt: any) => {
                    const qr_data = {
                        account: auth.username,
                        uuid: evt.uuid,
                        key: auth.key,
                        host: "wss://hive-auth.arcange.eu/"
                    };
                    const json = JSON.stringify(qr_data);
                    const uri = `has://sign_req/${btoa(json)}`;
                    onAuthChallenge({ qr: uri, uuid: evt.uuid });
                })
                    .then((res: any) => {
                        resolve({ success: true, result: res });
                    })
                    .catch((err: any) => {
                        console.error("HAS Broadcast Error:", err);
                        // If we used a stored session and it failed, clear it
                        if (storedSession) {
                            localStorage.removeItem('hive_auth_session');
                        }
                        resolve({ success: false, error: typeof err === 'string' ? err : (err?.message || "HAS Broadcast Failed") });
                    });
            }).catch(err => {
                console.error("HAS Import Error:", err);
                resolve({ success: false, error: "Failed to load HiveAuth" });
            });
        });
    }
};
