export interface CommunityTheme {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    cardBackgroundColor?: string;
    textColor: string;
    borderColor?: string;
    fontFamily: string;
}

export interface CommunityFeatures {
    hiveAuth: boolean;
    pointsSystem: boolean;
    market: boolean;
    governance: boolean;
}

export interface CommunityConfig {
    id: string;
    name: string;
    domain: string;
    description: string;
    logo: string;
    theme: CommunityTheme;
    features: CommunityFeatures;
    apiEndpoint: string;
    hiveAccount: string;
}
