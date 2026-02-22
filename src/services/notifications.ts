import { hiveClient } from './hive/client';

export interface HiveNotification {
    id: string;
    type: string;
    msg: string;
    date: string;
    url: string;
    score: number;
    read?: boolean;
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
    addLocalNotification: (username: string, msg: string, type: string = 'deposit', url: string = 'wallet') => {
        const key = `local_notifications_${username}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const newNotif: HiveNotification = {
            id: `local_${Date.now()}`,
            type,
            msg,
            date: new Date().toISOString().split('.')[0], // YYYY-MM-DDTHH:MM:SS
            url,
            score: 100,
            read: false
        };
        const updated = [newNotif, ...existing].slice(0, 50); // Keep last 50
        localStorage.setItem(key, JSON.stringify(updated));
        // Dispatch event so other components can refresh
        window.dispatchEvent(new CustomEvent('local_notification_added'));
    },

    getLocalNotifications: (username: string): HiveNotification[] => {
        const key = `local_notifications_${username}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }
};
