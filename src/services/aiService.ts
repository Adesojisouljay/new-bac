import axios from 'axios';
import { UnifiedDataService } from './unified';

export interface AIResponse {
    message: string;
    suggestions?: string[];
}

class AIService {
    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

    /**
     * Ask the Hive Guide AI a question
     */
    async ask(question: string, audioData?: string): Promise<AIResponse> {
        const q = question.toLowerCase();

        try {
            // First, check if it's a specialized lookup to gather context
            let contextData = null;

            if (q.includes('news') || q.includes('trending') || q.includes('happening')) {
                const news = await this.getNewsResponse(question);
                contextData = { type: 'news', data: news.message };
            } else if (this.detectAccountMention(question)) {
                const account = await this.getAccountResponse(this.detectAccountMention(question)!, question);
                contextData = { type: 'account', data: account.message };
            }

            // Call the smart AI endpoint on the backend
            const response = await axios.post(`${this.BACKEND_URL}/api/ai/ask`, {
                question,
                contextData,
                audioData, // Base64 audio if provided
                context: 'hive_blockchain_guide'
            });

            if (response.data && response.data.message) {
                return response.data;
            }

            throw new Error("Invalid backend AI response");
        } catch (error) {
            console.error('AI Service (Backend) Error:', error);

            // Fallback to Rule-Based Intelligence
            if (q.includes('code') || q.includes('rpc') || q.includes('dev') || q.includes('example') || q.includes('documentation')) {
                return this.getDeveloperResponse(question);
            }
            if (q.includes('news') || q.includes('happening') || q.includes('debate') || q.includes('dhf') || q.includes('proposal') || q.includes('trending')) {
                return await this.getNewsResponse(question);
            }
            const accountMatch = this.detectAccountMention(question);
            if (accountMatch) {
                return await this.getAccountResponse(accountMatch, question);
            }

            return this.getMockResponse(question);
        }
    }

    private getMockResponse(question: string): AIResponse {
        const q = question.toLowerCase();

        if (q.includes('what is hive') || q.includes('how does hive work')) {
            return {
                message: "Hive is a decentralized social blockchain built on the Delegated Proof of Stake (DPoS) protocol. It's designed to scale with widespread adoption of the currency and platforms in mind. It feature fast 3-second block times and fee-less transactions!",
                suggestions: ["What are HBD/HIVE?", "How to earn rewards?", "What is Power Up?"]
            };
        }

        if (q.includes('hbd') || q.includes('dollar')) {
            return {
                message: "Hive Backed Dollars (HBD) are stablecoin-like assets on the Hive blockchain, pegged to the value of $1 USD. You can earn 20% APR interest by keeping them in your Savings!",
                suggestions: ["How to earn 20% interest?", "Ways to get HBD"]
            };
        }

        return {
            message: "I'm the Hive Guide! I'm here to help you understand the Hive ecosystem. You can ask me about HIVE, HBD, Resource Credits, Communities, or how to earn rewards. You can even ask me about specific users like '@dolop' or '@kolade'!",
            suggestions: ["Tell me about Hive", "What is HBD?", "Who is @breakaway?"]
        };
    }

    private detectAccountMention(text: string): string | null {
        // Match @username or phrases like "who is username"
        const atMatch = text.match(/@([a-z0-9.-]{3,16})/i);
        if (atMatch) return atMatch[1].toLowerCase();

        const whoIsMatch = text.match(/who is ([a-z0-9.-]{3,16})/i);
        if (whoIsMatch) return whoIsMatch[1].toLowerCase();

        const powerMatch = text.match(/hive power does ([a-z0-9.-]{3,16}) hold/i) || text.match(/power of ([a-z0-9.-]{3,16})/i);
        if (powerMatch) return powerMatch[1].toLowerCase();

        return null;
    }

