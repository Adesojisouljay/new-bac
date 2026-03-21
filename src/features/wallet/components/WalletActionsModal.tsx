import { useState, useEffect } from 'react';
import { transactionService, WalletOperation } from '../../wallet/services/transactionService';
import { QRCodeSVG } from 'qrcode.react';
import { useNotification } from '../../../contexts/NotificationContext';

export type WalletActionType = 'transfer' | 'powerup' | 'powerdown' | 'delegate' | 'delegate_rc' | 'deposit_savings' | 'withdraw_savings';

interface WalletActionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: WalletActionType;
    username: string; // The logged-in user
    initialData?: {
        to?: string;
        amount?: string;
        currency?: 'HIVE' | 'HBD';
        memo?: string;
    };
    onSuccess?: () => void;
}

export function WalletActionsModal({ isOpen, onClose, type, username, initialData, onSuccess }: WalletActionsModalProps) {
    const { showNotification } = useNotification();
    const [to, setTo] = useState(initialData?.to || '');
    const [amount, setAmount] = useState(initialData?.amount || '');
    const [currency, setCurrency] = useState<'HIVE' | 'HBD'>(initialData?.currency || 'HIVE');
    const [memo, setMemo] = useState(initialData?.memo || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasQR, setHasQR] = useState<string | null>(null);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 1024;

    // Reset state when modal opens/type changes
    useEffect(() => {
        if (isOpen) {
            setTo(initialData?.to || '');
            setAmount(initialData?.amount || '');
            setCurrency(initialData?.currency || 'HIVE');
            setMemo(initialData?.memo || '');
            setError(null);
            setHasQR(null);

            // Auto-fill 'to' for self-operations
            if (type === 'powerup' || type === 'deposit_savings' || type === 'withdraw_savings') {
                if (!initialData?.to) setTo(username);
            }
        }
    }, [isOpen, type, username, initialData]);

    if (!isOpen) return null;

    const getTitle = () => {
        switch (type) {
            case 'transfer': return 'Transfer Funds';
            case 'powerup': return 'Power Up to HP';
            case 'powerdown': return 'Power Down (Withdraw Vests)';
            case 'delegate': return 'Delegate HP';
            case 'delegate_rc': return 'Delegate Resource Credits';
            case 'deposit_savings': return 'Deposit to Savings';
            case 'withdraw_savings': return 'Withdraw from Savings';
            default: return 'Wallet Action';
        }
    };

    const isToDisabled = type === 'deposit_savings' || type === 'withdraw_savings' || type === 'powerdown';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setHasQR(null);

        try {
            let op: WalletOperation;

            switch (type) {
                case 'transfer':
                    op = { type: 'transfer', username, to, amount: parseFloat(amount).toFixed(3), memo, currency };
                    break;
                case 'powerup':
                    op = { type: 'power_up', username, to, amount: parseFloat(amount).toFixed(3) };
                    break;
                case 'powerdown':
                    op = { type: 'power_down', username, amount: parseFloat(amount).toFixed(3) };
                    break;
                case 'delegate':
                    op = { type: 'delegate', username, delegatee: to, amount: parseFloat(amount).toFixed(3) };
                    break;
                case 'delegate_rc':
                    op = { type: 'delegate_rc', username, delegatee: to, amount: parseFloat(amount) * 1e9 }; // Convert B to raw units
                    break;
                case 'deposit_savings':
                    op = { type: 'deposit_savings', username, to, amount: parseFloat(amount).toFixed(3) };
                    break;
                case 'withdraw_savings':
                    op = { type: 'withdraw_savings', username, to, amount: parseFloat(amount).toFixed(3) };
                    break;
                default:
                    throw new Error("Unknown operation type");
            }

            const result = await transactionService.broadcast(op, ({ qr }) => {
                setHasQR(qr);
                // Auto-redirect on mobile
                if (isMobile) {
                    window.location.href = qr;
                }
            });

            if (result && result.success) {
                showNotification('Operation successful! It may take a few moments to appear on chain.', 'success');
                if (onSuccess) onSuccess();
                onClose();
            } else {
                setError(result?.error || 'Operation failed');
                setHasQR(null);
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
            setHasQR(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">

            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-canvas)]">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{getTitle()}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-card)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6">
                    {(hasQR || (loading && localStorage.getItem('hive_auth_method') === 'hiveauth')) ? (
                        <div className="text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            {hasQR ? (
                                <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto border-4 border-gray-50/50">
                                    <QRCodeSVG value={hasQR} size={180} level="H" />
                                </div>
                            ) : (
                                <div className="p-8 bg-[var(--bg-card)] rounded-full inline-block mx-auto mb-2">
                                    <div className="w-16 h-16 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                                    {hasQR ? (isMobile ? 'Authorize in Keychain' : 'Confirm Transaction') : 'Check Your Device'}
                                </h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[260px] mx-auto">
                                    {hasQR
                                        ? (isMobile ? 'Approve the request in your Keychain app.' : 'Scan with your Hive mobile wallet to sign and broadcast this transaction.')
                                        : 'Please approve the transaction request on your Hive mobile wallet.'}
                                </p>
                            </div>

                            {hasQR && isMobile && (
                                <div className="py-2">
                                    <a
                                        href={hasQR}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary-color)] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all text-sm"
                                    >
                                        Open Keychain App
                                    </a>
                                </div>
                            )}

                            {hasQR && (
                                <button
                                    onClick={() => setHasQR(null)}
                                    className="text-[var(--primary-color)] text-sm font-bold hover:underline py-1"
                                >
                                    Cancel Request
                                </button>
                            )}

                            <div className="flex items-center justify-center gap-2 pt-2">
                                <div className="w-1.5 h-1.5 bg-[var(--primary-color)] rounded-full animate-bounce" />
                                <div className="w-1.5 h-1.5 bg-[var(--primary-color)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-[var(--primary-color)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="text-xs font-bold text-[var(--text-secondary)] ml-1 uppercase tracking-widest">Waiting for Signature</span>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl flex items-center gap-2 animate-in slide-in-from-top-1">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] ml-0.5">To Account</label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--primary-color)] transition-colors">@</span>
                                    <input
                                        type="text"
                                        value={to}
                                        onChange={(e) => setTo(e.target.value.toLowerCase())}
                                        disabled={isToDisabled || loading}
                                        className="w-full pl-8 pr-4 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all disabled:opacity-50"
                                        placeholder="username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] ml-0.5">Amount</label>
                                    <input
                                        type="number"
                                        step={type === 'delegate_rc' ? "0.1" : "0.001"}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        disabled={loading}
                                        className="w-full px-4 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                        placeholder={type === 'delegate_rc' ? "0.0 (B)" : "0.000"}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] ml-0.5">Asset</label>
                                    <div className="relative">
                                        <select
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value as 'HIVE' | 'HBD')}
                                            disabled={type === 'powerup' || type === 'delegate' || type === 'powerdown' || loading}
                                            className="w-full px-3 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all disabled:opacity-50 appearance-none font-bold"
                                        >
                                            {type === 'powerdown' ? (
                                                <option value="VESTS">VESTS</option>
                                            ) : type === 'delegate_rc' ? (
                                                <option value="RC">RC (B)</option>
                                            ) : (
                                                <>
                                                    <option value="HIVE">HIVE</option>
                                                    <option value="HBD">HBD</option>
                                                </>
                                            )}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {type !== 'delegate' && type !== 'powerup' && type !== 'delegate_rc' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] ml-0.5">Memo</label>
                                    <input
                                        type="text"
                                        value={memo}
                                        onChange={(e) => setMemo(e.target.value)}
                                        disabled={loading}
                                        className="w-full px-4 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                        placeholder="Public memo (optional)"
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 text-[var(--text-secondary)] font-bold hover:bg-[var(--bg-canvas)] rounded-xl transition-colors border border-transparent hover:border-[var(--border-color)]"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center shadow-lg shadow-[var(--primary-color)]/20"
                                >
                                    {loading ? (
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Confirm'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
