import React, { useState, useEffect } from 'react';
import { GroupedStory } from '../services/storyService';
import { formatDistanceToNow } from 'date-fns';
import { useNotification } from '../../../contexts/NotificationContext';
import { pointsService } from '../../../services/pointsService';
import { useCommunity } from '../../community/context/CommunityContext';
import { WalletActionsModal } from '../../wallet/components/WalletActionsModal';
import { messageService } from '../../messages/services/messageService';
import { Send, ChevronLeft, ChevronRight } from 'lucide-react';

interface StoryViewerProps {
    group: GroupedStory;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ group, onClose, onNext, onPrev }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [showTipModal, setShowTipModal] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    const { showNotification } = useNotification();
    const { config } = useCommunity();
    const story = group.stories[currentIndex];
    const username = localStorage.getItem('hive_user');

    // Reset index when group changes
    useEffect(() => {
        setCurrentIndex(0);
        setVoted(false);
    }, [group.username]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showTipModal || isReplying) return;

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
    }, [currentIndex, group.stories.length, onClose, onNext, onPrev, showTipModal, isReplying]);

    // Auto-advance
    useEffect(() => {
        if (showTipModal || isReplying) return; // Pause auto-advance while interacting

        const timer = setTimeout(() => {
            if (currentIndex < group.stories.length - 1) {
                setCurrentIndex(currentIndex + 1);
                setVoted(false); // Reset vote state for next story
            } else if (onNext) {
                onNext();
            } else {
                onClose();
            }
        }, 5000); // 5 seconds per story

        return () => clearTimeout(timer);
    }, [currentIndex, group.stories.length, onClose, onNext, showTipModal, isReplying]);

    if (!story) return null;

    const handleLike = async () => {
        if (!username) {
            showNotification('Please login to like stories', 'warning');
            return;
        }

        if (voted) return;

        setVoting(true);
        // Off-chain story likes are broadcasted via socket in the backend
        // Here we just award some points for the social action

        setTimeout(() => {
            setVoting(false);
            setVoted(true);
            showNotification('Liked!', 'success');
            if (config?.id) pointsService.awardPoints(username, config.id, 'upvote', config.id);
        }, 500);
    };

    const handleSendReply = async () => {
        if (!username) {
            showNotification('Please login to reply', 'warning');
            return;
        }

        if (!replyContent.trim()) return;

        setSendingReply(true);
        try {
            const context = `Replying to your story: "${story.content.text || 'Image story'}"\n\n`;
            const fullMessage = context + replyContent.trim();

            // Stories use off-chain private chat
            // For now we send as a private message. 
            // In the future we can use a dedicated 'replies' collection.

            // Encrypt if possible or just send plain off-chain
            // Our messageService handles encryption withKeychain
            let finalMessage = fullMessage;
            try {
                finalMessage = await messageService.encryptMessage(username, group.username, fullMessage);
            } catch (e) {
                console.warn("Encryption failed, sending plain", e);
            }

            await messageService.sendMessage(username, group.username, finalMessage);

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
                    {group.stories.map((_, idx) => (
                        <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className={`h-full bg-white transition-all duration-[5000ms] ease-linear ${idx < currentIndex ? 'w-full' : idx === currentIndex && !showTipModal && !isReplying ? 'w-full' : idx === currentIndex ? 'w-[50%]' : 'w-0'
                                    }`}
                                style={{
                                    width: idx < currentIndex ? '100%' : (idx === currentIndex && !showTipModal && !isReplying ? '100%' : (idx === currentIndex ? '50%' : '0%')),
                                    transitionDuration: idx === currentIndex && !showTipModal && !isReplying ? '5000ms' : '0ms'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header info */}
                <div className="absolute top-8 left-6 flex items-center gap-3 z-[70]">
                    <img
                        src={`https://images.hive.blog/u/${group.username}/avatar`}
                        alt={group.username}
                        className="w-10 h-10 rounded-full border border-white/20"
                    />
                    <div className="flex flex-col">
                        <span className="font-bold text-white">@{group.username}</span>
                        <span className="text-[10px] text-white/60">{formatDistanceToNow(new Date(story.timestamp))} ago</span>
                    </div>
                </div>

                {/* Story Content */}
                <div className="flex-1 w-full flex items-center justify-center text-center p-8">
                    {story.content.type === 'text' ? (
                        <h2 className="text-3xl font-medium text-white leading-tight break-words max-w-full">
                            {story.content.text}
                        </h2>
                    ) : (
                        <img src={story.content.imageUrl} alt="Story" className="max-w-full max-h-full object-contain rounded-2xl" />
                    )}
                </div>

                {/* Interactions */}
                <div className="w-full p-6 flex items-center justify-center gap-8 z-[70]">
                    <button
                        onClick={handleLike}
                        disabled={voting || voted}
                        className="flex flex-col items-center gap-1 group"
                    >
                        <div className={`w-12 h-12 rounded-full bg-white/10 flex items-center justify-center transition-all border border-white/10 ${voted ? 'bg-red-500/40 border-red-500' : 'group-hover:bg-red-500/20'}`}>
                            <span className={`text-xl ${voting ? 'animate-pulse' : ''}`}>❤️</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/60">{(story.stats?.likes || 0) + (voted ? 1 : 0)}</span>
                    </button>

                    <button
                        onClick={() => setShowTipModal(true)}
                        className="flex flex-col items-center gap-1 group"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-all border border-white/10">
                            <span className="text-xl">💎</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/60">Tip</span>
                    </button>

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
                    <div className="w-full max-w-md px-6 pb-6 animate-in slide-in-from-bottom-4 duration-200">
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
            {!showTipModal && !isReplying && (
                <>
                    {/* Previous area */}
                    <div
                        className="absolute inset-y-0 left-0 w-1/2 cursor-pointer z-[65] group/nav flex items-center justify-start p-4"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                        }}
                    >
                        {currentIndex > 0 && (
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

            {/* Tipping Modal */}
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
                        showNotification(`Tip sent to @${group.username}!`, 'success');
                        setShowTipModal(false);
                    }}
                />
            )}
        </div>
    );
};