    private async getAccountResponse(username: string, question: string): Promise<AIResponse> {
        try {
            const [profile, wallet] = await Promise.all([
                UnifiedDataService.getProfile(username),
                UnifiedDataService.getWallet(username)
            ]);

            if (!profile || (profile.reputation === 25 && profile.stats.post_count === 0 && !profile.metadata?.profile?.about)) {
                return {
                    message: `I couldn't find much information for @${username}. Are you sure that's the correct username?`,
                    suggestions: ["Who is @hivedev?", "What is Hive?"]
                };
            }

            const q = question.toLowerCase();
            const displayName = profile.metadata?.profile?.name || username;

            // Handle Hive Power specific questions
            if (q.includes('power') || q.includes('hp') || q.includes('vests')) {
                if (!wallet) return { message: `I couldn't fetch the wallet data for @${username} right now.` };

                // Simplified HP calculation if globalProps are available
                let hp = '0.00';
                if (wallet.globalProps) {
                    const totalVestingFund = parseFloat(wallet.globalProps.total_vesting_fund_hive.toString());
                    const totalVestingShares = parseFloat(wallet.globalProps.total_vesting_shares.toString());
                    const userVests = parseFloat(wallet.vesting_shares.toString());
                    hp = ((totalVestingFund * userVests) / totalVestingShares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }

                return {
                    message: `${displayName} (@${username}) holds approximately **${hp} HP** (Hive Power). They also have **${wallet.balance}** and **${wallet.hbd_balance}** in their wallet.`,
                    suggestions: [`Who is @${username}?`, "What is Hive Power?", "How to earn HP?"]
                };
            }

            // General Profile Response
            const about = profile.metadata?.profile?.about ? `\n\n**About:** ${profile.metadata.profile.about}` : "";
            const reputation = profile.reputation;
            const followers = profile.stats.followers;
            const posts = profile.stats.post_count;

            return {
                message: `**${displayName}** (@${username}) is a Hive user with a reputation of **${reputation}**. They have **${followers}** followers and have published **${posts}** posts.${about}`,
                suggestions: [`How much HP does @${username} have?`, `View @${username}'s posts`, "Who else is on Hive?"]
            };

        } catch (error) {
            console.error('Error fetching account data for AI:', error);
            return {
                message: "I ran into a bit of trouble looking up that account. The Hive blockchain might be busy!",
                suggestions: ["Try again", "What is Hive?"]
            };
        }
    }

    private async getNewsResponse(question: string): Promise<AIResponse> {
        try {
            const q = question.toLowerCase();
            let feedType: 'trending' | 'hot' = 'trending';
            if (q.includes('hot') || q.includes('latest')) feedType = 'hot';

            const posts = await UnifiedDataService.getCommunityFeed('global', feedType, 8);

            if (!posts || posts.length === 0) {
                return {
                    message: "I'm having trouble fetching the latest news right now. The blockchain might be under heavy load.",
                    suggestions: ["Try again", "What is Hive?"]
                };
            }

            // Detect if specific DHF/Debate interest
            const isDHF = q.includes('dhf') || q.includes('proposal') || q.includes('funding');
            const relevantPosts = isDHF
                ? posts.filter(p => p.title.toLowerCase().includes('dhf') || p.title.toLowerCase().includes('proposal') || p.body.toLowerCase().includes('dhf'))
                : posts;

            const displayPosts = (relevantPosts.length > 0 ? relevantPosts : posts).slice(0, 5);
            let responseMsg = isDHF
                ? "### 🗳️ Current DHF & Proposal Debates\nHere's what people are discussing regarding Hive funding and proposals:\n\n"
                : "### 🔥 Trending on Hive Right Now\nHere are the top discussions currently happening in the ecosystem:\n\n";

            displayPosts.forEach((post, idx) => {
                responseMsg += `${idx + 1}. **${post.title}** by @${post.author}\n`;
                // Add a small snippet or payout info to show it's "hot"
                if (post.pending_payout_value !== '0.000 HBD') {
                    responseMsg += `   *Rewards: ${post.pending_payout_value} | ${post.children} comments*\n`;
                }
                responseMsg += `\n`;
            });

            responseMsg += "\n*Would you like me to look up more details on any of these authors?*";

            return {
                message: responseMsg,
                suggestions: ["What is DHF?", "Who is @blocktrades?", "Latest Hot posts"]
            };

        } catch (error) {
            console.error('Error fetching news for AI:', error);
            return {
                message: "I couldn't reach the Hive news feed right now. You can check the 'Global' feed manually to see what's trending!",
                suggestions: ["Go to Global Feed", "Tell me about HP"]
            };
        }
    }

    private getDeveloperResponse(question: string): AIResponse {
        const q = question.toLowerCase();

        if (q.includes('rpc') || q.includes('client') || q.includes('connect')) {
            return {
                message: "To connect to Hive via RPC in JavaScript/TypeScript, use the `@hiveio/dhive` library. Here's a quick setup:\n\n```typescript\nimport { Client } from '@hiveio/dhive';\n\nconst client = new Client([\n  'https://api.hive.blog',\n  'https://anyx.io',\n  'https://api.openhive.network'\n]);\n\n// Example: Get account data\nclient.database.getAccounts(['fbslo']).then(accounts => {\n  console.log(accounts[0]);\n});\n```",
                suggestions: ["How to post with dhive?", "Broadcast a vote", "DHF API info"]
            };
        }

        if (q.includes('vote') || q.includes('broadcast')) {
            return {
                message: "Broadcasting a vote involves creating a `vote` operation and signing it with your Posting Key. Using `dhive`:\n\n```typescript\nconst voteOp = {\n  voter: 'your-username',\n  author: 'author-of-post',\n  permlink: 'post-permlink',\n  weight: 10000 // 100% upvote\n};\n\nclient.broadcast.vote(voteOp, PrivateKey.from('your-posting-key'))\n  .then(result => console.log('Vote cast!', result));\n```",
                suggestions: ["How to post?", "Transfer HIVE", "RPC Nodes list"]
            };
        }

        if (q.includes('documentation') || q.includes('manual')) {
            return {
                message: "You can find the official Hive developer documentation at **[developers.hive.io](https://developers.hive.io)**. It covers everything from CLI tools to advanced RPC manbars and account management.",
                suggestions: ["Hive Whitepaper", "App ideas"]
            };
        }

        return {
            message: "I can help you build on Hive! I can provide code snippets for `@hiveio/dhive`, explain RPC methods, or help with HAF (Hive Application Framework) concepts. What are you trying to build today?",
            suggestions: ["RPC Setup example", "How to broadcast a vote?", "Hive Documentation"]
        };
    }
}

export const aiService = new AIService();
