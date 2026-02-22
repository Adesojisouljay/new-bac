import { useState } from 'react';
import { swapService, SwapQuote } from '../../../services/swapService';
import { RawWallets, Web3WalletInfo } from '../../../services/web3WalletService';
import { ethers } from 'ethers';
import { useNotification } from '../../../contexts/NotificationContext';

interface SwapModalProps {
    onClose: () => void;
    initialFromAsset?: Web3WalletInfo;
    rawWallets: RawWallets | null;
    onSuccess?: (hash: string) => void;
}

// Minimal Chain Map for Li.Fi
const LIFI_CHAINS: Record<string, number> = {
    'ETH': 1,
    'BNB': 56,
    'BASE': 8453,
    'POLYGON': 137,
    'ARBITRUM': 42161,
};

export function SwapModal({ onClose, initialFromAsset, rawWallets, onSuccess }: SwapModalProps) {
    const { showNotification } = useNotification();
    const [loading, setLoading] = useState(false);
    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [amount, setAmount] = useState('');
    const [toChain, setToChain] = useState<number>(8453); // Default to Base
    const [toToken] = useState<string>('0x0000000000000000000000000000000000000000'); // Native

    const fromChainId = initialFromAsset ? LIFI_CHAINS[initialFromAsset.chain] : 1;
    const fromToken = initialFromAsset?.chain === 'USDT_BEP20' ? '0x55d398326f99059fF775485246999027B3197955' : '0x0000000000000000000000000000000000000000';

    const handleGetQuote = async () => {
        if (!amount || !initialFromAsset || !fromChainId) return;
        setLoading(true);
        try {
            const q = await swapService.getQuote({
                fromChain: fromChainId,
                toChain,
                fromToken,
                toToken,
                fromAmount: ethers.parseUnits(amount, initialFromAsset.chain.includes('USDT') ? 18 : 18).toString(), // USDT BEP20 is 18 decimals usually? Check BEP20 USDT decimals
                fromAddress: initialFromAsset.address
            });
            setQuote(q);
        } catch (err: any) {
            showNotification(`Failed to get quote: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!quote || !rawWallets || !initialFromAsset) return;

        const privateKey = (rawWallets[initialFromAsset.chain] as any)?.privateKey;
        if (!privateKey) {
            showNotification("Wallet is locked or private key missing", "error");
            return;
        }

        setLoading(true);
        try {
            // 1. Setup provider/signer with improved RPCs
            let rpcUrl = "https://rpc.ankr.com/eth";
            if (initialFromAsset.chain === 'BNB' || initialFromAsset.chain === 'USDT_BEP20') rpcUrl = "https://binance.llamarpc.com";
            else if (initialFromAsset.chain === 'BASE') rpcUrl = "https://base.llamarpc.com";
            else if (initialFromAsset.chain === 'POLYGON') rpcUrl = "https://polygon.llamarpc.com";
            else if (initialFromAsset.chain === 'ARBITRUM') rpcUrl = "https://arbitrum.llamarpc.com";

            console.log(`Connecting to RPC for ${initialFromAsset.chain}: ${rpcUrl}`);
            const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
            const signer = new ethers.Wallet(privateKey, provider);

            // 2. Execute Transaction
            const tx = await signer.sendTransaction({
                to: quote.transactionRequest.to,
                data: quote.transactionRequest.data,
                value: quote.transactionRequest.value,
                // gasLimit: quote.transactionRequest.gasLimit, // Let ethers estimate to avoid 'Failed to fetch' network detection issues
            });

            showNotification("Swap transaction submitted!", "success");
            onSuccess?.(tx.hash);
            onClose();
        } catch (err: any) {
            console.error("Swap execution error:", err);
            const detail = err.reason || err.message || "Unknown network error";
            showNotification(`Swap failed: ${detail}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-6 right-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <h2 className="text-2xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-3">
                    <span className="p-2 bg-[var(--primary-color)]/10 rounded-xl">🔄</span>
                    Cross-Chain Swap
                </h2>

                <div className="space-y-6">
                    {/* From Asset */}
                    <div className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">Sell</label>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={initialFromAsset?.imageUrl} className="w-8 h-8 rounded-full" />
                                <span className="font-bold text-[var(--text-primary)]">{initialFromAsset?.chain}</span>
                            </div>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.0"
                                className="bg-transparent text-right font-black text-xl text-[var(--text-primary)] focus:outline-none w-1/2"
                            />
                        </div>
                    </div>

                    {/* Swap Icon */}
                    <div className="flex justify-center -my-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--primary-color)] text-white flex items-center justify-center shadow-lg z-10">
                            ↓
                        </div>
                    </div>

                    {/* To Chain Selection (Simplified for now) */}
                    <div className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)]">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">Buy on</label>
                        <select
                            className="bg-transparent font-bold text-[var(--text-primary)] w-full focus:outline-none"
                            value={toChain}
                            onChange={(e) => setToChain(Number(e.target.value))}
                        >
                            <option value={1}>Ethereum</option>
                            <option value={56}>BNB Smart Chain</option>
                            <option value={8453}>Base</option>
                            <option value={137}>Polygon</option>
                            <option value={42161}>Arbitrum</option>
                        </select>
                    </div>

                    {quote && (
                        <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/20 space-y-2 animate-in slide-in-from-top-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--text-secondary)]">You receive</span>
                                <span className="font-bold text-green-500">{Number(ethers.formatUnits(quote.estimate.toAmount, 18)).toFixed(6)} Assets</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--text-secondary)]">Gas Fee</span>
                                <span className="font-bold text-[var(--text-primary)]">~${quote.estimate.feeCosts[0]?.amountUsd || '0.00'}</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={quote ? handleExecute : handleGetQuote}
                        disabled={loading || !amount}
                        className="w-full py-4 bg-[var(--primary-color)] text-white font-black rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-[var(--primary-color)]/20 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : quote ? 'Confirm Swap' : 'Get Best Quote'}
                    </button>
                </div>
            </div>
        </div>
    );
}
