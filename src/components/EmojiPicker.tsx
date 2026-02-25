import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
    {
        label: '😊 Smileys',
        emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '🤩', '😜', '😝', '🤔', '🤗', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '😱', '😨', '😰', '😓', '🤤', '😪', '🤒', '🤕', '🥴', '😵', '😷', '🤧', '🥶', '🥵', '😴'],
    },
    {
        label: '👋 Gestures',
        emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '👀', '👁', '🫀', '🫁', '🧠', '🦷', '🦴', '👂', '🦻', '👃', '👅', '👄', '💋'],
    },
    {
        label: '❤️ Hearts & Symbols',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☯️', '🔥', '💢', '💥', '💫', '💦', '💨', '🌈', '⭐', '🌟', '✨', '💤', '‼️', '⁉️', '❓', '❗', '💯', '🔔', '🎵', '🎶', '🎉', '🎊', '🎁'],
    },
    {
        label: '🐶 Animals',
        emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🌵', '🐢', '🦎', '🐍', '🦕', '🦖', '🐳', '🐬', '🦈', '🐙', '🦑'],
    },
    {
        label: '🍎 Food',
        emojis: ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍈', '🍑', '🍒', '🥭', '🍍', '🥥', '🥝', '🍅', '🫒', '🥑', '🍆', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧅', '🥔', '🍟', '🍕', '🌮', '🌯', '🥗', '🍱', '🍣', '🍔', '🍦', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍭', '☕', '🍵', '🧋', '🍺', '🥂'],
    },
    {
        label: '⚽ Activities',
        emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🥊', '🥋', '🎯', '⛳', '🎣', '🤿', '🎿', '🛷', '🥌', '🎮', '🕹️', '🎲', '♟️', '🎰', '🧩', '🎭', '🎨', '🎼', '🎵', '🥁', '🎷', '🎸', '🎺', '🎻', '🎤', '🎧', '📻'],
    },
    {
        label: '🌍 Travel',
        emojis: ['🌍', '🌎', '🌏', '🗺️', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏙️', '🌃', '🌆', '🌇', '🌉', '🚀', '🛸', '✈️', '🚂', '🚢', '🚗', '🚕', '🚙', '🚌', '🏠', '🏡', '🏢', '🏩', '🏰', '⛩️', '🛕', '⛪', '🕌', '🕍'],
    },
];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
    const [open, setOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className={`p-3 rounded-2xl border-2 transition-all text-[var(--text-secondary)] ${open
                        ? 'bg-[var(--primary-color)]/10 border-[var(--primary-color)] text-[var(--primary-color)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--primary-color)]/5 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]'
                    }`}
                title="Emoji"
            >
                <Smile size={24} />
            </button>

            {open && (
                <div className="absolute bottom-14 left-0 w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-150">
                    {/* Category tabs */}
                    <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border-color)] px-2 pt-2 gap-1">
                        {EMOJI_CATEGORIES.map((cat, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setActiveCategory(i)}
                                className={`px-2 py-1.5 text-xs font-bold whitespace-nowrap rounded-t-lg transition-all flex-shrink-0 ${activeCategory === i
                                        ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                {cat.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>

                    {/* Emoji grid */}
                    <div className="p-2 grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto">
                        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    onSelect(emoji);
                                    setOpen(false);
                                }}
                                className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-canvas)] active:scale-90 transition-all"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
