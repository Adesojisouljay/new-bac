import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { CopyButton } from './CopyButton';

interface MnemonicModalProps {
    mnemonic: string;
    username: string;
    onConfirm: () => void;
    onClose: () => void;
}

export function MnemonicModal({ mnemonic, username, onConfirm, onClose }: MnemonicModalProps) {
    const [confirmed, setConfirmed] = useState(false);
    const words = mnemonic.split(/\s+/);

    const cleanUser = username?.replace(/^@/, '') || 'wallet';

    const handleDownload = () => {
        console.log('[MnemonicModal] handleDownload called with username:', username);
        const element = document.createElement('a');
        const file = new Blob([mnemonic], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `HIVE-${cleanUser}-sovraniche-backup.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/50 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-full transition-all active:scale-90 z-10"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🔐</span>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Secure Your Recovery Phrase</h2>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        This is the only time you will see these 12 words. They are the keys to your Web3 assets.
                    </p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6 overflow-y-auto flex-1 CustomScrollbar">
                    {/* Warning Box */}
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-4 items-start">
                        <span className="text-xl">⚠️</span>
                        <div className="text-sm">
                            <p className="font-bold text-red-500 mb-1">Never share this phrase with anyone!</p>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                Sovraniche cannot recover your phrase if you lose it. Anyone who has this phrase can steal your funds.
                            </p>
                        </div>
                    </div>

                    {/* Word Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {words.map((word, i) => (
                            <div
                                key={i}
                                className="bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-3 flex items-center gap-3"
                            >
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] w-4 opacity-50">
                                    {i + 1}
                                </span>
                                <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                                    {word}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Backup Actions */}
                    <div className="flex items-center justify-center gap-4 py-2 border-y border-[var(--border-color)]/50">
                        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-canvas)] rounded-xl hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition-colors group">
                            <CopyButton text={mnemonic} />
                            <span className="text-xs font-bold text-[var(--text-secondary)]">Copy Phrase</span>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-canvas)] rounded-xl hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition-colors group"
                        >
                            <Download className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />
                            <span className="text-xs font-bold text-[var(--text-secondary)]">Save {cleanUser}.txt</span>
                        </button>
                    </div>

                    {/* Confirmation */}
                    <label className="flex items-start gap-3 p-4 bg-[var(--bg-canvas)]/50 rounded-2xl cursor-pointer group hover:bg-[var(--bg-canvas)] transition-colors">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="mt-1 w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary-color)] focus:ring-[var(--primary-color)] cursor-pointer"
                        />
                        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                            I have written down these 12 words in a safe offline location. I understand that if I lose them, I lose my funds forever.
                        </span>
                    </label>
                </div>

                {/* Actions */}
                <div className="p-6 bg-[var(--bg-canvas)]/50 border-t border-[var(--border-color)] flex justify-end">
                    <button
                        onClick={onConfirm}
                        disabled={!confirmed}
                        className="px-8 py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--primary-color)]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Confirm & Save
                    </button>
                </div>
            </div>
        </div>
    );
}
