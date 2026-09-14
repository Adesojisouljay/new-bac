import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CopyButton } from './CopyButton';

interface QRModalProps {
    address: string;
    chain: string;
    imageUrl?: string;
    viewKey?: string;
    privateKey?: string;
    onUnlock?: () => Promise<any>;
    onClose: () => void;
}

export function QRModal({ address, chain, imageUrl, viewKey, privateKey, onUnlock, onClose }: QRModalProps) {
    const [showViewKey, setShowViewKey] = useState(false);
    const [showSpendKey, setShowSpendKey] = useState(false);
    const [unlocking, setUnlocking] = useState(false);

    const handleUnlockClick = async () => {
        if (!onUnlock) return;
        setUnlocking(true);
        try {
            await onUnlock();
        } finally {
            setUnlocking(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        {imageUrl && (
                            <img src={imageUrl} alt={chain} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="font-bold text-base text-[var(--text-primary)]">{chain} Wallet Details</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* QR Code & Address */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-white rounded-2xl shadow-md">
                            <QRCodeSVG value={address} size={170} level="H" />
                        </div>
                        <div className="w-full space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Primary Address</span>
                                <CopyButton text={address} />
                            </div>
                            <p className="text-[11px] text-[var(--text-primary)] break-all font-mono leading-relaxed bg-[var(--bg-canvas)] p-3 rounded-xl border border-[var(--border-color)]">
                                {address}
                            </p>
                        </div>
                    </div>

                    {/* Monero / Chain Specific Keys */}
                    {chain === 'XMR' && (
                        <div className="space-y-4 pt-2 border-t border-[var(--border-color)]">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--primary-color)]">
                                    Private Keys (Cake Wallet / Monero GUI)
                                </h4>
                                {!viewKey && onUnlock && (
                                    <button
                                        onClick={handleUnlockClick}
                                        disabled={unlocking}
                                        className="text-xs font-bold text-[var(--primary-color)] hover:underline"
                                    >
                                        {unlocking ? 'Signing…' : 'Unlock Keys'}
                                    </button>
                                )}
                            </div>

                            {/* Private View Key */}
                            {viewKey ? (
                                <div className="space-y-1.5 bg-[var(--bg-canvas)] p-3.5 rounded-2xl border border-[var(--border-color)]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-[var(--text-primary)]">Private View Key</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">Secret</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowViewKey(!showViewKey)}
                                                className="p-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                title={showViewKey ? "Hide View Key" : "Reveal View Key"}
                                            >
                                                {showViewKey ? "Hide" : "Reveal"}
                                            </button>
                                            <CopyButton text={viewKey} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                        Required by Cake Wallet or Monero node to scan and display your balance.
                                    </p>
                                    <p className="text-[11px] font-mono break-all text-[var(--text-primary)] bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
                                        {showViewKey ? viewKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-dashed border-[var(--border-color)] text-center">
                                    <p className="text-xs text-[var(--text-secondary)] mb-2">Private View Key is locked.</p>
                                    {onUnlock && (
                                        <button
                                            onClick={handleUnlockClick}
                                            disabled={unlocking}
                                            className="px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:brightness-110 transition-all"
                                        >
                                            {unlocking ? 'Authorizing…' : 'Authorize with Keychain to Reveal'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Private Spend Key */}
                            {privateKey && (
                                <div className="space-y-1.5 bg-[var(--bg-canvas)] p-3.5 rounded-2xl border border-[var(--border-color)]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-[var(--text-primary)]">Private Spend Key</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-bold">Never Share</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowSpendKey(!showSpendKey)}
                                                className="p-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                title={showSpendKey ? "Hide Spend Key" : "Reveal Spend Key"}
                                            >
                                                {showSpendKey ? "Hide" : "Reveal"}
                                            </button>
                                            <CopyButton text={privateKey} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                        Required if you want full spending control in Cake Wallet / Monero GUI.
                                    </p>
                                    <p className="text-[11px] font-mono break-all text-[var(--text-primary)] bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
                                        {showSpendKey ? privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                                    </p>
                                </div>
                            )}

                            {/* Cake Wallet Import Instructions */}
                            <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
                                    <span>🍰 How to Restore in Cake Wallet:</span>
                                </div>
                                <ol className="text-[11px] text-[var(--text-secondary)] space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>Open Cake Wallet → <strong>Restore Wallet</strong> → <strong>Monero</strong>.</li>
                                    <li>Choose <strong>"Restore from Keys"</strong> (do <em>not</em> choose 24/25-word seed).</li>
                                    <li>Paste your <strong>Address</strong> and <strong>Private View Key</strong> (and Spend Key to send).</li>
                                    <li>Set the restore date to <strong>yesterday</strong> or block height <strong>3755000</strong>.</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
