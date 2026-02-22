import { KeychainSDK } from 'keychain-sdk';

// Initialize the SDK
const keychain = new KeychainSDK(window);

export interface WalletOperationResult {
    success: boolean;
    error?: string;
    result?: any;
}

// Helper to ensure decimal places
const formatAmount = (amount: string | number, precision: number = 3): string => {
    return parseFloat(amount.toString()).toFixed(precision);
};

export const walletService = {
    /**
     * Power Down (Withdraw Vests).
     * Note: Amount should be in VESTS.
     */
    powerDown: async (username: string, vesting_shares: string): Promise<WalletOperationResult> => {
        try {
            const response = await keychain.powerDown({
                username,
                vesting_shares: formatAmount(vesting_shares, 6), // VESTS use 6 decimals
                enforce: false
            } as any);
            return { success: response.success, result: response, error: response.error as string };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Transfer HIVE or HBD to another account.
     */
    transfer: async (username: string, to: string, amount: string, memo: string, currency: 'HIVE' | 'HBD'): Promise<WalletOperationResult> => {
        try {
            const response = await keychain.transfer({
                username,
                to,
                amount: formatAmount(amount),
                memo,
                currency,
                enforce: false
            } as any);
            return { success: response.success, result: response, error: response.error as string };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Power Up HIVE to VESTS (Hive Power).
     */
    powerUp: async (username: string, to: string, amount: string): Promise<WalletOperationResult> => {
        try {
            const response = await keychain.powerUp({
                username,
                to,
                amount: formatAmount(amount),
                enforce: false
            } as any);
            return { success: response.success, result: response, error: response.error as string };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Delegate Hive Power to another account.
     */
    delegate: async (username: string, delegatee: string, amount: string, unit: 'VESTS' | 'HP' = 'HP'): Promise<WalletOperationResult> => {
        try {
            const response = await keychain.delegation({
                username,
                delegatee,
                amount: formatAmount(amount),
                unit,
                enforce: false
            } as any);
            return { success: response.success, result: response, error: response.error as string };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Deposit HIVE/HBD into Savings.
     * Uses generic broadcast since specific method might not exist in simplified SDK types.
     */
    depositToSavings: async (username: string, to: string, amount: string, memo: string, currency: 'HIVE' | 'HBD'): Promise<WalletOperationResult> => {
        try {
            const operation = [
                'transfer_to_savings',
                {
                    from: username,
                    to,
                    amount: `${formatAmount(amount)} ${currency}`,
                    memo
                }
            ];

            const response = await keychain.broadcast({
                username,
                operations: [operation as any],
                method: 'Active'
            } as any);

            return { success: response.success, result: response, error: response.error as string };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Withdraw HIVE/HBD from Savings.
     */
    withdrawFromSavings: async (username: string, to: string, amount: string, memo: string, currency: 'HIVE' | 'HBD'): Promise<WalletOperationResult> => {
        try {
            // Note: Request ID is auto-generated usually, but for manual op we might need to handle it. 
            // Often 0 is acceptable for new requests.
            const request_id = Math.floor(Math.random() * 1000000);
            const operation = [
                'transfer_from_savings',
                {
                    from: username,
                    request_id,
                    to,
                    amount: `${formatAmount(amount)} ${currency}`,
                    memo
                }
            ];

            const response = await keychain.broadcast({
                username,
                operations: [operation as any],
                method: 'Active'
            } as any);

            return { success: response.success, result: response, error: response.error as string };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
};
