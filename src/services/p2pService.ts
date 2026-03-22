import axios from 'axios';

export type FiatCurrency = 'USD' | 'EUR' | 'NGN' | 'GBP' | 'MXN' | 'GHS';
export type CryptoCurrency = 'HIVE' | 'HBD';
export type TradeType = 'BUY' | 'SELL';
export type PaymentMethod = string;

export interface UserReputation {
    username: string;
    totalTrades: number;
    completionRate: number; // Percentage 0-100
    avgReleaseTimeMins: number;
}

export interface P2PAd {
    id: string;
    maker: UserReputation;
    type: TradeType;
    crypto: CryptoCurrency;
    fiat: FiatCurrency;
    price: number; 
    availableCrypto: number;
    minOrderFiat: number;
    maxOrderFiat: number;
    paymentMethods: string[];
    terms: string;
    isVerified: boolean;
    bankDetails?: {
        bankName: string;
        accountName: string;
        accountNumber: string;
    };
    createdAt: string;
}

// Emulate Merchant Reputations locally (since we don't have a backend reputation table yet)
const getMockReputation = (username: string): UserReputation => ({
    username,
    totalTrades: Math.floor(Math.random() * 500) + 10,
    completionRate: Math.floor(Math.random() * 15) + 85,
    avgReleaseTimeMins: Math.floor(Math.random() * 10) + 1
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class P2PService {
    /**
     * Fetch active P2P ads dynamically from the Database
     */
    static async getAds(userAction: TradeType, crypto: CryptoCurrency, fiat: FiatCurrency): Promise<P2PAd[]> {
        const makerAction: TradeType = userAction === 'BUY' ? 'SELL' : 'BUY';
        
        try {
            const { data } = await axios.get(`${API_URL}/p2p/ads`, {
                params: { type: makerAction, cryptoCurrency: crypto, fiatCurrency: fiat }
            });
            
            // Map MongoDB _id strictly into frontend schema expectations
            return data.data.map((ad: any) => ({
                id: ad._id,
                maker: getMockReputation(ad.makerId),
                type: ad.type,
                crypto: ad.cryptoCurrency,
                fiat: ad.fiatCurrency,
                price: ad.price,
                availableCrypto: ad.availableCryptoAmount || (ad.maxLimit / ad.price),
                minOrderFiat: ad.minLimit,
                maxOrderFiat: ad.maxLimit,
                paymentMethods: ad.paymentMethods,
                terms: ad.terms,
                bankDetails: ad.bankDetails,
                createdAt: ad.createdAt
            }));
        } catch (err) {
            console.error("Failed to fetch Live Database Ads:", err);
            return [];
        }
    }

    /**
     * Push a new Ad to the Marketplace Ledger
     */
    static async createAd(payload: any) {
        const { data } = await axios.post(`${API_URL}/p2p/ads`, payload);
        return data;
    }

    /**
     * Start a new Trade Order targeting a matched Ad
     */
    static async createOrder(payload: any) {
        const { data } = await axios.post(`${API_URL}/p2p/orders`, payload);
        return {
            id: data.data._id,
            ...data.data
        };
    }

    /**
     * Fetch a specific active Trade Escrow
     */
    static async getOrder(orderId: string) {
        const { data } = await axios.get(`${API_URL}/p2p/orders/${orderId}`);
        return {
            id: data.data._id,
            ...data.data
        };
    }

    /**
     * Fetch History Escrow pipelines for the P2P Dashboard
     */
    static async getUserOrders(username: string) {
        const { data } = await axios.get(`${API_URL}/p2p/orders/user/${username}`);
        return data.data; 
    }

    /**
     * Fetch the user's active Advertisements for the Maker Dashboard
     */
    static async getUserAds(username: string) {
        const { data } = await axios.get(`${API_URL}/p2p/ads/user/${username}`);
        return data.data;
    }

    /**
     * Close an active Ad and refund the remaining liquidity Escrow
     */
    static async closeAd(id: string) {
        const { data } = await axios.put(`${API_URL}/p2p/ads/${id}/close`);
        return data.success;
    }

    /**
     * Update an active Ad configuration without disrupting Escrow
     */
    static async updateAd(id: string, payload: any) {
        const { data } = await axios.put(`${API_URL}/p2p/ads/${id}`, payload);
        return data.data;
    }

    /**
     * Abort an Escrow that's AWAITING_PAYMENT
     */
    static async cancelOrder(id: string) {
        const { data } = await axios.put(`${API_URL}/p2p/orders/${id}/cancel`);
        return data.data;
    }

    /**
     * Mark Escrow as Fiat Paid
     */
    static async confirmPayment(id: string) {
        const { data } = await axios.put(`${API_URL}/p2p/orders/${id}/confirm`);
        return data.data;
    }

    /**
     * Mark Escrow as Completed securely on REST API
     */
    static async completeOrder(id: string) {
        const { data } = await axios.put(`${API_URL}/p2p/orders/${id}/complete`);
        return data.data;
    }

    /**
     * Bank Account Directory
     */
    static async getBankAccounts(username: string) {
        const { data } = await axios.get(`${API_URL}/p2p/bank-accounts/${username}`);
        return data.data;
    }

    static async addBankAccount(payload: any) {
        const username = localStorage.getItem('hive_user');
        const { data } = await axios.post(`${API_URL}/p2p/bank-accounts`, { username, ...payload });
        return data.data;
    }

    static async deleteBankAccount(id: string) {
        const { data } = await axios.delete(`${API_URL}/p2p/bank-accounts/${id}`);
        return data.data;
    }
}
