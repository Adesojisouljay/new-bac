import { socketService } from '../../../services/socketService';

export interface ShortContent {
    type: 'video';
    videoUrl: string;
    thumbnailUrl?: string;
    caption?: string;
}

export interface Short {
    _id: string;
    username: string;
    content: ShortContent;
    timestamp: string;
    hiveTrxId?: string | null;
    permlink?: string | null;
    stats: {
        likes: number;
        tips: number;
        views: number;
    };
    hasTipped?: boolean;
}


class ShortService {
    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    /**
     * Get active shorts for a community
     */
    async getShorts(communityId: string = 'breakaway', viewer?: string): Promise<Short[]> {
        try {
            const url = new URL(`${this.BACKEND_URL}/api/shorts`);
            url.searchParams.append('communityId', communityId);
            if (viewer) url.searchParams.append('viewer', viewer);

            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                return data.shorts;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch shorts:', error);
            return [];
        }
    }


    /**
     * Post a new short (offchain via socket, onchain reference saved in backend)
     */
    async postShort(username: string, content: ShortContent, hiveTrxId?: string, permlink?: string): Promise<void> {
        socketService.emit('send_short', {
            username,
            content,
            communityId: 'breakaway',
            hiveTrxId,
            permlink
        });
    }

    /**
     * Get target container for onchain broadcast
     */
    async getShortsContainer(): Promise<{ author: string; permlink: string }> {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/shorts/container`);
            if (response.ok) {
                const data = await response.json();
                return data.container;
            }
            throw new Error('Failed to get shorts container');
        } catch (error) {
            console.error('Shorts container error:', error);
            throw error;
        }
    }

    /**
     * Get active votes for a short from Hive
     */
    async getShortVotes(author: string, permlink: string): Promise<any[]> {
        try {
            const { getActiveVotes } = await import('../../../services/hive/client');
            return await getActiveVotes(author, permlink);
        } catch (error) {
            console.error('Failed to get short votes:', error);
            return [];
        }
    }

    /**
     * Get full content metadata for a short from Hive (includes children/comment count)
     */
    async getShortMetadata(author: string, permlink: string): Promise<any> {
        try {
            const { getContent } = await import('../../../services/hive/client');
            return await getContent(author, permlink);
        } catch (error) {
            console.error('Failed to get short metadata:', error);
            return null;
        }
    }

    /**
     * Get comments/replies for a short from Hive
     */

    async getShortComments(author: string, permlink: string): Promise<any[]> {
        try {
            const { getContentReplies } = await import('../../../services/hive/client');
            return await getContentReplies(author, permlink);
        } catch (error) {
            console.error('Failed to get short comments:', error);
            return [];
        }
    }

    /**
     * Record a tip in the backend
     */
    async recordTip(shortId: string, username: string): Promise<void> {
        try {
            await fetch(`${this.BACKEND_URL}/api/shorts/${shortId}/tip`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
        } catch (error) {
            console.error('Failed to record tip:', error);
        }
    }
}


export const shortService = new ShortService();
