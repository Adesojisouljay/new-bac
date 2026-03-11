import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';

interface Community {
    name: string;
    title: string;
}

interface CommunitySelectProps {
    value: string;
    onChange: (value: string) => void;
    communities: Community[];
    disabled?: boolean;
    onSearch?: (query: string) => void;
    isSearching?: boolean;
}

export function CommunitySelect({ value, onChange, communities, disabled, onSearch, isSearching }: CommunitySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedCommunity = communities.find(c => c.name === value);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all shadow-sm text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--primary-color)]/50'}`}
            >
                <div className="flex items-center gap-3 truncate">
                    <span className="text-[var(--text-secondary)] text-xs whitespace-nowrap">Posting to:</span>
                    {selectedCommunity ? (
                        <div className="flex items-center gap-2 truncate">
                            <img
                                src={`https://images.hive.blog/u/${selectedCommunity.name}/avatar/small`}
                                alt={selectedCommunity.title}
                                className="h-6 w-6 rounded-full bg-[var(--bg-canvas)] object-cover border border-[var(--border-color)] flex-shrink-0"
                            />
                            <span className="truncate font-bold">{selectedCommunity.title}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 truncate">
                            <div className="h-6 w-6 rounded-full bg-[var(--bg-canvas)] flex items-center justify-center border border-[var(--border-color)] flex-shrink-0">
                                <Globe size={14} className="text-[var(--text-secondary)]" />
                            </div>
                            <span className="font-bold">My Blog</span>
                        </div>
                    )}
                </div>
                <ChevronDown size={18} className={`text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 max-h-96 overflow-y-auto bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl z-[60] py-2 animate-in fade-in zoom-in-95 duration-100 scrollbar-hide flex flex-col">
                    {/* Search Input */}
                    {onSearch && (
                        <div className="px-3 pb-2 mb-2 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-card)] z-10">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    onSearch(e.target.value);
                                }}
                                placeholder="Search communities..."
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-xs outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition-all"
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto max-h-80">
                        {/* Default Option - only show if no search or searching for My Blog */}
                        {(!searchQuery || 'my blog'.includes(searchQuery.toLowerCase())) && (
                            <button
                                type="button"
                                onClick={() => { onChange(''); setIsOpen(false); setSearchQuery(''); onSearch?.(''); }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--bg-canvas)] transition-colors ${value === '' ? 'bg-[var(--bg-canvas)] border-l-2 border-[var(--primary-color)]' : ''}`}
                            >
                                <div className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] flex items-center justify-center border border-[var(--border-color)] flex-shrink-0">
                                    <Globe size={16} className="text-[var(--text-secondary)]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">My Blog</span>
                                    <span className="text-[10px] text-[var(--text-secondary)]">No Community</span>
                                </div>
                            </button>
                        )}

                        {/* Loading State */}
                        {isSearching && (
                            <div className="py-8 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--primary-color)] border-t-transparent"></div>
                                <span className="text-[10px] font-bold">Searching Hive...</span>
                            </div>
                        )}

                        {/* No Results */}
                        {!isSearching && searchQuery && communities.length === 0 && (
                            <div className="py-8 text-center text-[var(--text-secondary)]">
                                <span className="text-[10px] font-bold">No communities found</span>
                            </div>
                        )}

                        {/* Communities */}
                        {communities.map((c) => (
                            <button
                                key={c.name}
                                type="button"
                                onClick={() => { onChange(c.name); setIsOpen(false); setSearchQuery(''); onSearch?.(''); }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--bg-canvas)] transition-colors ${value === c.name ? 'bg-[var(--bg-canvas)] border-l-2 border-[var(--primary-color)]' : ''}`}
                            >
                                <img
                                    src={`https://images.hive.blog/u/${c.name}/avatar/small`}
                                    alt={c.title}
                                    className="h-8 w-8 rounded-full bg-[var(--bg-canvas)] object-cover border border-[var(--border-color)] flex-shrink-0"
                                />
                                <div className="flex flex-col truncate">
                                    <span className="text-sm font-bold text-[var(--text-primary)] truncate">{c.title}</span>
                                    <span className="text-[10px] text-[var(--text-secondary)] truncate">@{c.name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
