import { hiveClient } from '../../../services/hive/client';
import { UnifiedDataService } from '../../../services/unified';

export interface RewardDetail {
    type: string;
    amount: string;
    permlink?: string;
    timestamp: string;
}

export interface DailyPerformance {
    date: string;
    earnings: number; // In HBD equivalent for simplicity
    rewardCount: number;
    hpGrowth: number;
    details: RewardDetail[];
}

class AnalyticsService {
    async getWalletStats(username: string) {
        const [[account], profile, props] = await Promise.all([
            hiveClient.database.getAccounts([username]),
            hiveClient.call('bridge', 'get_profile', { account: username }),
            hiveClient.database.getDynamicGlobalProperties()
        ]);

        if (!account) return null;

        const totalVestingFund = parseFloat(props.total_vesting_fund_hive as string);
        const totalVestingShares = parseFloat(props.total_vesting_shares as string);
        const userVestingShares = parseFloat(account.vesting_shares as string);
        const userHp = (totalVestingFund * userVestingShares) / totalVestingShares;

        return {
            hp: userHp.toFixed(3),
            hbd: parseFloat(account.hbd_balance as string).toFixed(3),
            hive: parseFloat(account.balance as string).toFixed(3),
            savings_hbd: parseFloat(account.savings_hbd_balance as string).toFixed(3),
            reputation: profile?.reputation ? parseFloat(profile.reputation).toFixed(1) : this.formatReputation(account.reputation)
        };
    }

    private formatReputation(rep: string | number | undefined): string {
        if (rep === undefined) return "25.0";
        let score = Number(rep);
        if (isNaN(score) || score === 0) return "25.0";

        const isNegative = score < 0;
        const log = Math.log10(Math.abs(score));
        let out = log - 9;
        if (isNaN(out) || !isFinite(out)) out = 0;

        out = (isNegative ? -1 : 1) * out * 9 + 25;
        return out.toFixed(1);
    }

    async getPerformanceData(username: string): Promise<DailyPerformance[]> {
        try {
            // 1. Fetch market price for HBD equivalent
            let hivePrice = 0.3; // Fallback
            try {
                const ticker = await UnifiedDataService.getMarketTicker();
                if (ticker) hivePrice = parseFloat(ticker.latest);
            } catch (e) {
                console.warn('Failed to fetch hive price for analytics', e);
            }

            // 2. Fetch history in batches to ensure 14-day coverage
            let history: any[] = [];
            try {
                // Fetch last 2000 ops - more reliable limit for most nodes
                history = await hiveClient.database.getAccountHistory(username, -1, 2000);
            } catch (e) {
                console.warn('Failed to fetch full history, trying smaller batch', e);
                history = await hiveClient.database.getAccountHistory(username, -1, 500);
            }
            const dailyData: Record<string, DailyPerformance> = {};

            // 3. Get global props for VESTS to HP conversion
            const props = await hiveClient.database.getDynamicGlobalProperties();
            const vestingFund = parseFloat(props.total_vesting_fund_hive as string);
            const totalVestingShares = parseFloat(props.total_vesting_shares as string);

            history.forEach(entry => {
                const op = entry[1].op;
                const timestamp = entry[1].timestamp;
                const date = timestamp.split('T')[0];

                if (!dailyData[date]) {
                    dailyData[date] = { date, earnings: 0, rewardCount: 0, hpGrowth: 0, details: [] };
                }

                // Track author rewards (HBD + HIVE + VESTS/HP)
                if (op[0] === 'author_reward') {
                    const hbd = parseFloat(op[1].hbd_payout as string);
                    const hive = parseFloat(op[1].hive_payout as string);
                    const vests = parseFloat(op[1].vesting_payout as string);
                    const hp = (vestingFund * vests) / totalVestingShares;

                    dailyData[date].earnings += hbd + (hive * hivePrice) + (hp * hivePrice);
                    dailyData[date].rewardCount += 1;
                    dailyData[date].hpGrowth += hp;
                    dailyData[date].details.push({
                        type: 'Author Reward',
                        amount: `${hbd > 0 ? hbd.toFixed(3) + ' HBD ' : ''}${hive > 0 ? hive.toFixed(3) + ' HIVE ' : ''}${hp > 0 ? hp.toFixed(3) + ' HP' : ''}`.trim(),
                        permlink: op[1].permlink,
                        timestamp
                    });
                }

                // Track curation rewards (VESTS only)
                if (op[0] === 'curation_reward') {
                    const vests = parseFloat(op[1].reward as string);
                    const hp = (vestingFund * vests) / totalVestingShares;

                    dailyData[date].earnings += (hp * hivePrice);
                    dailyData[date].rewardCount += 1;
                    dailyData[date].hpGrowth += hp;
                    dailyData[date].details.push({
                        type: 'Curation Reward',
                        amount: `${hp.toFixed(3)} HP`,
                        permlink: op[1].permlink,
                        timestamp
                    });
                }

                // Track benefactor rewards
                if (op[0] === 'comment_benefactor_reward') {
                    const hbd = parseFloat(op[1].hbd_payout as string);
                    const hive = parseFloat(op[1].hive_payout as string);
                    const vests = parseFloat(op[1].vesting_payout as string);
                    const hp = (vestingFund * vests) / totalVestingShares;

                    dailyData[date].earnings += hbd + (hive * hivePrice) + (hp * hivePrice);
                    dailyData[date].rewardCount += 1;
                    dailyData[date].hpGrowth += hp;
                    dailyData[date].details.push({
                        type: 'Benefactor Reward',
                        amount: `${hbd > 0 ? hbd.toFixed(3) + ' HBD ' : ''}${hive > 0 ? hive.toFixed(3) + ' HIVE ' : ''}${hp > 0 ? hp.toFixed(3) + ' HP' : ''}`.trim(),
                        permlink: op[1].permlink,
                        timestamp
                    });
                }
            });

            // 4. Fill in missing days for the last 14 days with 0s
            const result: DailyPerformance[] = [];
            const now = new Date();
            for (let i = 0; i < 14; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];

                if (dailyData[dateStr]) {
                    result.push(dailyData[dateStr]);
                } else {
                    result.push({ date: dateStr, earnings: 0, rewardCount: 0, hpGrowth: 0, details: [] });
                }
            }

            return result.reverse();
        } catch (error) {
            console.error('Performance fetch error:', error);
            return [];
        }
    }
}

export const analyticsService = new AnalyticsService();
