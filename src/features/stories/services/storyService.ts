import { socketService } from '../../../services/socketService';

export interface StoryContent {
    type: 'text' | 'image';
    text?: string;
    imageUrl?: string;
}

export interface Story {
    _id: string;
    username: string;
    content: StoryContent;
    timestamp: string;
    expiresAt: string | null;
    hiveTrxId?: string | null;
    isOnchain?: boolean;
    stats: {
        likes: number;
        tips: number;
    };
}

export interface GroupedStory {
    username: string;
    stories: Story[];
}

class StoryService {
    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    /**
     * Get today's offchain stories grouped by user (24hr default, as before)
     */
    async getStories(communityId: string = 'breakaway'): Promise<GroupedStory[]> {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/stories?communityId=${communityId}`);
            if (response.ok) {
                const data = await response.json();
                return data.stories;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch stories:', error);
            return [];
        }
    }

    /**
     * Get onchain stories from Hive for a specific date (defaults to today)
     * @param date - 'YYYY-MM-DD' string, or null for today
     */
    async getOnchainStories(date: string | null = null): Promise<GroupedStory[]> {
        try {
            const url = date
                ? `${this.BACKEND_URL}/api/stories/onchain?date=${date}`
                : `${this.BACKEND_URL}/api/stories/onchain`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.stories ?? [];
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch onchain stories:', error);
            return [];
        }
    }

    /**
     * Merge offchain + onchain stories, deduplicating by username.
     * Onchain stories for users not in offchain are appended.
     * @param showOlderDate - If set, also fetch onchain stories for that date
     */
    async getCombinedStories(showOlderDate?: string): Promise<GroupedStory[]> {
        const [offchain, onchainToday, onchainOlder] = await Promise.all([
            this.getStories(),
            this.getOnchainStories(null),
            showOlderDate ? this.getOnchainStories(showOlderDate) : Promise.resolve([] as GroupedStory[])
        ]);

        // Build a map of offchain stories by username
        const merged: Record<string, GroupedStory> = {};

        for (const group of offchain) {
            merged[group.username] = { ...group };
        }

        // Merge in today's onchain stories
        for (const group of onchainToday) {
            if (!merged[group.username]) {
                merged[group.username] = { username: group.username, stories: [] };
            }
            // Only add onchain stories not already represented (by username already in offchain today)
            // This is a soft dedup — offchain already contains today's stories for active users
            for (const s of group.stories) {
                const alreadyExists = merged[group.username].stories.some(existing =>
                    Math.abs(new Date(existing.timestamp).getTime() - new Date(s.timestamp).getTime()) < 5000
                );
                if (!alreadyExists) {
                    merged[group.username].stories.push(s);
                }
            }
        }

        // Append older onchain stories (distinct section — they won't clash with today's)
        for (const group of onchainOlder) {
            if (!merged[group.username]) {
                merged[group.username] = { username: group.username, stories: [] };
            }
            for (const s of group.stories) {
                merged[group.username].stories.push({ ...s, isOnchain: true });
            }
        }

        return Object.values(merged);
    }

    /**
     * Post a new story (offchain via socket, onchain via backend relay)
     */
    async postStory(username: string, content: StoryContent): Promise<void> {
        // Emit via socket for real-time speed (offchain)
        socketService.emit('send_story', {
            username,
            content,
            communityId: 'breakaway'
        });
        // Note: onchain broadcast is handled server-side in the createStory controller
        // when a postingKey is provided (relay users). Keychain users broadcast client-side.
    }

    /**
     * Returns yesterday's date as 'YYYY-MM-DD' (UTC)
     */
    getYesterdayDateStr(): string {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
    }
}

export const storyService = new StoryService();
