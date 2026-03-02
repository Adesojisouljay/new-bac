import { Client } from '@hiveio/dhive';

// Initialize the Hive client with preferred nodes
const NODES = [
    'https://api.deathwing.me',
    'https://hive-api.arcange.eu',
    'https://api.openhive.network',
    'https://api.hive.blog',
    'https://anyx.io',
];

export const hiveClient = new Client(NODES, {
    timeout: 10000,
});

export const getHiveProfile = async (username: string) => {
    try {
        const accounts = await hiveClient.database.getAccounts([username]);
        if (accounts.length === 0) return null;
        return accounts[0];
    } catch (error) {
        console.error('Failed to fetch Hive profile:', error);
        throw error;
    }
};

export const getActiveVotes = async (author: string, permlink: string) => {
    try {
        return await hiveClient.database.call('get_active_votes', [author, permlink]);
    } catch (error) {
        console.error('Failed to fetch active votes:', error);
        return [];
    }
};
export const getContentReplies = async (author: string, permlink: string) => {
    try {
        return await hiveClient.database.call('get_content_replies', [author, permlink]);
    } catch (error) {
        console.error('Failed to fetch content replies:', error);
        return [];
    }
};
export const getContent = async (author: string, permlink: string) => {
    try {
        return await hiveClient.database.call('get_content', [author, permlink]);
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return null;
    }
};
