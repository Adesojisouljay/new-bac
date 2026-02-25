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
    expiresAt: string;
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
     * Get all active stories grouped by user
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
     * Post a new story (Status)
     */
    async postStory(username: string, content: StoryContent): Promise<void> {
        // 1. Emit via socket for real-time speed
        socketService.emit('send_story', {
            username,
            content,
            communityId: 'breakaway'
        });

        // 2. Also save via REST for reliability (if needed, but socket handled it in our backend)
        // Note: The backend socket handler saves it to DB, so REST is secondary here.
    }
}

export const storyService = new StoryService();
