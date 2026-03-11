import { hiveClient } from './hive/client';

export interface HiveUserSuggestion {
    name: string;
    reputation: number;
}

export const mentionService = {
    /**
     * Searches for Hive users starting with the given query.
     */
    searchUsers: async (query: string, limit: number = 20): Promise<HiveUserSuggestion[]> => {
        // If query is empty (just typed @), we could return popular users or empty.
        // Let's allow it to proceed to show the box is active.
        const searchTerms = query ? query.toLowerCase() : '';

        try {
            // Using lookup_accounts to find matching usernames
            const result = await hiveClient.call('condenser_api', 'lookup_accounts', [searchTerms, limit]);

            if (!Array.isArray(result) || result.length === 0) return [];

            // Fetch reputations for these users to make it more useful
            let reputations: any[] = [];
            try {
                reputations = await hiveClient.call('bridge', 'get_account_reputations', {
                    accounts: result,
                    limit
                }) || [];
            } catch (repError) {
                console.warn('Reputation fetch failed, continuing without it:', repError);
            }

            return result.map(username => {
                const repObj = Array.isArray(reputations) ? reputations.find((r: any) => r.account === username) : null;
                return {
                    name: username,
                    reputation: repObj ? repObj.reputation : 25
                };
            });
        } catch (error) {
            console.error('Mention search failed:', error);
            return [];
        }
    }
};
