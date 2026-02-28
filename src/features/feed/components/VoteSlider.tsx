import { useState } from 'react';
import { ThumbsUp, X } from 'lucide-react';

interface VoteSliderProps {
    onVote: (weight: number) => void;
    onClose: () => void;
    isVoting: boolean;
}

export function VoteSlider({ onVote, onClose, isVoting }: VoteSliderProps) {
    const [weight, setWeight] = useState(100);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Hive weight is 1-10000 (100% = 10000)
        onVote(weight * 100);
    };

    return (
        <div className="absolute bottom-full left-0 mb-3 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-[var(--primary-color)]">
                    <ThumbsUp size={16} fill="currentColor" />
                    <span className="text-xs font-bold uppercase tracking-wider">Upvote Weight</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-[var(--bg-canvas)] rounded-lg transition-colors text-[var(--text-secondary)]"
                >
                    <X size={14} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                        <span className="text-2xl font-black text-[var(--text-primary)]">
                            {weight}<span className="text-sm font-bold text-[var(--text-secondary)] ml-1">%</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] opacity-60 mb-1">
                            {weight === 100 ? 'Full Power' : weight > 50 ? 'Strong' : 'Minor'}
                        </span>
                    </div>

                    <input
                        type="range"
                        min="1"
                        max="100"
                        value={weight}
                        onChange={(e) => setWeight(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-[var(--bg-canvas)] rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isVoting}
                    className="w-full py-2.5 bg-[var(--primary-color)] text-white rounded-xl font-bold text-sm shadow-lg shadow-[var(--primary-color)]/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    {isVoting ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <span>Confirm Vote</span>
                            <ThumbsUp size={14} fill="currentColor" />
                        </>
                    )}
                </button>
            </form>

            {/* Triangle Pointer */}
            <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-[var(--bg-card)] border-r border-b border-[var(--border-color)] rotate-45" />
        </div>
    );
}
