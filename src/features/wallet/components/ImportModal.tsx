import { useState } from 'react';
import { X, KeyIcon, ShieldCheck } from 'lucide-react';

interface ImportModalProps {
    onClose: () => void;
    onImport: (phrase: string) => void;
}

export function ImportModal({ onClose, onImport }: ImportModalProps) {
    const [phrase, setPhrase] = useState('');
    const [loading, setLoading] = useState(false);



    const handleSubmit = async () => {
        const clean = phrase.trim();
        if (clean.split(/\s+/).length < 12) return;
        setLoading(true);
        try {
            await onImport(clean);
        } catch (error) {
            console.error('Import error in modal:', error);
        } finally {
            setLoading(false);
        }
    };

    const wordCount = phrase.trim() === '' ? 0 : phrase.trim().split(/\s+/).length;
    const isValid = wordCount >= 12;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)]">
                            <KeyIcon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight">Import Wallet</h2>
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black opacity-60">Recovery Phrase</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4 items-start">
                        <ShieldCheck className="text-blue-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            Enter your <span className="text-[var(--text-primary)] font-bold">12 or 24-word</span> recovery phrase. Your keys are encrypted locally and never leave your device.
                        </p>
                    </div>

                    <div className="relative">
                        <textarea
                            autoFocus
                            value={phrase}
                            onChange={(e) => setPhrase(e.target.value)}
                            placeholder="word1 word2 word3..."
                            className="w-full h-32 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-5 text-sm font-mono leading-relaxed text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all resize-none placeholder:opacity-20"
                        />
                        <div className={`absolute bottom-4 right-4 text-[10px] font-bold px-2 py-1 rounded-md ${isValid ? 'text-green-500 bg-green-500/10' : 'text-[var(--text-secondary)] bg-[var(--bg-canvas)] opacity-50'}`}>
                            {wordCount} / 12 Words
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-[var(--bg-canvas)]/50 border-t border-[var(--border-color)] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid || loading}
                        className="px-10 py-3 bg-[var(--primary-color)] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[var(--primary-color)]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
}
