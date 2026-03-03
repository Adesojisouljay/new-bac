import React, { useState, useEffect, useCallback } from 'react';
import { storyService, GroupedStory } from '../services/storyService';
import { socketService } from '../../../services/socketService';
import { StoryCreator } from './StoryCreator';
import { StoryViewer } from './StoryViewer';
import { History } from 'lucide-react';

export const StoryBar: React.FC = () => {
    const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
    const [currentUserGroup, setCurrentUserGroup] = useState<GroupedStory | null>(null);
    const [showCreator, setShowCreator] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<GroupedStory | null>(null);
    const [showOlder, setShowOlder] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const loadStories = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = (localStorage.getItem('hive_user') || '').replace(/^@/, '');
            const olderDate = showOlder ? storyService.getYesterdayDateStr() : undefined;
            const stories = await storyService.getCombinedStories(olderDate, currentUser || undefined);


            // Filter out logged-in user's stories from the shared list
            const filteredStories = stories.filter(group => group.username !== currentUser);
            const userGroup = stories.find(group => group.username === currentUser) || null;

            setGroupedStories(filteredStories);
            setCurrentUserGroup(userGroup);
        } finally {
            setIsLoading(false);
        }
    }, [showOlder]);

    useEffect(() => {
        loadStories();

        const handleNewStory = () => loadStories();
        socketService.on('new_story', handleNewStory);
        return () => socketService.off('new_story', handleNewStory);
    }, [loadStories]);

    const handleNextGroup = useCallback(() => {
        if (!selectedGroup) return;
        const allGroups = currentUserGroup ? [currentUserGroup, ...groupedStories] : groupedStories;
        const currentIndex = allGroups.findIndex(g => g.username === selectedGroup.username);
        if (currentIndex !== -1 && currentIndex < allGroups.length - 1) {
            setSelectedGroup(allGroups[currentIndex + 1]);
        } else {
            setSelectedGroup(null);
        }
    }, [selectedGroup, currentUserGroup, groupedStories]);

    const handlePrevGroup = useCallback(() => {
        if (!selectedGroup) return;
        const allGroups = currentUserGroup ? [currentUserGroup, ...groupedStories] : groupedStories;
        const currentIndex = allGroups.findIndex(g => g.username === selectedGroup.username);
        if (currentIndex > 0) {
            setSelectedGroup(allGroups[currentIndex - 1]);
        }
    }, [selectedGroup, currentUserGroup, groupedStories]);

    return (
        <div className="w-full min-w-0">
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm min-h-[84px] md:min-h-[90px] overflow-hidden w-full">


                {/* My Story Creator (Fixed Left) */}
                <div
                    className="flex flex-col items-center justify-center gap-1 w-[70px] md:w-[80px] py-3 flex-shrink-0 bg-[var(--bg-card)] z-10 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)] relative"
                >

                    <div className="relative group">
                        {currentUserGroup ? (
                            <>
                                <div
                                    onClick={() => setSelectedGroup(currentUserGroup)}
                                    className={`w-12 h-12 md:w-14 md:h-14 rounded-full p-0.5 border-2 cursor-pointer hover:scale-105 transition-all ${currentUserGroup.stories.some(s => s.isOnchain || s.hiveTrxId)
                                        ? 'border-amber-400'
                                        : 'border-[var(--primary-color)]'
                                        }`}
                                >

                                    <img
                                        src={`https://images.hive.blog/u/${currentUserGroup.username}/avatar`}
                                        alt="Your Story"
                                        className="w-full h-full rounded-full object-cover bg-[var(--bg-canvas)]"
                                    />
                                </div>
                                <div
                                    onClick={() => setShowCreator(true)}
                                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--primary-color)] text-white rounded-full border-2 border-[var(--bg-card)] flex items-center justify-center cursor-pointer hover:scale-110 active:scale-90 transition-all shadow-md z-20"
                                >
                                    <span className="text-sm font-bold leading-none">+</span>
                                </div>
                            </>
                        ) : (
                            <div
                                onClick={() => setShowCreator(true)}
                                className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-dashed border-[var(--border-color)] flex items-center justify-center cursor-pointer group-hover:border-[var(--primary-color)] transition-all bg-[var(--bg-canvas)]"
                            >
                                <span className="text-xl md:text-2xl text-[var(--text-secondary)] group-hover:text-[var(--primary-color)]">+</span>
                            </div>
                        )}

                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">Your Story</span>
                </div>

                {/* Other User Stories (Scrollable) */}
                <div className="flex flex-1 items-center gap-2 py-3 px-3 overflow-x-auto no-scrollbar h-full">
                    {isLoading && groupedStories.length === 0 && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-[var(--primary-color)]/30 border-t-[var(--primary-color)] rounded-full animate-spin" />
                        </div>
                    )}

                    {groupedStories.map((group) => {
                        const hasOnchain = group.stories.some(s => s.isOnchain || s.hiveTrxId);
                        return (
                            <div
                                key={group.username}
                                onClick={() => setSelectedGroup(group)}
                                className="flex flex-col items-center gap-1 w-[64px] flex-shrink-0 cursor-pointer group"
                            >
                                <div className="relative w-12 h-12 md:w-14 md:h-14">
                                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full p-0.5 border-2 group-hover:scale-105 transition-all ${hasOnchain
                                        ? 'border-amber-400'
                                        : 'border-[var(--primary-color)]'
                                        }`}>

                                        <img
                                            src={`https://images.hive.blog/u/${group.username}/avatar`}
                                            alt={group.username}
                                            className="w-full h-full rounded-full object-cover bg-[var(--bg-canvas)]"
                                        />
                                    </div>
                                    {/* Onchain badge */}
                                    {hasOnchain && (
                                        <span
                                            title="Onchain story"
                                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[8px] font-bold text-black shadow"
                                        >
                                            ⛓
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold truncate w-full text-center">
                                    @{group.username}
                                </span>
                            </div>
                        );
                    })}

                    {!isLoading && groupedStories.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-2 h-full">
                            <p className="text-xs text-[var(--text-secondary)] italic">No active stories in the community yet.</p>
                        </div>
                    )}
                </div>

                {/* View Older Toggle (Fixed Right) */}
                <button
                    onClick={() => setShowOlder(prev => !prev)}
                    title={showOlder ? 'Showing last 48hrs — click to show only today' : 'Show older stories from yesterday'}
                    className={`flex flex-col items-center justify-center gap-1 w-[60px] md:w-[68px] py-3 flex-shrink-0 border-l border-[var(--border-color)] transition-all ${showOlder
                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'
                        }`}
                >

                    <History size={18} />
                    <span className="text-[9px] font-bold text-center leading-tight">
                        {showOlder ? 'Today only' : 'View older'}
                    </span>
                </button>
            </div>

            {/* Modals */}
            {showCreator && (
                <StoryCreator
                    onClose={() => setShowCreator(false)}
                    onSuccess={loadStories}
                />
            )}

            {selectedGroup && (
                <StoryViewer
                    group={selectedGroup}
                    onClose={() => setSelectedGroup(null)}
                    onNext={handleNextGroup}
                    onPrev={handlePrevGroup}
                />
            )}
        </div>
    );
};

