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
