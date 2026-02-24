import React, { useState, useRef, useEffect } from 'react';

// Curated sticker packs using publicly accessible CDN animated GIFs
const STICKER_CATEGORIES: { label: string; icon: string; stickers: { url: string; alt: string }[] }[] = [
    {
        label: 'Greetings',
        icon: '👋',
        stickers: [
            { url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', alt: 'Hello wave' },
            { url: 'https://media.giphy.com/media/l0MYB8Ory7Hqedum4/giphy.gif', alt: 'Hi there' },
            { url: 'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif', alt: 'Hello kitty' },
            { url: 'https://media.giphy.com/media/IThjAlJnD9WNO/giphy.gif', alt: 'Hey' },
            { url: 'https://media.tenor.com/j3RnnpWlLbMAAAAd/good-morning.gif', alt: 'Good morning' },
            { url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', alt: 'Good night' },
            { url: 'https://media.giphy.com/media/8FkKoaEDEFCyIRpqHJ/giphy.gif', alt: 'Welcome' },
            { url: 'https://media.giphy.com/media/l0MYB8Ory7Hqedum4/giphy.gif', alt: 'Waves' },
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
            { url: 'https://media.giphy.com/media/l46CyJmS9KUbokzsI/giphy.gif', alt: 'Fire' },
            { url: 'https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/giphy.gif', alt: 'LFG' },
            { url: 'https://media.giphy.com/media/xT9IgG50Lg7rusfilling/giphy.gif', alt: 'Yes' },
            { url: 'https://media.giphy.com/media/l0HlFZ3VF4DQYW5pu/giphy.gif', alt: 'Wow' },
        ],
    },
    {
        label: 'Love',
        icon: '❤️',
        stickers: [
            { url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', alt: 'Love you' },
            { url: 'https://media.giphy.com/media/3oEdv9SqVJnrGKlXsA/giphy.gif', alt: 'Heart eyes' },
            { url: 'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif', alt: 'Hugs' },
            { url: 'https://media.giphy.com/media/26BRzozg4TCBXv6QU/giphy.gif', alt: 'Kiss' },
            { url: 'https://media.giphy.com/media/LnKcgZiGPXiNi/giphy.gif', alt: 'Puppy love' },
            { url: 'https://media.giphy.com/media/l4FGpPki6HaGrQMgg/giphy.gif', alt: 'Sending love' },
            { url: 'https://media.giphy.com/media/3oz8xEkbN1AmBPO9II/giphy.gif', alt: 'Love heart' },
            { url: 'https://media.giphy.com/media/26BRrSvJEa8olgAOQ/giphy.gif', alt: 'Be mine' },
        ],
    },
    {
        label: 'Funny',
        icon: '😂',
        stickers: [
            { url: 'https://media.giphy.com/media/l4FGwJKlE3bm3PLNA/giphy.gif', alt: 'LOL' },
            { url: 'https://media.giphy.com/media/4T7e4DmcrP9du/giphy.gif', alt: 'Laughing' },
            { url: 'https://media.giphy.com/media/GfXFVHUzjlbOg/giphy.gif', alt: 'Haha' },
            { url: 'https://media.giphy.com/media/h4OGa0npayrJX/giphy.gif', alt: 'Cracking up' },
            { url: 'https://media.giphy.com/media/5dUqQMjqy35BS/giphy.gif', alt: 'Trollface' },
            { url: 'https://media.giphy.com/media/Z31jFNbK8FGe2Yrqm/giphy.gif', alt: 'Silly' },
            { url: 'https://media.giphy.com/media/12UlfHpF05ielO/giphy.gif', alt: 'Dancing' },
            { url: 'https://media.giphy.com/media/3oEjHHrBHB0e0FBqiI/giphy.gif', alt: 'Nope' },
        ],
    },
    {
        label: 'Sad',
        icon: '😢',
        stickers: [
            { url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif', alt: 'Crying' },
            { url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif', alt: 'Tears' },
            { url: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif', alt: 'Sad' },
            { url: 'https://media.giphy.com/media/EVbfbxHpQEfzG/giphy.gif', alt: 'So sad' },
            { url: 'https://media.giphy.com/media/1FMaabePDnfqyKyEIO/giphy.gif', alt: 'Miss you' },
            { url: 'https://media.giphy.com/media/QvBoMEcQ7DQXK/giphy.gif', alt: 'Heartbreak' },
            { url: 'https://media.giphy.com/media/N6funLmGKMKpq/giphy.gif', alt: 'Sobbing' },
            { url: 'https://media.giphy.com/media/3o6ZtpxSZbQRRnwCKQ/giphy.gif', alt: 'Sigh' },
        ],
    },
    {
        label: 'Celebrate',
        icon: '🎉',
        stickers: [
            { url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKS/giphy.gif', alt: 'Party' },
            { url: 'https://media.giphy.com/media/3o6ZsBVOHmFBCVFhKM/giphy.gif', alt: 'Congrats' },
            { url: 'https://media.giphy.com/media/YRuFixSNWFVcXaxpmX/giphy.gif', alt: 'Balloons' },
            { url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', alt: 'Celebrate' },
            { url: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif', alt: 'Fireworks' },
            { url: 'https://media.giphy.com/media/x8db4RBKLGrHa/giphy.gif', alt: 'Happy dance' },
            { url: 'https://media.giphy.com/media/26tPnAAJxXTvgLmTW/giphy.gif', alt: 'Cheers' },
            { url: 'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif', alt: 'Winner' },
        ],
    },
];

interface StickerPickerProps {
    onSelect: (url: string) => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect }) => {
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
                className={`p-3 rounded-2xl border-2 text-xl transition-all ${open
                        ? 'bg-[var(--primary-color)]/10 border-[var(--primary-color)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--primary-color)]/5 hover:border-[var(--primary-color)]'
                    }`}
                title="Stickers"
            >
                🎭
            </button>

            {open && (
                <div className="absolute bottom-14 left-0 w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-150">
                    {/* Category tabs */}
                    <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border-color)] px-2 pt-2 gap-1">
                        {STICKER_CATEGORIES.map((cat, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setActiveCategory(i)}
                                className={`px-2 py-1.5 text-base whitespace-nowrap rounded-t-lg transition-all flex-shrink-0 ${activeCategory === i
                                        ? 'border-b-2 border-[var(--primary-color)] scale-110'
                                        : 'opacity-60 hover:opacity-100'
                                    }`}
                                title={STICKER_CATEGORIES[i].label}
                            >
                                {cat.icon}
                            </button>
                        ))}
                    </div>

                    {/* Sticker label */}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-3 pt-2">
                        {STICKER_CATEGORIES[activeCategory].label}
                    </p>

                    {/* Sticker grid */}
                    <div className="p-2 grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                        {STICKER_CATEGORIES[activeCategory].stickers.map((sticker, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    onSelect(sticker.url);
                                    setOpen(false);
                                }}
                                className="rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--primary-color)] active:scale-95 transition-all aspect-square bg-[var(--bg-canvas)]"
                                title={sticker.alt}
                            >
                                <img
                                    src={sticker.url}
                                    alt={sticker.alt}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
