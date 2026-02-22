import { QRCodeSVG } from 'qrcode.react';
import { CopyButton } from './CopyButton';

interface QRModalProps {
    address: string;
    chain: string;
    imageUrl?: string;
    onClose: () => void;
}

export function QRModal({ address, chain, imageUrl, onClose }: QRModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {imageUrl && (
                            <img src={imageUrl} alt={chain} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="font-bold text-[var(--text-primary)]">{chain} Address</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* QR Code */}
                <div className="p-6 flex flex-col items-center gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-inner">
                        <QRCodeSVG value={address} size={180} level="H" />
                    </div>
                    <div className="flex flex-col items-center gap-3 w-full">
                        <p className="text-[10px] text-[var(--text-secondary)] text-center break-all font-mono leading-relaxed bg-[var(--bg-canvas)] p-3 rounded-xl border border-[var(--border-color)]/50 w-full">
                            {address}
                        </p>
                        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors group cursor-pointer"
                            onClick={() => {
                                navigator.clipboard.writeText(address);
                                // We use the button for feedback below but this makes the area clickable
                            }}>
                            <CopyButton text={address} />
                            <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Copy Address</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
