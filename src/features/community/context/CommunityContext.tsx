import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CommunityConfig } from '../types';
import { useConfig } from '../../../contexts/ConfigContext';
import { useLocation } from 'react-router-dom';

interface CommunityContextType {
    config: CommunityConfig | null;
    isLoading: boolean;
    error: Error | null;
    themeMode: 'light' | 'dark';
    toggleTheme: () => void;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

// Default configuration loaded from environment variables
const DEFAULT_CONFIG: CommunityConfig = {
    id: import.meta.env.VITE_COMMUNITY_ID || 'global',
    name: import.meta.env.VITE_COMMUNITY_NAME || 'Breakaway',
    domain: window.location.hostname,
    description: import.meta.env.VITE_COMMUNITY_DESCRIPTION || 'Hive Global Feed',
    logo: import.meta.env.VITE_COMMUNITY_LOGO || '',
    theme: {
        primaryColor: import.meta.env.VITE_THEME_PRIMARY || '#e11d48',
        secondaryColor: import.meta.env.VITE_THEME_SECONDARY || '#475569',
        accentColor: import.meta.env.VITE_THEME_ACCENT || '#f59e0b',
        backgroundColor: import.meta.env.VITE_THEME_BACKGROUND || '#f8fafc',
        cardBackgroundColor: import.meta.env.VITE_THEME_CARD_BACKGROUND || '#ffffff',
        textColor: import.meta.env.VITE_THEME_TEXT || '#0f172a',
        borderColor: import.meta.env.VITE_THEME_BORDER || '#e2e8f0',
        fontFamily: 'Inter, sans-serif',
    },
    features: {
        hiveAuth: true,
        pointsSystem: false,
        market: false,
        governance: false,
    },
    apiEndpoint: import.meta.env.VITE_API_ENDPOINT || 'http://localhost:3000',
    hiveAccount: import.meta.env.VITE_COMMUNITY_ACCOUNT || 'breakaway',
};

export function CommunityProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<CommunityConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error] = useState<Error | null>(null);

    // Theme State
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('themeMode');
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        // Apply theme class
        const root = document.documentElement;
        if (themeMode === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('themeMode', themeMode);

        // Re-apply community theme vars with mode awareness
        if (config) {
            applyTheme(config.theme);
        }
    }, [themeMode, config]);

    const toggleTheme = () => {
        setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
    };

    const { config: dynamicConfig, loading: configLoading } = useConfig();
    const location = useLocation();

    useEffect(() => {
        if (configLoading) return;

        const baseCommunityId = dynamicConfig?.hiveCommunityId || DEFAULT_CONFIG.id;
        const isGlobalInstance = baseCommunityId === 'global';

        let overrideCommunityId = null;
        // Strict mapping: Only allow community overrides via URL if instance is global
        if (isGlobalInstance && location.pathname.startsWith('/c/')) {
            const parts = location.pathname.split('/');
            if (parts.length > 2 && parts[2]) {
                overrideCommunityId = parts[2];
            }
        }

        const updateMeta = (configObj: CommunityConfig) => {
            const isGlobal = configObj.id === 'global' || (!overrideCommunityId && dynamicConfig?.hiveCommunityId === 'global');
            const faviconUrl = isGlobal 
                ? '/sovraniche-logo.png' 
                : (!configObj.logo || configObj.logo.includes('vite.svg')) 
                    ? `https://images.hive.blog/u/${configObj.id}/avatar` 
                    : configObj.logo;
            const pageTitle = isGlobal ? 'Sovraniche' : configObj.name;

            document.title = pageTitle;
            let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.type = 'image/png';
            link.href = faviconUrl || '/sovraniche-logo.png';
        };

        if (dynamicConfig) {
            const mergedConfig: CommunityConfig = {
                ...DEFAULT_CONFIG,
                id: overrideCommunityId || dynamicConfig.hiveCommunityId || DEFAULT_CONFIG.id,
                name: dynamicConfig.communityName || DEFAULT_CONFIG.name,
                logo: dynamicConfig.logoUrl || DEFAULT_CONFIG.logo,
                theme: {
                    ...DEFAULT_CONFIG.theme,
                    primaryColor: dynamicConfig.primaryColor,
                }
            };
            setConfig(mergedConfig);
            applyTheme(mergedConfig.theme);
            updateMeta(mergedConfig);
            setIsLoading(false);
        } else {
            const finalConfig = {
                ...DEFAULT_CONFIG,
                id: overrideCommunityId || DEFAULT_CONFIG.id
            };
            setConfig(finalConfig);
            applyTheme(finalConfig.theme);
            updateMeta(finalConfig);
            setIsLoading(false);
        }
    }, [dynamicConfig, configLoading, location.pathname]);

    const applyTheme = (theme: CommunityConfig['theme']) => {
        const root = document.documentElement;

        // Brand colors (Safe to apply globally)
        root.style.setProperty('--primary-color', theme.primaryColor);
        root.style.setProperty('--secondary-color', theme.secondaryColor);
        root.style.setProperty('--accent-color', theme.accentColor);

        // Semantic overrides (Only apply in light mode to prevent scattering in dark mode)
        // If themeMode is dark, we let index.css handle the semantic variables
        if (themeMode === 'light') {
            root.style.setProperty('--bg-canvas', theme.backgroundColor);
            root.style.setProperty('--text-primary', theme.textColor);
            if (theme.cardBackgroundColor) root.style.setProperty('--bg-card', theme.cardBackgroundColor);
            if (theme.borderColor) root.style.setProperty('--border-color', theme.borderColor);
        } else {
            // In dark mode, we remove these inline overrides so index.css can take over
            root.style.setProperty('--bg-canvas', '');
            root.style.setProperty('--text-primary', '');
            root.style.setProperty('--bg-card', '');
            root.style.setProperty('--border-color', '');
        }

        root.style.setProperty('--font-family', theme.fontFamily);
    };

    return (
        <CommunityContext.Provider value={{ config, isLoading, error, themeMode, toggleTheme }}>
            {children}
        </CommunityContext.Provider>
    );
}

export function useCommunity() {
    const context = useContext(CommunityContext);
    if (context === undefined) {
        throw new Error('useCommunity must be used within a CommunityProvider');
    }
    return context;
}
