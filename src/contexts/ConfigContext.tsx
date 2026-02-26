import React, { createContext, useContext, useState, useEffect } from 'react';
import { configService, CommunityConfig } from '../services/configService';

interface ConfigContextType {
    config: CommunityConfig | null;
    loading: boolean;
    isConfigured: boolean;
    refreshConfig: () => Promise<void>;
    updateConfig: (newConfig: Partial<CommunityConfig>) => Promise<boolean>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<CommunityConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [isConfigured, setIsConfigured] = useState(false);

    const fetchCurrentConfig = async () => {
        setLoading(true);
        const domain = window.location.hostname;

        try {
            const data = await configService.fetchConfig(domain);

            if (data) {
                console.log("ConfigContext: Loaded config from API for domain:", domain);
                setConfig(data);
                setIsConfigured(true);
                if (data.primaryColor) {
                    document.documentElement.style.setProperty('--primary-color', data.primaryColor);
                }
            } else {
                // Fallback to Env variables if API returns null (domain not found)
                console.log("ConfigContext: Domain not found in API, checking ENV fallback...");
                checkEnvFallback();
            }
        } catch (error) {
            console.error("ConfigContext: API call failed, falling back to ENV:", error);
            checkEnvFallback();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (config) {
            // Update Title
            document.title = config.communityName;

            // Update Meta Tags
            const description = config.communityDescription || "A decentralized community powered by Breakaway.";
            const logo = config.logoUrl || `${window.location.origin}/vite.svg`;

            updateMetaTag('description', description);

            // OpenGraph
            updateMetaTag('og:title', config.communityName, 'property');
            updateMetaTag('og:description', description, 'property');
            updateMetaTag('og:image', logo, 'property');
            updateMetaTag('og:type', 'website', 'property');
            updateMetaTag('og:url', window.location.href, 'property');

            // Twitter
            updateMetaTag('twitter:card', 'summary_large_image');
            updateMetaTag('twitter:title', config.communityName);
            updateMetaTag('twitter:description', description);
            updateMetaTag('twitter:image', logo);
        }
    }, [config]);

    const updateMetaTag = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
        let element = document.querySelector(`meta[${attr}="${name}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attr, name);
            document.head.appendChild(element);
        }
        element.setAttribute('content', content);
    };

    const checkEnvFallback = () => {
        const envCommunityId = import.meta.env.VITE_COMMUNITY_ID;

        if (envCommunityId && envCommunityId !== 'YOUR_COMMUNITY_ID' && envCommunityId !== 'global') {
            const fallback: CommunityConfig = {
                domain: window.location.hostname,
                communityName: import.meta.env.VITE_COMMUNITY_NAME || 'Breakaway Community',
                hiveCommunityId: envCommunityId,
                logoUrl: import.meta.env.VITE_COMMUNITY_LOGO,
                primaryColor: import.meta.env.VITE_THEME_PRIMARY || '#ff4400',
                onboardingSats: parseInt(import.meta.env.VITE_ONBOARDING_SATS || '100'),
                communityDescription: import.meta.env.VITE_COMMUNITY_DESCRIPTION,
                isConfigured: true
            };
            setConfig(fallback);
            setIsConfigured(true);
            document.documentElement.style.setProperty('--primary-color', fallback.primaryColor);
            console.log("ConfigContext: Successfully loaded fallback from ENV");
        } else {
            // Check if we should fallback to Global mode or enter Setup mode
            const hostname = window.location.hostname;
            const isGlobalDomain =
                hostname === '127.0.0.1' ||
                hostname === 'app.breakaway.community' ||
                import.meta.env.VITE_GLOBAL_MODE === 'true';

            if (isGlobalDomain) {
                console.log("ConfigContext: Global domain detected, enabling GLOBAL mode");
                const globalFallback: CommunityConfig = {
                    domain: hostname,
                    communityName: 'Breakaway',
                    hiveCommunityId: 'global',
                    logoUrl: '/vite.svg',
                    primaryColor: '#e11d48',
                    onboardingSats: 100,
                    communityDescription: 'Decentralized Hive Global Feed',
                    isConfigured: true
                };
                setConfig(globalFallback);
                setIsConfigured(true);
                document.documentElement.style.setProperty('--primary-color', globalFallback.primaryColor);
            } else {
                console.log("ConfigContext: White-label domain detected. Prompting for setup.");
                setIsConfigured(false);
            }
        }
    };

    useEffect(() => {
        fetchCurrentConfig();
    }, []);

    const refreshConfig = async () => {
        await fetchCurrentConfig();
    };

    const updateConfig = async (newConfig: Partial<CommunityConfig>) => {
        const domain = window.location.hostname;
        const result = await configService.saveConfig({ ...newConfig, domain });
        if (result.success && result.config) {
            setConfig(result.config);
            setIsConfigured(true);
            if (result.config.primaryColor) {
                document.documentElement.style.setProperty('--primary-color', result.config.primaryColor);
            }
            return true;
        }
        return false;
    };

    return (
        <ConfigContext.Provider value={{ config, loading, isConfigured, refreshConfig, updateConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};
