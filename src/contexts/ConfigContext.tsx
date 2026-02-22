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
        const data = await configService.fetchConfig(domain);

        if (data) {
            setConfig(data);
            setIsConfigured(true);

            // Inject primary color into CSS
            if (data.primaryColor) {
                document.documentElement.style.setProperty('--primary-color', data.primaryColor);
            }
        } else {
            setIsConfigured(false);
        }
        setLoading(false);
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
