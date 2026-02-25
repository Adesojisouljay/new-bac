import React, { useState, useRef, useEffect } from 'react';
import { Smile, Sticker, Clock, Star, TrendingUp, Search } from 'lucide-react';

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
        label: '❤️ Hearts',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '💢', '💥', '💫', '💦', '💨', '🌈', '⭐', '🌟', '✨', '💤'],
    },
    {
        label: '🐶 Animals',
        emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🌵', '🐢', '🦎', '🐍', '🦕', '🦖', '🐳', '🐬', '🦈', '🐙', '🦑'],
    },
];

const STICKER_CATEGORIES: { label: string; icon: string; stickers: { url: string; alt: string }[] }[] = [
    {
        label: 'Greetings',
        icon: '👋',
        stickers: [
            { url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', alt: 'Hello wave' },
            { url: 'https://media.giphy.com/media/l0MYB8Ory7Hqedum4/giphy.gif', alt: 'Hi there' },
            { url: 'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif', alt: 'Hello kitty' },
            { url: 'https://media.giphy.com/media/IThjAlJnD9WNO/giphy.gif', alt: 'Hey' },
        ],
    },
    {
        label: 'Reactions',
        icon: '🙌',
        stickers: [
            { url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', alt: 'Clapping' },
            { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', alt: 'Thumbs up' },
            { url: 'https://media.giphy.com/media/l41YkFIiBxQdRlMnS/giphy.gif', alt: 'OMG' },
            { url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif', alt: 'Mind blown' },
        ],
    },
];

interface MediaPickerProps {
    onEmojiSelect: (emoji: string) => void;
    onStickerSelect: (url: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({
    onEmojiSelect,
    onStickerSelect,
    isOpen,
    onToggle,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
    const [activeCategory, setActiveCategory] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={onToggle}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all"
                title="Open Emoji & Stickers"
            >
                <Smile size={24} />
            </button>
        );
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={onToggle}
                className="p-2 text-[var(--primary-color)] transition-all"
                title="Close Emoji & Stickers"
            >
                <Smile size={24} />
            </button>

            <div className="absolute bottom-12 right-0 w-[320px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                {/* Search Header */}
                <div className="p-3 border-b border-[var(--border-color)]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                        <input
                            type="text"
                            placeholder="Search with text or emoji"
                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--primary-color)]"
                        />
                    </div>
                </div>

                {/* Main Tabs */}
                <div className="flex p-1 bg-[var(--bg-canvas)]/50 gap-1">
                    {(['emoji', 'gif', 'sticker'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setActiveCategory(0); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${activeTab === tab
                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            {tab}s
                        </button>
                    ))}
                </div>

                {/* Categories */}
                {activeTab === 'emoji' && (
                    <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border-color)] px-2 pt-2 gap-1">
                        {EMOJI_CATEGORIES.map((cat, i) => (
                            <button
                                key={i}
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
                )}

                {/* Content Grid */}
                <div className="p-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {activeTab === 'emoji' ? (
                        <div className="grid grid-cols-8 gap-1">
                            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
                                <button
                                    key={i}
                                    onClick={() => onEmojiSelect(emoji)}
                                    className="text-2xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-canvas)] active:scale-90 transition-all font-['Apple_Color_Emoji','Segoe_UI_Emoji']"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    ) : activeTab === 'sticker' ? (
                        <div className="space-y-4">
                            {STICKER_CATEGORIES.map((cat, idx) => (
                                <div key={idx}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1 mb-2">
                                        {cat.label}
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {cat.stickers.map((sticker, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { onStickerSelect(sticker.url); onClose(); }}
                                                className="rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--primary-color)] active:scale-95 transition-all aspect-square bg-[var(--bg-canvas)]"
                                            >
                                                <img src={sticker.url} alt={sticker.alt} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-[var(--text-secondary)] italic text-sm">
                            GIF integration coming soon...
                        </div>
                    )}
                </div>

                {/* Bottom Navigation Icons */}
                <div className="flex justify-around py-2 border-t border-[var(--border-color)] text-[var(--text-secondary)]">
                    <Clock size={20} className="hover:text-[var(--primary-color)] cursor-pointer" />
                    <Star size={20} className="hover:text-[var(--primary-color)] cursor-pointer" />
                    <TrendingUp size={20} className="hover:text-[var(--primary-color)] cursor-pointer" />
                    <Smile size={20} className="text-[var(--primary-color)]" />
                </div>
            </div>
        </div>
    );
};
