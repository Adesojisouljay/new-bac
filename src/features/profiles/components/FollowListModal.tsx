import { useEffect, useState, useMemo } from 'react';
import { UnifiedDataService } from '../../../services/unified';
import { Link } from 'react-router-dom';
import { X, Search, Loader2 } from 'lucide-react';

interface FollowListModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'followers' | 'following';
    username: string;
}

export function FollowListModal({ isOpen, onClose, type, username }: FollowListModalProps) {
    const [users, setUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const currentUser = localStorage.getItem('hive_user');

    const [currentUserFollowing, setCurrentUserFollowing] = useState<Set<string>>(new Set());
    const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            return;
        }

        const fetchData = async () => {
            try {
                let data: string[] = [];
                if (type === 'followers') {
                    data = await UnifiedDataService.getFollowers(username);
                } else {
                    data = await UnifiedDataService.getFollowing(username);
                }
                setUsers(data);
            } catch (error) {
                console.error(`Failed to fetch ${type}:`, error);
            }
        };

        const fetchCurrentUserFollowing = async () => {
            if (currentUser) {
                try {
                    const followingList = await UnifiedDataService.getFollowing(currentUser);
                    setCurrentUserFollowing(new Set(followingList));
                } catch (error) {
                    console.error('Failed to fetch current user following list:', error);
                }
            }
        };

        setLoading(true);
        Promise.all([fetchData(), fetchCurrentUserFollowing()]).finally(() => {
            setLoading(false);
        });

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, username, type, currentUser]);

    const handleFollowToggle = async (e: React.MouseEvent, targetUser: string, currentlyFollowed: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentUser) {
            alert('Please login to follow/unfollow users');
            return;
        }

        setActionLoadingMap(prev => ({ ...prev, [targetUser]: true }));
        const success = await UnifiedDataService.followUser(currentUser, targetUser, !currentlyFollowed);

        if (success) {
            setCurrentUserFollowing(prev => {
                const newSet = new Set(prev);
                if (currentlyFollowed) {
                    newSet.delete(targetUser);
                } else {
                    newSet.add(targetUser);
                }
                return newSet;
            });
        }
        setActionLoadingMap(prev => ({ ...prev, [targetUser]: false }));
    };

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        return users.filter(user => user.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [users, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div 
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] capitalize">
                        {type}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--bg-canvas)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--primary-color)] transition-colors text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                        />
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center p-8 space-x-2">
                            <div className="w-2 h-2 rounded-full bg-[var(--primary-color)] animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-[var(--primary-color)] animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-[var(--primary-color)] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    ) : filteredUsers.length > 0 ? (
                        <div className="flex flex-col gap-1">
                                {filteredUsers.map(user => {
                                    const isFollowedByMe = currentUserFollowing.has(user);
                                    const isActionLoading = actionLoadingMap[user];
                                    const showButton = currentUser && currentUser !== user;

                                    let buttonText = 'Follow';
                                    if (isFollowedByMe) buttonText = 'Unfollow';
                                    else if (type === 'followers') buttonText = 'Follow Back';

                                    return (
                                        <Link 
                                            key={user}
                                            to={`/@${user}`}
                                            onClick={onClose}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-canvas)] transition-all group"
                                        >
                                            <img 
                                                src={`https://images.hive.blog/u/${user}/avatar/small`}
                                                alt={user}
                                                className="w-10 h-10 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-color)] group-hover:border-[var(--primary-color)] transition-colors"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/hive-106130/avatar/small'; }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-color)] truncate transition-colors">
                                                    {user}
                                                </p>
                                                <p className="text-xs text-[var(--text-secondary)] truncate">
                                                    @{user}
                                                </p>
                                            </div>
                                            
                                            {showButton ? (
                                                <button
                                                    onClick={(e) => handleFollowToggle(e, user, isFollowedByMe)}
                                                    disabled={isActionLoading}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                                                        isFollowedByMe
                                                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                                                            : 'bg-[var(--primary-color)] text-white hover:brightness-110'
                                                    } ${isActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isActionLoading && <Loader2 size={12} className="animate-spin" />}
                                                    {buttonText}
                                                </button>
                                            ) : (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="px-3 py-1.5 rounded-lg bg-[var(--primary-color)]/10 text-[var(--primary-color)] text-xs font-bold">
                                                        View
                                                    </div>
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--text-secondary)]">
                            <span className="text-4xl mb-4 opacity-50">👀</span>
                            <p className="font-bold text-[var(--text-primary)] mb-1">
                                {searchQuery ? 'No users found' : `No ${type} yet`}
                            </p>
                            <p className="text-sm">
                                {searchQuery ? `Try a different search term` : `When someone follows this user, they'll show up here.`}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
