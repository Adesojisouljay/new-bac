import { hiveClient } from '../../../services/hive/client';

export interface DailyPerformance {
    date: string;
    earnings: number; // In HBD equivalent for simplicity
    votesReceived: number;
    hpGrowth: number;
}

class AnalyticsService {
    async getWalletStats(username: string) {
        const [account] = await hiveClient.database.getAccounts([username]);
        if (!account) return null;

        // Simplified HP calculation
        const props = await hiveClient.database.getDynamicGlobalProperties();
        const totalVestingFund = parseFloat(props.total_vesting_fund_hive as string);
        const totalVestingShares = parseFloat(props.total_vesting_shares as string);
        const userVestingShares = parseFloat(account.vesting_shares as string);
        const userHp = (totalVestingFund * userVestingShares) / totalVestingShares;

        return {
            hp: userHp.toFixed(3),
            hbd: parseFloat(account.hbd_balance as string).toFixed(3),
            hive: parseFloat(account.balance as string).toFixed(3),
            savings_hbd: parseFloat(account.savings_hbd_balance as string).toFixed(3),
            reputation: this.formatReputation(account.reputation)
        };
    }

    private formatReputation(rep: string | number): string {
        const out = (Math.log10(Number(rep)) - 9) * 9 + 25;
        return out.toFixed(1);
    }

    async getPerformanceData(username: string): Promise<DailyPerformance[]> {
        try {
            // Fetch last 1000 ops to find rewards
            const history = await hiveClient.database.getAccountHistory(username, -1, 1000);
            const dailyData: Record<string, DailyPerformance> = {};

            history.forEach(entry => {
                const op = entry[1].op;
                const date = entry[1].timestamp.split('T')[0];

                if (!dailyData[date]) {
                    dailyData[date] = { date, earnings: 0, votesReceived: 0, hpGrowth: 0 };
                }

                // Simplified reward tracking
                if (op[0] === 'author_reward') {
                    const hbd = parseFloat(op[1].hbd_payout as string);
                    const hive = parseFloat(op[1].hive_payout as string);
                    dailyData[date].earnings += hbd + (hive * 0.3); // Rough estimation
                }

                if (op[0] === 'curation_reward') {
                    // Curation is in VESTS, skipping complex conversion for simple chart
                    dailyData[date].hpGrowth += 1;
                }
            });

            // Return last 14 days
            return Object.values(dailyData)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 14)
                .reverse();
        } catch (error) {
            console.error('Performance fetch error:', error);
            return [];
        }
    }
}

export const analyticsService = new AnalyticsService();
