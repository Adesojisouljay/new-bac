import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { mentionService, HiveUserSuggestion } from '../services/mentionService';

interface MentionSuggestionsProps {
    query: string;
    onSelect: (username: string) => void;
    position: { top: number; left: number };
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({ query, onSelect, position }) => {
    const [suggestions, setSuggestions] = useState<HiveUserSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to active index
    useEffect(() => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const activeElement = container.children[activeIndex] as HTMLElement;
        if (!activeElement) return;

        const containerHeight = container.offsetHeight;
        const elementTop = activeElement.offsetTop;
        const elementHeight = activeElement.offsetHeight;

        if (elementTop < container.scrollTop) {
            container.scrollTop = elementTop - 10;
        } else if (elementTop + elementHeight > container.scrollTop + containerHeight) {
            container.scrollTop = elementTop + elementHeight - containerHeight + 10;
        }
    }, [activeIndex]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            setLoading(true);
            try {
                const results = await mentionService.searchUsers(query);
                if (results && results.length > 0) {
                    setSuggestions(results);
                }
            } catch (err) {
                console.error('Fetch failed:', err);
            } finally {
                setLoading(false);
                setActiveIndex(0);
            }
        };

        const timer = setTimeout(fetchSuggestions, 150);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (suggestions.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                onSelect(suggestions[activeIndex].name);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [suggestions, activeIndex, onSelect]);

    // Show if there are suggestions OR if we are loading
    if (suggestions.length === 0 && !loading) return null;

    return createPortal(
        <div
            className="fixed z-[9999] bg-[#1a2235] border border-white/5 rounded-[24px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-300 ring-1 ring-white/10"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            <div className="relative flex max-h-[320px]">
                <div
                    ref={scrollContainerRef}
                    className="flex-1 p-2 space-y-1 overflow-y-auto CustomScrollbar scroll-smooth"
                >
                    {loading ? (
                        <div className="p-8 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {suggestions.map((user, index) => (
                                <button
                                    key={user.name}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => onSelect(user.name)}
                                    className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-all duration-200 rounded-[18px] group relative ${index === activeIndex
                                        ? 'bg-blue-600/20 text-white'
                                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <img
                                            src={`https://images.hive.blog/u/${user.name}/avatar/small`}
                                            alt={user.name}
                                            className="w-10 h-10 rounded-full border-2 border-white/10 shadow-lg group-hover:scale-105 transition-transform bg-[#0f172a]"
                                        />
                                        {index === activeIndex && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-[3px] border-[#1a2235] shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        )}
                                    </div>

                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-[15px] font-bold tracking-tight truncate ${index === activeIndex ? 'text-white' : 'text-gray-300'}`}>
                                            {user.name}
                                        </span>
                                        <div className="flex items-center gap-1.5 opacity-50">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Hive</span>
                                            <span className="text-[10px] font-bold">REP {user.reputation}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {/* Elite status indicator bar on the right matching screenshot */}
                {suggestions.length > 0 && (
                    <div className="w-1 bg-white/5 relative rounded-full my-4 mr-3 overflow-hidden flex flex-col shrink-0">
                        <div
                            className="w-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                            style={{
                                height: `${Math.max(20, 100 / (suggestions.length || 1))}%`,
                                transform: `translateY(${activeIndex * (100 / (suggestions.length || 1))}%)`
                            }}
                        />
                    </div>
                )}
            </div>

            <div className="px-4 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Mentions</span>
                <div className="flex gap-2">
                    <kbd className="text-[9px] font-sans border border-white/10 px-1.5 py-0.5 rounded bg-white/5 text-gray-400">↑↓</kbd>
                    <kbd className="text-[9px] font-sans border border-white/10 px-1.5 py-0.5 rounded bg-white/5 text-gray-400">Enter</kbd>
                </div>
            </div>
        </div>,
        document.body
    );
};
