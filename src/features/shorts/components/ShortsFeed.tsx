import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { shortService, Short } from '../services/shortService';
import { socketService } from '../../../services/socketService';
import {
    Heart,
    MessageCircle,
    Share2,
    MoreVertical,
    Volume2,
    VolumeX,
    ChevronDown,
    ChevronUp,
    Play,
    DollarSign,
    Video,
    X,
    Send,
    Plus
} from 'lucide-react';
import { ShortCreator } from './ShortCreator';


import { messageService } from '../../messages/services/messageService';


import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import { VoteSlider } from '../../feed/components/VoteSlider';
import { ShareModal } from '../../../components/ShareModal';



import { WalletActionsModal } from '../../wallet/components/WalletActionsModal';
import { Web3TipModal } from '../../wallet/components/Web3TipModal';
import { formatDistanceToNow } from 'date-fns';




interface ShortsFeedProps {
    onClose?: () => void;
    communityId?: string;
}

export const ShortsFeed: React.FC<ShortsFeedProps> = ({ onClose, communityId = 'breakaway' }) => {
    const navigate = useNavigate();

    const [shorts, setShorts] = useState<Short[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [showShortCreator, setShowShortCreator] = useState(false);
    const [isReplyingGlobal, setIsReplyingGlobal] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);



    const loadShorts = useCallback(async () => {
        setIsLoading(true);
        try {
            const rawUsername = localStorage.getItem('hive_user');
            const username = rawUsername ? rawUsername.replace(/^@/, '') : undefined;
            const data = await shortService.getShorts(communityId, username);
            setShorts(data);
        } catch (error) {


            console.error("Error loading shorts:", error);
        } finally {
            setIsLoading(false);
        }
    }, [communityId]);

    useEffect(() => {
        loadShorts();
        const handleNewShort = (newShort: Short) => {
            setShorts(prev => [newShort, ...prev]);
        };
        socketService.on('new_short', handleNewShort);
        return () => socketService.off('new_short', handleNewShort);
    }, [loadShorts]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const scrollPos = containerRef.current.scrollTop;
        const height = containerRef.current.clientHeight;
        const index = Math.round(scrollPos / height);
        if (index !== activeIndex && index >= 0 && index < shorts.length) {
            setActiveIndex(index);
        }
    };

    if (isLoading && shorts.length === 0) {
        return (
            <div className="fixed inset-0 bg-black z-[110] flex flex-col items-center justify-center gap-6">
                <div className="w-16 h-16 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--primary-color)] font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Loading Shorts...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-[110] text-white overflow-hidden flex flex-col items-center">
            {/* Context-Aware Global Close Button (Top Right) */}
            <div className="absolute top-4 right-4 z-[140]">
                <button
                    onClick={() => {
                        if (isReplyingGlobal) {
                            setIsReplyingGlobal(false);
                        } else {
                            onClose ? onClose() : navigate(-1);
                        }
                    }}
                    className="p-3 bg-black/40 backdrop-blur-md rounded-2xl text-white hover:bg-black/60 transition-all border border-white/20 shadow-xl active:scale-95"
                    title={isReplyingGlobal ? "Close Comments" : "Close Shorts"}
                >
                    <X size={22} />
                </button>

            </div>







            {/* Vertical Video Feed */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="w-full h-full snap-y snap-mandatory overflow-y-scroll no-scrollbar bg-black"
            >
                {shorts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <Video className="text-white/20" size={40} />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2 opacity-60">No shorts yet</h3>
                        <p className="max-w-[200px] text-xs text-white/40 font-medium mb-8">
                            Be the first to share a video with the community!
                        </p>
                        <button
                            onClick={() => loadShorts()}
                            className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Refresh Feed
                        </button>
                    </div>
                ) : (
                    shorts.map((short, index) => (
                        <ShortItem
                            key={short._id}
                            short={short}
                            isActive={index === activeIndex}
                            isMuted={isMuted}
                            onToggleMute={() => setIsMuted(!isMuted)}
                            isReplying={isReplyingGlobal}
                            setIsReplying={setIsReplyingGlobal}
                            onCreateShort={() => setShowShortCreator(true)}
                        />

                    ))
                )}
            </div>

            {/* Navigation Arrows (Desktop) */}
            <div className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 flex-col gap-6 z-[120]">
                <button
                    disabled={activeIndex === 0}
                    onClick={() => containerRef.current?.scrollTo({ top: (activeIndex - 1) * window.innerHeight, behavior: 'smooth' })}
                    className="p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 disabled:opacity-30 transition-all shadow-xl"
                >
                    <ChevronUp size={32} />
                </button>
                <button
                    disabled={activeIndex === shorts.length - 1}
                    onClick={() => containerRef.current?.scrollTo({ top: (activeIndex + 1) * window.innerHeight, behavior: 'smooth' })}
                    className="p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 disabled:opacity-30 transition-all shadow-xl"
                >
                    <ChevronDown size={32} />
                </button>
            </div>

            {/* Mobile Create FAB (Bottom Right) */}
            <button
                onClick={() => setShowShortCreator(true)}
                className="md:hidden fixed right-6 bottom-8 z-[120] w-14 h-14 bg-black/40 backdrop-blur-xl border border-white/20 rounded-[22px] flex items-center justify-center shadow-2xl active:scale-90 transition-all group"
            >
                <div className="relative">
                    <Plus size={28} className="text-red-500 group-hover:rotate-90 transition-transform duration-300" strokeWidth={3} />
                    {/* Subtle glow effect */}
                    <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full -z-10 animate-pulse" />
                </div>
            </button>

            {showShortCreator && (
                <ShortCreator
                    onClose={() => setShowShortCreator(false)}
                    onSuccess={() => {
                        setShowShortCreator(false);
                        loadShorts();
                    }}
                />
            )}
        </div>
    );
};

interface ShortItemProps {
    short: Short;
    isActive: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    isReplying: boolean;
    setIsReplying: (val: boolean) => void;
    onCreateShort: () => void;
}

const ShortItem: React.FC<ShortItemProps> = ({
    short,
    isActive,
    isMuted,
    onToggleMute,
    isReplying,
    setIsReplying,
    onCreateShort
}) => {



    const { showNotification } = useNotification();
    console.log("short content....", short.content);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [likes, setLikes] = useState(short.stats.likes);
    const [hasLiked, setHasLiked] = useState(false);
    const [voting, setVoting] = useState(false);
    const [showVoteSlider, setShowVoteSlider] = useState(false);
    const [replyContent, setReplyContent] = useState('');

    const [sendingReply, setSendingReply] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const [showTipModal, setShowTipModal] = useState(false);
    const [showTipMenu, setShowTipMenu] = useState(false);
    const [showWeb3Tip, setShowWeb3Tip] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [hasTipped, setHasTipped] = useState(short.hasTipped || false);

    useEffect(() => {
        setHasTipped(short.hasTipped || false);
    }, [short.hasTipped]);







    useEffect(() => {
        if (!videoRef.current) return;
        if (isActive) {
            videoRef.current.play().catch(() => { });
            setIsPaused(false);
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [isActive]);

    // Fetch real-time votes from Hive
    useEffect(() => {
        const fetchVotes = async () => {
            if (short.username && short.permlink) {
                const votes = await shortService.getShortVotes(short.username, short.permlink);
                if (votes && votes.length > 0) {
                    setLikes(votes.length);
                    const username = localStorage.getItem('hive_user');
                    if (username) {
                        const userVote = votes.find((v: any) => v.voter === username);
                        if (userVote) setHasLiked(true);
                    }
                }

                // Fetch metadata for comment count
                const metadata = await shortService.getShortMetadata(short.username, short.permlink);
                if (metadata && typeof metadata.children === 'number') {
                    setCommentCount(metadata.children);
                }
            }
        };
        fetchVotes();
    }, [short.username, short.permlink]);


    const fetchComments = async () => {
        if (short.username && short.permlink) {
            setLoadingComments(true);
            const data = await shortService.getShortComments(short.username, short.permlink);
            setComments(data);
            setLoadingComments(false);
        }
    };

    useEffect(() => {
        if (isReplying) {
            fetchComments();
        }
    }, [isReplying]);



    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPaused(false);
        } else {
            videoRef.current.pause();
            setIsPaused(true);
        }
    };

    const handleVote = async (weight: number) => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to vote", 'warning');
            return;
        }

        if (!short.username) {
            showNotification("Author not found", 'error');
            return;
        }

        const author = short.username;

        const permlink = short.permlink;

        if (!permlink) {
            showNotification("Post not found on chain", 'warning');
            return;
        }

        setVoting(true);
        const result = await transactionService.broadcast({
            type: 'vote',
            username,
            author,
            permlink,
            weight: weight
        }, () => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        setVoting(false);
        setShowVoteSlider(false);

        if (result.success) {
            setHasLiked(true);
            setLikes(prev => prev + 1);
            showNotification("Upvoted successfully", 'success');
        } else {
            showNotification("Vote failed: " + result.error, 'error');
        }
    };

    const handleSendReply = async () => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification('Please login to reply', 'warning');
            return;
        }

        if (!replyContent.trim()) return;

        if (!short.permlink) {
            showNotification("Short not found on chain", 'warning');
            return;
        }

        setSendingReply(true);
        try {
            // 1. Send off-chain DM (Structured envelope)
            const shortRef = {
                id: short._id,
                caption: short.content.caption || 'Video short',
                type: 'short',
                username: short.username,
                permlink: short.permlink
            };

            const payload = JSON.stringify({
                _s: shortRef,
                _t: replyContent.trim()
            });

            await messageService.sendMessage(username, short.username, payload);

            // 2. Broadcast on-chain Hive comment
            const permlink = `re-${short.permlink}-${Date.now()}`;
            await transactionService.broadcast({
                type: 'comment',
                username,
                parent_author: short.username,
                parent_permlink: short.permlink,
                permlink,
                title: '',
                body: replyContent.trim(),
                json_metadata: JSON.stringify({
                    app: 'bac/shorts/1.0',
                    type: 'short_reply',
                    tags: ['bac-shorts', 'breakaway']
                })
            }, () => {
                showNotification("Action required: Sign your public comment with HiveAuth.", 'info');
            });

            showNotification('Reply sent! 🎬💬', 'success');
            setReplyContent('');
            setIsReplying(false);
            setCommentCount(prev => prev + 1);
            // Optionally refresh comments if the panel is open
            fetchComments();
        } catch (err: any) {

            showNotification(`Failed to send reply: ${err.message}`, 'error');
        } finally {
            setSendingReply(false);
        }
    };


    return (
        <div className="w-full h-full snap-start relative flex bg-black overflow-hidden transition-all duration-500 ease-in-out">
            {/* Backdrop for mobile comments */}
            {isReplying && (
                <div
                    className="fixed inset-0 bg-black/60 z-[125] md:hidden animate-in fade-in duration-300"
                    onClick={() => setIsReplying(false)}
                />
            )}

            {/* Video Container */}
            <div className={`relative flex items-center justify-center transition-all duration-500 ease-in-out ${isReplying ? 'w-full md:w-[60%] lg:w-[65%]' : 'w-full'}`}>

                <video
                    ref={videoRef}
                    src={short.content.videoUrl}
                    className="h-full w-full object-contain cursor-pointer relative z-0"
                    loop
                    muted={isMuted}
                    onClick={togglePlay}
                    playsInline
                    preload="auto"
                    crossOrigin="anonymous"
                />

                {/* Sliding Header Actions (Create & Mute) */}
                <div className={`absolute top-4 ${isReplying ? 'right-4' : 'right-20'} z-40 flex items-center gap-3 transition-all duration-500 ease-in-out`}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateShort();
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-black/60 backdrop-blur-xl rounded-[20px] text-red-500 font-black text-[11px] uppercase tracking-[0.2em] border border-white/20 hover:bg-black/80 hover:border-white/40 transition-all shadow-2xl active:scale-95 group"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" strokeWidth={3} />
                        <span>Create</span>
                    </button>


                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleMute();
                        }}
                        className="p-3 bg-black/60 backdrop-blur-xl rounded-[20px] text-white hover:bg-black/80 hover:border-white/40 transition-all border border-white/20 shadow-2xl active:scale-95"
                    >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>

                </div>


                {/* Pause Overlay */}
                {isPaused && (
                    <div onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 cursor-pointer">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center scale-up-center">
                            <Play size={40} className="ml-1 fill-white" />
                        </div>
                    </div>
                )}

                {/* Redundant local mute button removed to favor global header toggle */}




                {/* Info Overlay (Bottom) */}
                <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
                    <div className="max-w-xl flex flex-col gap-4 pointer-events-auto">
                        <div className="flex items-center gap-3">
                            <img
                                src={`https://images.hive.blog/u/${short.username}/avatar`}
                                className="w-12 h-12 rounded-full border-2 border-[var(--primary-color)] shadow-xl"
                                alt={short.username}
                            />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-lg drop-shadow-lg">@{short.username}</span>
                                    <button className="bg-[var(--primary-color)] text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
                                        Follow
                                    </button>
                                </div>
                                <span className="text-[10px] text-white/60 font-medium">{new Date(short.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                        {short.content.caption && (
                            <p className="text-sm drop-shadow-md font-medium leading-relaxed">
                                {short.content.caption}
                            </p>
                        )}
                    </div>
                </div>

                {/* Interaction Sidebar (Right) */}
                <div className="absolute right-2 bottom-32 flex flex-col gap-6 z-40">

                    <div className="flex flex-col items-center gap-1 relative">
                        {showVoteSlider && (
                            <VoteSlider
                                onVote={handleVote}
                                onClose={() => setShowVoteSlider(false)}
                                isVoting={voting}
                                className="top-0 right-full mr-4 left-auto mb-0"
                                showTriangle={false}
                            />
                        )}

                        <button
                            onClick={() => !hasLiked && setShowVoteSlider(!showVoteSlider)}
                            disabled={voting}
                            className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-90 flex flex-col items-center gap-1 ${hasLiked
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            {voting ? (
                                <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Heart
                                        size={28}
                                        fill={hasLiked ? "currentColor" : "none"}
                                        className={hasLiked ? "animate-pulse" : ""}
                                    />
                                    <span className="text-[10px] font-black">{likes}</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={() => setIsReplying(!isReplying)}
                            className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-90 flex flex-col items-center gap-1 ${isReplying
                                ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <MessageCircle size={28} />
                        </button>
                        <span className="text-xs font-black drop-shadow-md">{commentCount}</span>
                    </div>

                    <div className="flex flex-col items-center gap-1 relative">
                        <button
                            onClick={() => setShowTipMenu(!showTipMenu)}
                            className={`p-4 ${hasTipped ? 'bg-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-white/10 text-white hover:bg-white/20'} backdrop-blur-md rounded-full transition-all active:scale-90`}
                        >
                            <DollarSign size={28} />
                        </button>
                        <span className={`text-[10px] font-black drop-shadow-md uppercase tracking-widest ${hasTipped ? 'text-red-500' : 'text-[#00f2ea]'}`}>{hasTipped ? 'Tipped' : 'Tip'}</span>

                        {/* Tip type selector overlay */}
                        {showTipMenu && (
                            <div className="absolute bottom-full right-0 mb-4 z-[80] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[220px]">
                                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Send a Tip</span>
                                        <button onClick={() => setShowTipMenu(false)} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
                                    </div>
                                    <div className="p-2 flex flex-col gap-1">
                                        <button
                                            onClick={() => { setShowTipMenu(false); setShowTipModal(true); }}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-left w-full group/hive"
                                        >
                                            <span className="text-2xl">🐝</span>
                                            <div>
                                                <p className="text-sm font-bold text-white group-hover/hive:text-[var(--primary-color)] transition-colors">HIVE / HBD</p>
                                                <p className="text-[10px] text-white/40">Send from your Hive wallet</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => { setShowTipMenu(false); setShowWeb3Tip(true); }}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-left w-full group/web3"
                                        >
                                            <span className="text-2xl">🌐</span>
                                            <div>
                                                <p className="text-sm font-bold text-white group-hover/web3:text-[var(--primary-color)] transition-colors">Web3 Crypto</p>
                                                <p className="text-[10px] text-white/40">BTC · ETH · SOL · and more</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    <button
                        onClick={() => setShowShareModal(true)}
                        className="p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all active:scale-90"
                    >
                        <Share2 size={28} />
                    </button>


                    <button className="p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all active:scale-90">
                        <MoreVertical size={28} />
                    </button>
                </div>

            </div>

            {/* Comment Sidebar Panel (Desktop: Side, Mobile: Bottom Sheet) */}
            <div className={`fixed md:relative bottom-0 left-0 right-0 md:inset-y-0 z-[130] md:z-auto
                bg-[#121212] border-t md:border-t-0 md:border-l border-white/10
                flex flex-col transition-all duration-500 ease-in-out
                rounded-t-[32px] md:rounded-t-none
                ${isReplying
                    ? 'h-[75vh] md:h-full md:w-[40%] lg:w-[35%] translate-y-0 opacity-100 visible'
                    : 'h-0 md:w-0 translate-y-full md:translate-y-0 opacity-0 invisible'
                }`}
            >
                {/* Mobile Drag Handle */}
                <div className="flex justify-center py-3 md:hidden">
                    <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                </div>

                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <span className="font-black text-sm uppercase tracking-wider text-white/60">Comments {commentCount}</span>
                    <div className="w-8" /> {/* Spacer for symmetry since global X is above */}

                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">
                    {loadingComments ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-white/40 gap-3">
                            <MessageCircle size={48} strokeWidth={1} />
                            <p className="text-xs font-medium uppercase tracking-widest">No comments yet</p>
                        </div>
                    ) : (
                        comments.map((comment: any, idx: number) => {
                            return (
                                <div key={idx} className="flex gap-3 group">
                                    <img
                                        src={`https://images.hive.blog/u/${comment.author}/avatar`}
                                        className="w-8 h-8 rounded-full border border-white/10 shadow-lg"
                                        alt={comment.author}
                                    />
                                    <div className="flex flex-col gap-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white/80">@{comment.author}</span>
                                            <span className="text-[10px] text-white/40">{formatDistanceToNow(new Date(comment.created), { addSuffix: true })}</span>
                                        </div>
                                        <p className="text-xs text-white/70 leading-relaxed break-words line-clamp-3 group-hover:line-clamp-none transition-all">
                                            {comment.body}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1">
                                            <button className="flex items-center gap-1 text-[10px] font-black text-white/40 hover:text-red-500 transition-all">
                                                <Heart size={12} /> {comment.active_votes?.length || 0}
                                            </button>
                                            <button className="text-[10px] font-black text-white/40 hover:text-[var(--primary-color)] transition-all uppercase tracking-widest">
                                                Reply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Reply Input */}
                <div className="p-4 pb-8 md:pb-4 bg-[#181818] border-t border-white/5">

                    <div className="relative">
                        <textarea
                            rows={1}
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendReply();
                                }
                            }}
                            placeholder="Add a comment..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pr-12 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--primary-color)]/50 transition-all resize-none max-h-32"
                        />
                        <button
                            onClick={handleSendReply}
                            disabled={sendingReply || !replyContent.trim()}
                            className="absolute right-2 bottom-2 p-2 text-[var(--primary-color)] hover:scale-110 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all"
                        >
                            {sendingReply ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* Tipping Modal — HIVE */}
            {localStorage.getItem('hive_user') && (
                <WalletActionsModal
                    isOpen={showTipModal}
                    onClose={() => setShowTipModal(false)}
                    type="transfer"
                    username={localStorage.getItem('hive_user') || ''}
                    initialData={{
                        to: short.username,
                        memo: `Tip for short: ${short.content.caption || 'video'}`
                    }}
                    onSuccess={() => {
                        const rawUser = localStorage.getItem('hive_user');
                        const currentUser = rawUser ? rawUser.replace(/^@/, '') : null;
                        if (currentUser) shortService.recordTip(short._id, currentUser);
                        showNotification(`Tip sent to @${short.username}!`, 'success');
                        setShowTipModal(false);
                        setHasTipped(true);
                    }}
                />
            )}

            {/* Tipping Modal — Web3 */}
            {showWeb3Tip && (
                <Web3TipModal
                    recipientUsername={short.username}
                    onClose={() => setShowWeb3Tip(false)}
                    onSuccess={() => {
                        const rawUser = localStorage.getItem('hive_user');
                        const currentUser = rawUser ? rawUser.replace(/^@/, '') : null;
                        if (currentUser) shortService.recordTip(short._id, currentUser);
                        setHasTipped(true);
                    }}
                />
            )}


            {/* Share Modal */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                url={`${window.location.origin}/post/${short.username}/${short.permlink}`}
                title={short.content.caption || `Short by @${short.username}`}
            />
        </div>

    );
};
