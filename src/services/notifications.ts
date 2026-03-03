import { hiveClient } from './hive/client';

export interface HiveNotification {
    id: string;
    type: string;
    msg: string;
    date: string;
    url: string;
    score: number;
    read?: boolean;
    txHash?: string; // Support for Web3 links
    chain?: string;
    address?: string; // Support for account links
}

export const NotificationService = {
    /**
     * Fetches notifications for a user using the Hive Bridge API.
     */
    getNotifications: async (account: string, limit: number = 20, last_id?: string): Promise<HiveNotification[]> => {
        try {
            const params: any = { account, limit };
            if (last_id) params.last_id = last_id;

            const result = await hiveClient.call('bridge', 'account_notifications', params);

            if (!Array.isArray(result)) return [];

            return result.map((n: any) => ({
                id: n.id,
                type: n.type,
                msg: n.msg,
                date: n.date,
                url: n.url,
                score: n.score,
                read: false // Hive bridge doesn't provide read status directly, usually managed locally or via separate API
            }));
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            return [];
        }
    },

    /**
     * Gets unread count. Note: Bridge API doesn't have "unread" state.
     * Often apps store the last checked ID in localStorage.
     */
    getUnreadCount: (notifications: HiveNotification[], lastCheckedId: string | null): number => {
        if (!lastCheckedId) return notifications.length;
        const index = notifications.findIndex(n => n.id === lastCheckedId);
        return index === -1 ? notifications.length : index;
    },

    /**
     * Persistent local notifications (e.g. for Web3 events)
     */
    addLocalNotification: (username: string, msg: string, type: string = 'deposit', url: string = 'wallet', txHash?: string, chain?: string, address?: string) => {
        const key = `local_notifications_${username}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const newNotif: HiveNotification = {
            id: `local_${Date.now()}`,
            type,
            msg,
            date: new Date().toISOString().split('.')[0], // YYYY-MM-DDTHH:MM:SS
            url,
            score: 100,
            read: false,
            txHash,
            chain,
            address
        };
        const updated = [newNotif, ...existing].slice(0, 50); // Keep last 50
        localStorage.setItem(key, JSON.stringify(updated));
        // Dispatch event so other components can refresh
        window.dispatchEvent(new CustomEvent('local_notification_added'));
    },

    getLocalNotifications: (username: string): HiveNotification[] => {
        const key = `local_notifications_${username}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    },

    /**
     * Fetches decentralized Web3 logs from Hive account history.
     */
    getWeb3History: async (username: string, limit: number = 50): Promise<HiveNotification[]> => {
        try {
            // condenser_api.get_account_history [account, start, limit]
            // start -1 means the most recent
            const history = await hiveClient.call('condenser_api', 'get_account_history', [username, -1, limit]);

            if (!Array.isArray(history)) return [];

            const web3Logs: HiveNotification[] = [];

            // History comes in [index, { op: [name, data] }] format
            history.reverse().forEach(([idx, entry]: any) => {
                const op = entry.op;
                if (op[0] === 'custom_json' && op[1].id === 'bac_web3_tx') {
                    try {
                        const data = JSON.parse(op[1].json);
                        const shortHash = data.hash.slice(0, 8) + '...' + data.hash.slice(-4);

                        web3Logs.push({
                            id: `hive_${entry.trx_id || idx}`,
                            type: data.type || 'send',
                            msg: `${data.type === 'send' ? 'Sent' : 'Received'}: ${data.amount} ${data.chain} (${shortHash})`,
                            date: entry.timestamp,
                            url: 'wallet',
                            score: 100,
                            read: true,
                            txHash: data.hash,
                            chain: data.chain
                        });
                    } catch (e) {
                        // Skip malformed JSON
                    }
                }
            });

            return web3Logs;
        } catch (error) {
            console.error('Failed to fetch Web3 history from Hive:', error);
            return [];
        }
    },

    /**
     * Centralized explorer URL generator
     */
    getExplorerUrl: (chain: string, hash?: string, address?: string) => {
        const c = chain?.toUpperCase();
        if (hash) {
            switch (c) {
                case 'BTC': return `https://blockstream.info/tx/${hash}`;
                case 'ETH': return `https://etherscan.io/tx/${hash}`;
                case 'BASE': return `https://basescan.org/tx/${hash}`;
                case 'POLYGON': return `https://polygonscan.com/tx/${hash}`;
                case 'ARBITRUM': return `https://arbiscan.io/tx/${hash}`;
                case 'BNB':
                case 'USDT_BEP20': return `https://bscscan.com/tx/${hash}`;
                case 'SOL': return `https://solscan.io/tx/${hash}`;
                case 'TRON':
                case 'USDT_TRC20': return `https://tronscan.org/#/transaction/${hash}`;
                case 'APTOS': return `https://explorer.aptoslabs.com/txn/${hash}`;
                default: return `https://etherscan.io/tx/${hash}`; // Generic EVM
            }
        }
        if (address) {
            switch (c) {
                case 'BTC': return `https://blockstream.info/address/${address}`;
                case 'ETH': return `https://etherscan.io/address/${address}`;
                case 'BASE': return `https://basescan.org/address/${address}`;
                case 'POLYGON': return `https://polygonscan.com/address/${address}`;
                case 'ARBITRUM': return `https://arbiscan.io/address/${address}`;
                case 'BNB':
                case 'USDT_BEP20': return `https://bscscan.com/address/${address}`;
                case 'SOL': return `https://solscan.io/account/${address}`;
                case 'TRON':
                case 'USDT_TRC20': return `https://tronscan.org/#/address/${address}`;
                case 'APTOS': return `https://explorer.aptoslabs.com/account/${address}`;
                default: return `https://etherscan.io/address/${address}`;
            }
        }
        return '#';
    }
};
