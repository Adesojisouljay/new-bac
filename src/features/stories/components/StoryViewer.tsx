import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GroupedStory, storyService } from '../services/storyService';

import { formatDistanceToNow } from 'date-fns';
import { useNotification } from '../../../contexts/NotificationContext';
import { pointsService } from '../../../services/pointsService';
import { useCommunity } from '../../community/context/CommunityContext';
import { WalletActionsModal } from '../../wallet/components/WalletActionsModal';
import { Web3TipModal } from '../../wallet/components/Web3TipModal';
import { messageService } from '../../messages/services/messageService';
import { Send, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { transactionService } from '../../wallet/services/transactionService';
import { VoteSlider } from '../../feed/components/VoteSlider';



interface StoryViewerProps {
    group: GroupedStory;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    initialStoryId?: string;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ group, onClose, onNext, onPrev, initialStoryId }) => {
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialStoryId) {
            const idx = group.stories.findIndex(s => s._id === initialStoryId);
            return idx !== -1 ? idx : 0;
        }
        return 0;
    });
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [showTipModal, setShowTipModal] = useState(false);
    const [showTipMenu, setShowTipMenu] = useState(false);
    const [showWeb3Tip, setShowWeb3Tip] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showVoteSlider, setShowVoteSlider] = useState(false);
    const [hasTipped, setHasTipped] = useState(false);



    const { showNotification } = useNotification();
    const { config } = useCommunity();
    const navigate = useNavigate();
    const story = group.stories[currentIndex];
    const [likes, setLikes] = useState(story?.stats?.likes || 0);
    const username = localStorage.getItem('hive_user');

    // Reset index when group changes or initialStoryId changes
    useEffect(() => {
        if (initialStoryId) {
            const idx = group.stories.findIndex(s => s._id === initialStoryId);
            setCurrentIndex(idx !== -1 ? idx : 0);
        } else {
            setCurrentIndex(0);
        }
        setVoted(false);
        setHasTipped(group.stories[initialStoryId ? group.stories.findIndex(s => s._id === initialStoryId) : 0]?.hasTipped || false);
        setLikes(group.stories[initialStoryId ? group.stories.findIndex(s => s._id === initialStoryId) : 0]?.stats?.likes || 0);
        setProgress(0);
    }, [group.username, initialStoryId]);


    // Fetch real-time votes from Hive
    useEffect(() => {
        const fetchVotes = async () => {
            if (story && story.username && story.permlink) {
                const votes = await storyService.getStoryVotes(story.username, story.permlink);
                if (votes && votes.length > 0) {
                    setLikes(votes.length);
                    if (username) {
                        const userVote = votes.find((v: any) => v.voter === username);
                        if (userVote) setVoted(true);
                    }
                }
            }
        };
        fetchVotes();
    }, [story?.username, story?.permlink, username]);


    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showTipModal || showTipMenu || showWeb3Tip || isReplying) return;

            if (e.key === 'ArrowLeft') {
                if (currentIndex > 0) {
                    setCurrentIndex(currentIndex - 1);
                } else if (onPrev) {
                    onPrev();
                }
            } else if (e.key === 'ArrowRight') {
                if (currentIndex < group.stories.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                } else if (onNext) {
                    onNext();
                } else {
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, group.stories.length, onClose, onNext, onPrev, showTipModal, showTipMenu, showWeb3Tip, isReplying]);

    // Auto-advance with granular progress (allows pausing)
    useEffect(() => {
        if (showTipModal || showTipMenu || showWeb3Tip || isReplying || voting || showVoteSlider) return;


        const interval = setInterval(() => {
            setProgress(prev => {
                const next = prev + (100 / (5000 / 50)); // 100% over 5 seconds (50ms intervals)
                if (next >= 100) {
                    if (currentIndex < group.stories.length - 1) {
                        setCurrentIndex(currentIndex + 1);
                        setVoted(false);
                        return 0;
                    } else if (onNext) {
                        onNext();
                        return 0;
                    } else {
                        onClose();
                        return 100;
                    }
                }
                return next;
            });
        }, 50);

        return () => clearInterval(interval);
    }, [currentIndex, group.stories.length, onClose, onNext, showTipModal, showTipMenu, showWeb3Tip, isReplying, voting]);


    // Reset progress when index manually changed
    useEffect(() => {
        setProgress(0);
        setHasTipped(story?.hasTipped || false);
    }, [currentIndex, story?.hasTipped]);



    if (!story) return null;

    const handleLike = async (weight: number = 10000) => {
        if (!username) {
            showNotification('Please login to like stories', 'warning');
            return;
        }

        if (voted) return;

        if (!story.permlink) {
            showNotification("Post not found on chain", 'warning');
            return;
        }

        setVoting(true);
        const result = await transactionService.broadcast({
            type: 'vote',
            username,
            author: story.username,
            permlink: story.permlink,
            weight: weight
        }, () => {
            showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
        });

        setVoting(false);
        setShowVoteSlider(false);

        if (result.success) {
            setVoted(true);
            setLikes(prev => prev + 1);
            showNotification('Liked!', 'success');
            if (config?.id) pointsService.awardPoints(username, config.id, 'upvote', config.id);
        } else {
            showNotification("Vote failed: " + result.error, 'error');
        }
    };



    const handleSendReply = async () => {
        if (!username) {
            showNotification('Please login to reply', 'warning');
            return;
        }

        if (!replyContent.trim()) return;

        setSendingReply(true);
        try {
            // Send as a structured JSON envelope: {"_s": {...}, "_t": "..."}
            const storyRef = {
                id: story._id,
                text: story.content.text || 'Image story',
                type: story.content.type,
                username: group.username
            };

            const payload = JSON.stringify({
                _s: storyRef,
                _t: replyContent.trim()
            });

            // Send directly off-chain (Fast mode) without forced Keychain encryption
            await messageService.sendMessage(username, group.username, payload);

            showNotification('Reply sent!', 'success');
            setReplyContent('');
            setIsReplying(false);
        } catch (err: any) {
            showNotification(`Failed to send reply: ${err.message}`, 'error');
        } finally {
            setSendingReply(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-[70] text-3xl text-white/50 hover:text-white transition-all outline-none"
            >
                ✕
            </button>

            <div className="w-full max-w-lg h-full max-h-[850px] relative flex flex-col items-center justify-center p-4">
                {/* Progress Indicators */}
                <div className="absolute top-4 left-4 right-4 flex gap-1 z-[70]">
                    {group.stories.map((_, idx) => {
                        const isPaused = showTipModal || showTipMenu || showWeb3Tip || isReplying || voting || showVoteSlider;
                        return (

                            <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all duration-75 ease-linear"
                                    style={{
                                        width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                                        opacity: idx === currentIndex && isPaused ? 0.6 : 1,
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Header info — clickable to visit profile */}
                <div
                    className="absolute top-8 left-6 flex items-center gap-3 z-[70] cursor-pointer group/profile"
                    onClick={() => { onClose(); navigate(`/${group.username}`); }}
                >
                    <img
                        src={`https://images.hive.blog/u/${group.username}/avatar`}
                        alt={group.username}
                        className="w-10 h-10 rounded-full border border-white/20 group-hover/profile:border-white/60 transition-all"
                    />
                    <div className="flex flex-col">
                        <span className="font-bold text-white group-hover/profile:underline">
                            @{group.username}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/60">{formatDistanceToNow(new Date(story.timestamp))} ago</span>
                            {(story.isOnchain || story.hiveTrxId) && (
                                <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-1.5 py-0.5">
                                    ⛓ Onchain
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Story Content */}
                <div className="flex-1 w-full flex flex-col items-center justify-center text-center p-8 gap-4">
                    {story.content.type === 'text' ? (
                        <h2 className="text-3xl font-medium text-white leading-tight break-words max-w-full">
                            {story.content.text}
                        </h2>
                    ) : (
                        <>
                            <img
                                src={story.content.imageUrl}
                                alt="Story"
                                className="max-w-full max-h-[65%] object-contain rounded-2xl"
                            />
                            {story.content.text && (
                                <p className="text-lg text-white/90 leading-snug break-words max-w-sm">
                                    {story.content.text}
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* Interactions */}
                <div className="w-full p-6 flex items-center justify-center gap-8 z-[70]">
                    <div className="relative flex flex-col items-center">
                        {showVoteSlider && (
                            <VoteSlider
                                onVote={handleLike}
                                onClose={() => setShowVoteSlider(false)}
                                isVoting={voting}
                                className="bottom-full mb-4 right-1/2 translate-x-1/2"
                                showTriangle={true}
                            />
                        )}
                        <button
                            onClick={() => !voted && setShowVoteSlider(!showVoteSlider)}
                            disabled={voting}
                            className="flex flex-col items-center gap-1 group"
                        >
                            <div className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${voted
                                ? 'bg-red-500/20 border-red-500 text-red-500'
                                : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                                }`}>
                                {voting ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Heart
                                        size={24}
                                        fill={voted ? "currentColor" : "none"}
                                        className={voted ? "animate-pulse" : ""}
                                    />
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-white/60">{likes}</span>
                        </button>
                    </div>



                    {/* Tip button */}
                    <button
                        onClick={() => setShowTipMenu(true)}
                        className="flex flex-col items-center gap-1 group"
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${hasTipped
                            ? 'bg-red-500/20 border-red-500'
                            : 'bg-white/10 border-white/10 group-hover:bg-yellow-500/20'
                            }`}>
                            <span className="text-xl">💎</span>
                        </div>
                        <span className={`text-[10px] font-bold ${hasTipped ? 'text-red-500' : 'text-white/60'}`}>
                            {hasTipped ? 'Tipped' : 'Tip'}
                        </span>
                    </button>


                    {/* Tip type selector overlay */}
                    {showTipMenu && (
                        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden min-w-[220px]">
                                <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Send a Tip</span>
                                    <button onClick={() => setShowTipMenu(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
                                </div>
                                <div className="p-2 flex flex-col gap-1">
                                    <button
                                        onClick={() => { setShowTipMenu(false); setShowTipModal(true); }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-canvas)] transition-all text-left w-full group/hive"
                                    >
                                        <span className="text-2xl">🐝</span>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-primary)] group-hover/hive:text-[var(--primary-color)] transition-colors">HIVE / HBD</p>
                                            <p className="text-[10px] text-[var(--text-secondary)]">Send from your Hive wallet</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => { setShowTipMenu(false); setShowWeb3Tip(true); }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-canvas)] transition-all text-left w-full group/web3"
                                    >
                                        <span className="text-2xl">🌐</span>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-primary)] group-hover/web3:text-[var(--primary-color)] transition-colors">Web3 Crypto</p>
                                            <p className="text-[10px] text-[var(--text-secondary)]">BTC · ETH · SOL · TRON · and more</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setIsReplying(!isReplying)}
                        className={`flex flex-col items-center gap-1 group transition-all ${isReplying ? 'text-[var(--primary-color)]' : ''}`}
                    >
                        <div className={`w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 ${isReplying ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/20' : 'group-hover:bg-blue-500/20'}`}>
                            <span className="text-xl">💬</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/60">Reply</span>
                    </button>
                </div>

                {/* Reply Input Area */}
                {isReplying && (
                    <div className="w-full max-w-md px-6 pb-6">
                        <div className="relative">
                            <input
                                type="text"
                                autoFocus
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                                placeholder={`Reply to @${group.username}...`}
                                className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-6 pr-12 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--primary-color)] transition-all"
                            />
                            <button
                                onClick={handleSendReply}
                                disabled={sendingReply || !replyContent.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--primary-color)] hover:scale-110 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                            >
                                {sendingReply ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send size={20} />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Overlays */}
            {!showTipModal && !showTipMenu && !showWeb3Tip && !isReplying && (
                <>
                    {/* Previous area */}
                    <div
                        className="absolute inset-y-0 left-0 w-1/2 cursor-pointer z-[65] group/nav flex items-center justify-start p-4"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (currentIndex > 0) {
                                setCurrentIndex(currentIndex - 1);
                            } else if (onPrev) {
                                onPrev();
                            }
                        }}
                    >
                        {(currentIndex > 0 || onPrev) && (
                            <div className="p-2 rounded-full bg-black/20 text-white/40 group-hover/nav:bg-black/40 group-hover/nav:text-white transition-all">
                                <ChevronLeft size={32} />
                            </div>
                        )}
                    </div>
                    {/* Next area */}
                    <div
                        className="absolute inset-y-0 right-0 w-1/2 cursor-pointer z-[65] group/nav flex items-center justify-end p-4"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (currentIndex < group.stories.length - 1) {
                                setCurrentIndex(currentIndex + 1);
                            } else if (onNext) {
                                onNext();
                            } else {
                                onClose();
                            }
                        }}
                    >
                        <div className="p-2 rounded-full bg-black/20 text-white/40 group-hover/nav:bg-black/40 group-hover/nav:text-white transition-all">
                            <ChevronRight size={32} />
                        </div>
                    </div>
                </>
            )}

            {/* Tipping Modal — HIVE */}
            {username && (
                <WalletActionsModal
                    isOpen={showTipModal}
                    onClose={() => setShowTipModal(false)}
                    type="transfer"
                    username={username}
                    initialData={{
                        to: group.username,
                        memo: `Tip for story: ${story.content.text || 'image story'}`
                    }}
                    onSuccess={() => {
                        const rawUser = localStorage.getItem('hive_user');
                        const currentUser = rawUser ? rawUser.replace(/^@/, '') : null;
                        if (currentUser) storyService.recordTip(story._id, currentUser);
                        showNotification(`Tip sent to @${group.username}!`, 'success');
                        setShowTipModal(false);
                        setHasTipped(true);
                    }}
                />
            )}

            {/* Tipping Modal — Web3 */}
            {showWeb3Tip && (
                <Web3TipModal
                    recipientUsername={group.username}
                    onClose={() => setShowWeb3Tip(false)}
                    onSuccess={() => {
                        const rawUser = localStorage.getItem('hive_user');
                        const currentUser = rawUser ? rawUser.replace(/^@/, '') : null;
                        if (currentUser) storyService.recordTip(story._id, currentUser);
                        setHasTipped(true);
                    }}
                />
            )}


        </div>
    );
};
