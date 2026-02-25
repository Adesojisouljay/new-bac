import axios from 'axios';

const POINTS_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface CommunityConfig {
    domain: string;
    communityName: string;
    hiveCommunityId: string;
    logoUrl?: string;
    primaryColor: string;
    onboardingSats: number;
    communityDescription?: string;
    communityDescriptionExtra?: string;
    isConfigured: boolean;
}

class ConfigService {
    async fetchConfig(domain: string): Promise<CommunityConfig | null> {
        try {
            const response = await axios.get(`${POINTS_API_URL}/config/${domain}`);
            return response.data.config;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            console.error('Error fetching community config:', error);
            return null;
        }
    }

    async saveConfig(config: Partial<CommunityConfig>): Promise<{ success: boolean; message: string; config?: CommunityConfig }> {
        try {
            const response = await axios.post(`${POINTS_API_URL}/config`, config);
            return response.data;
        } catch (error: any) {
            console.error('Error saving community config:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to save configuration'
            };
        }
    }
}

export const configService = new ConfigService();
