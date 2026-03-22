import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, ShieldCheck, ArrowRightLeft, Plus, CheckCircle2 } from 'lucide-react';
import { P2PService, P2PAd, TradeType } from '../../../services/p2pService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    ad: P2PAd;
    userAction: TradeType;
}

export default function P2POrderModal({ isOpen, onClose, ad, userAction }: Props) {
    const navigate = useNavigate();
    const [fiatAmount, setFiatAmount] = useState<string>('');
    const [cryptoAmount, setCryptoAmount] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Taker Bank State
    const [savedBanks, setSavedBanks] = useState<any[]>([]);
    const [selectedBank, setSelectedBank] = useState<any>(null);
    const [isAddingBank, setIsAddingBank] = useState(false);
    const [newBank, setNewBank] = useState({ bankName: '', accountName: '', accountNumber: '' });

    const isBuy = userAction === 'BUY';

    useEffect(() => {
        if (!isOpen) return;
        if (!isBuy) {
            const username = localStorage.getItem('hive_user');
            if (username) {
                P2PService.getBankAccounts(username).then(banks => {
                    if (banks) setSavedBanks(banks.map((b: any) => ({
                        _id: b._id, bankName: b.bankName, accountName: b.accountName, accountNumber: b.accountNumber
                    })));
                }).catch(console.error);
            }
        }
    }, [isOpen, isBuy]);

    const handleAddBank = async () => {
        try {
            const added = await P2PService.addBankAccount(newBank);
            setSavedBanks(prev => [added, ...prev]);
            setSelectedBank(added);
            setIsAddingBank(false);
            setNewBank({ bankName: '', accountName: '', accountNumber: '' });
        } catch (err) {
            console.error(err);
            setError("Failed to save bank account.");
        }
    };

    // Prevent background scrolling when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
            setFiatAmount('');
            setCryptoAmount('');
            setError(null);
        };
    }, [isOpen]);

    // Handle Fiat Input changing
    const handleFiatChange = (val: string) => {
        setFiatAmount(val);
        const floatVal = parseFloat(val);
        if (isNaN(floatVal)) {
            setCryptoAmount('');
            setError(null);
            return;
        }

        // Calculate Crypto Equivalent
        const cryptoEq = floatVal / ad.price;
        setCryptoAmount(cryptoEq.toFixed(6));
        validateLimits(floatVal);
    };

    // Handle Crypto Input changing
    const handleCryptoChange = (val: string) => {
        setCryptoAmount(val);
        const floatVal = parseFloat(val);
        if (isNaN(floatVal)) {
            setFiatAmount('');
            setError(null);
            return;
        }

        // Calculate Fiat Equivalent
        const fiatEq = floatVal * ad.price;
        setFiatAmount(fiatEq.toFixed(2));
        validateLimits(fiatEq);
    };

    // Helper bounds checker
    const validateLimits = (fiatVal: number) => {
        if (fiatVal < ad.minOrderFiat) {
            setError(`Minimum order is ${ad.minOrderFiat.toLocaleString()} ${ad.fiat}`);
        } else if (fiatVal > ad.maxOrderFiat) {
            setError(`Maximum order is ${ad.maxOrderFiat.toLocaleString()} ${ad.fiat}`);
        } else {
            setError(null);
        }
    };

    const handleMax = () => {
        handleFiatChange(ad.maxOrderFiat.toString());
    };

    if (!isOpen) return null;

    const parsedFiat = parseFloat(fiatAmount);
    const isValidAmount = !error && !isNaN(parsedFiat) && parsedFiat > 0;
    const isValid = isValidAmount && (isBuy || selectedBank);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                    <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                        {isBuy ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`} <span className="text-[var(--text-secondary)] font-medium">with {ad.fiat}</span>
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 bg-[var(--bg-canvas)] rounded-full hover:bg-[var(--border-color)] transition-colors text-[var(--text-secondary)] hover:text-red-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row h-full overflow-y-auto custom-scrollbar">
                    
                    {/* Left Column: Form & Math */}
                    <div className="flex-1 p-6 lg:border-r border-[var(--border-color)] space-y-6">
                        
                        {/* Price Display */}
                        <div className="bg-[var(--bg-canvas)] p-4 rounded-xl flex items-baseline gap-2">
                            <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wider">Rate</span>
                            <span className="text-2xl font-black text-[var(--primary-color)]">{ad.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-xs font-bold text-[var(--text-secondary)]">{ad.fiat} / {ad.crypto}</span>
                        </div>

                        {/* Math Forms */}
                        <div className="space-y-4">
                            {/* Input 1: I want to pay */}
                            <div>
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                                    I will {isBuy ? 'pay' : 'receive'}
                                </label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        placeholder="1000.00"
                                        value={fiatAmount}
                                        onChange={(e) => handleFiatChange(e.target.value)}
                                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-4 pr-24 outline-none focus:border-[var(--primary-color)] transition-colors text-lg font-bold text-[var(--text-primary)]"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <button onClick={handleMax} className="text-xs font-bold text-[var(--primary-color)] uppercase tracking-wider hover:underline">Max</button>
                                        <span className="text-sm font-black text-[var(--text-secondary)]">| {ad.fiat}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center -my-2 relative z-10">
                                <div className="p-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-full text-[var(--text-secondary)]">
                                    <ArrowRightLeft className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Input 2: I will receive */}
                            <div>
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                                    I will {isBuy ? 'receive' : 'sell'}
                                </label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        placeholder="0.000000"
                                        value={cryptoAmount}
                                        onChange={(e) => handleCryptoChange(e.target.value)}
                                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-4 py-4 pr-16 outline-none focus:border-[var(--primary-color)] transition-colors text-lg font-bold text-[var(--text-primary)]"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--text-secondary)]">{ad.crypto}</span>
                                </div>
                            </div>
                        </div>

                        {/* Taker Receiving Bank Account */}
                        {!isBuy && (
                            <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 block">Where should the Maker send Fiat?</label>
                                
                                {savedBanks.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        {savedBanks.map(bank => {
                                            const isSelected = selectedBank && selectedBank._id === bank._id;
                                            return (
                                                <div 
                                                    key={bank._id} 
                                                    onClick={() => {
                                                        setSelectedBank(bank);
                                                        setIsAddingBank(false);
                                                    }}
                                                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5' : 'border-[var(--border-color)] hover:border-[var(--text-secondary)]/50'}`}
                                                >
                                                    <div>
                                                        <div className="text-sm font-bold text-[var(--text-primary)]">{bank.bankName} - {bank.accountNumber}</div>
                                                        <div className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">{bank.accountName}</div>
                                                    </div>
                                                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[var(--primary-color)]" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {!isAddingBank ? (
                                    <button type="button" onClick={() => setIsAddingBank(true)} className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] rounded-xl text-sm font-bold hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-all">
                                        <Plus className="w-4 h-4" /> Add New Bank Account
                                    </button>
                                ) : (
                                    <div className="p-5 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl space-y-4">
                                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Register New Bank</h4>
                                        <div className="flex flex-col gap-4">
                                            <input type="text" placeholder="Bank Name" value={newBank.bankName} onChange={e => setNewBank({ ...newBank, bankName: e.target.value })} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--primary-color)] text-sm font-bold text-[var(--text-primary)]" />
                                            <input type="text" placeholder="Account Name" value={newBank.accountName} onChange={e => setNewBank({ ...newBank, accountName: e.target.value })} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--primary-color)] text-sm font-bold text-[var(--text-primary)]" />
                                            <input type="text" placeholder="Account Number" value={newBank.accountNumber} onChange={e => setNewBank({ ...newBank, accountNumber: e.target.value })} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3.5 outline-none focus:border-[var(--primary-color)] text-base font-mono font-bold text-[var(--text-primary)] tracking-widest" />
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button type="button" onClick={() => setIsAddingBank(false)} className="flex-1 py-3 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-[var(--border-color)]">Cancel</button>
                                            <button type="button" onClick={handleAddBank} disabled={!newBank.bankName || !newBank.accountName || !newBank.accountNumber} className="flex-1 py-3 bg-[var(--primary-color)] text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-[var(--primary-color)]/20">Save & Use</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 text-red-500 bg-red-500/10 p-3 rounded-xl text-sm font-bold">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button 
                            disabled={!isValid || isSubmitting}
                            onClick={async () => {
                                setIsSubmitting(true);
                                try {
                                    const username = localStorage.getItem('hive_user') || 'adesojisouljay';

                                    // If Ad is BUY, Maker wants Fiat. Taker is paying in Crypto.
                                    // Taker MUST lock the Escrow Liquidity NOW.
                                    if (ad.type === 'BUY') {
                                        const hiveWindow = window as any;
                                        if (!hiveWindow.hive_keychain) {
                                            setError('Hive Keychain is required to lock Escrow Liquidity.');
                                            setIsSubmitting(false);
                                            return;
                                        }

                                        const escrowAccount = import.meta.env.VITE_P2P_ESCROW_ACCOUNT || 'sovra.escrow';
                                        const amountToLock = (parsedFiat / ad.price).toFixed(3);

                                        const transferSuccess = await new Promise((resolve) => {
                                            hiveWindow.hive_keychain.requestTransfer(
                                                username,
                                                escrowAccount,
                                                amountToLock,
                                                `Sovraniche P2P Liquidity Lock`,
                                                ad.crypto,
                                                (response: any) => {
                                                    resolve(response.success);
                                                },
                                                true
                                            );
                                        });

                                        if (!transferSuccess) {
                                            setError('Escrow deposit failed or canceled. Trade aborted.');
                                            setIsSubmitting(false);
                                            return;
                                        }
                                    }

                                    const newOrder = await P2PService.createOrder({
                                        adId: ad.id,
                                        makerId: ad.maker.username,
                                        takerId: username,
                                        type: ad.type,
                                        cryptoCurrency: ad.crypto,
                                        fiatCurrency: ad.fiat,
                                        price: ad.price,
                                        cryptoAmount: parsedFiat / ad.price,
                                        fiatAmount: parsedFiat,
                                        paymentMethodDetails: ad.type === 'SELL' ? {
                                            bankName: ad.bankDetails?.bankName || 'Unknown',
                                            accountName: ad.bankDetails?.accountName || 'Unknown',
                                            accountNumber: ad.bankDetails?.accountNumber || 'Unknown'
                                        } : {
                                            bankName: selectedBank?.bankName || 'Unknown',
                                            accountName: selectedBank?.accountName || 'Unknown',
                                            accountNumber: selectedBank?.accountNumber || 'Unknown'
                                        }
                                    });
                                    onClose();
                                    navigate(`/market/p2p/${newOrder.id}`);
                                } catch (err: any) {
                                    console.error(err);
                                    setError(err.response?.data?.error || 'Failed to construct the trade record.');
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}
                            className={`w-full py-4 rounded-xl font-black tracking-wider uppercase transition-all shadow-lg ${
                                isValid && !isSubmitting
                                ? isBuy ? 'bg-green-500 text-white hover:bg-green-400 hover:scale-[1.02] active:scale-95' : 'bg-red-500 text-white hover:bg-red-400 hover:scale-[1.02] active:scale-95'
                                : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border border-[var(--border-color)] cursor-not-allowed opacity-70'
                            }`}
                        >
                            {isSubmitting ? 'Opening Order...' : 'Open Trade'}
                        </button>
                    </div>

                    {/* Right Column: Maker Context */}
                    <div className="flex-1 p-6 bg-[var(--bg-canvas)]/50 space-y-6">
                        
                        {/* Maker Card */}
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 bg-gradient-to-tr from-[var(--primary-color)] to-purple-500 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-md uppercase">
                                {ad.maker.username[0]}
                            </div>
                            <div>
                                <div className="font-black text-[var(--text-primary)] text-lg mb-1 flex items-center gap-1.5">
                                    {ad.maker.username}
                                    <ShieldCheck className="w-4 h-4 text-green-500" />
                                </div>
                                <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] font-bold tracking-wider">
                                    <span><span className="text-[var(--text-primary)]">{ad.maker.totalTrades}</span> orders</span>
                                    <span className="w-1 h-1 rounded-full bg-[var(--border-color)]"></span>
                                    <span><span className="text-green-500">{ad.maker.completionRate}%</span> completion</span>
                                </div>
                            </div>
                        </div>

                        {/* Details Block */}
                        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]/50">
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-[var(--text-secondary)]">Trade Limits</span>
                                <span className="text-[var(--text-primary)]">{ad.minOrderFiat.toLocaleString()} - {ad.maxOrderFiat.toLocaleString()} {ad.fiat}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-[var(--text-secondary)]">Avg. Release Time</span>
                                <span className="text-[var(--text-primary)]">{ad.maker.avgReleaseTimeMins} Minutes</span>
                            </div>
                            <div className="flex justify-between items-start text-sm font-bold">
                                <span className="text-[var(--text-secondary)] mt-1">Payment Options</span>
                                <div className="flex flex-col items-end gap-1.5">
                                    {ad.paymentMethods.map((pm, i) => (
                                        <span key={i} className="px-3 py-1 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/30 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                            {pm}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Maker Terms */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 mt-4">
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Merchant Terms</h3>
                            <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap decoration-none">
                                {ad.terms || "No special terms provided."}
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
