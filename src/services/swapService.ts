import axios from 'axios';

const API_BASE = 'http://localhost:4001/api/swap';

export interface SwapQuote {
    id: string;
    type: string;
    tool: string;
    transactionRequest: {
        to: string;
        data: string;
        value: string;
        gasPrice: string;
        gasLimit: string;
        chainId: number;
    };
    estimate: {
        fromAmount: string;
        toAmount: string;
        toAmountMin: string;
        approvalAddress: string;
        feeCosts: any[];
    };
    action: {
        fromChainId: number;
        toChainId: number;
        fromToken: any;
        toToken: any;
        fromAmount: string;
    };
}

export const swapService = {
    getChains: async () => {
        const response = await axios.get(`${API_BASE}/chains`);
        return response.data.chains;
    },

    getTokens: async (chain: string | number) => {
        const response = await axios.get(`${API_BASE}/tokens`, {
            params: { chain }
        });
        return response.data.tokens;
    },

    getQuote: async (params: {
        fromChain: number;
        toChain: number;
        fromToken: string;
        toToken: string;
        fromAmount: string;
        fromAddress: string;
    }): Promise<SwapQuote> => {
        const response = await axios.post(`${API_BASE}/quote`, params);
        return response.data;
    }
};
