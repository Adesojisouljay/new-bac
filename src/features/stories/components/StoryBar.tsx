import React, { useState, useEffect } from 'react';
import { storyService, GroupedStory } from '../services/storyService';
import { socketService } from '../../../services/socketService';
import { StoryCreator } from './StoryCreator';
import { StoryViewer } from './StoryViewer';

export const StoryBar: React.FC = () => {
    const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
    const [showCreator, setShowCreator] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<GroupedStory | null>(null);

    useEffect(() => {
        loadStories();

        const handleNewStory = () => {
            loadStories(); // Refresh bar when someone posts
        };

        socketService.on('new_story', handleNewStory);
        return () => socketService.off('new_story', handleNewStory);
    }, []);

    const loadStories = async () => {
        const stories = await storyService.getStories();
        setGroupedStories(stories);
    };

    return (
        <>
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl mb-6 shadow-sm min-h-[90px] overflow-hidden">
                {/* My Story Creator (Fixed Left) */}
                <div
                    onClick={() => setShowCreator(true)}
                    className="flex flex-col items-center justify-center gap-1 w-[80px] py-3 flex-shrink-0 cursor-pointer group bg-[var(--bg-card)] z-10 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)] relative"
                >
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-[var(--border-color)] flex items-center justify-center group-hover:border-[var(--primary-color)] transition-all bg-[var(--bg-canvas)]">
                        <span className="text-2xl text-[var(--text-secondary)] group-hover:text-[var(--primary-color)]">+</span>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">Your Story</span>
                </div>

                {/* Other User Stories (Scrollable) */}
                <div className="flex flex-1 items-center gap-2 py-3 px-3 overflow-x-auto no-scrollbar h-full">
                    {groupedStories.map((group) => (
                        <div
                            key={group.username}
                            onClick={() => setSelectedGroup(group)}
                            className="flex flex-col items-center gap-1 w-[64px] flex-shrink-0 cursor-pointer group"
                        >
                            <div className="w-14 h-14 rounded-full p-0.5 border-2 border-[var(--primary-color)] group-hover:scale-105 transition-all">
                                <img
                                    src={`https://images.hive.blog/u/${group.username}/avatar`}
                                    alt={group.username}
                                    className="w-full h-full rounded-full object-cover bg-[var(--bg-canvas)]"
                                />
                            </div>
                            <span className="text-[10px] font-bold truncate w-full text-center">
                                @{group.username}
                            </span>
                        </div>
                    ))}

                    {groupedStories.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-2 h-full">
                            <p className="text-xs text-[var(--text-secondary)] italic">No active stories in the community yet.</p>
                        </div>
                    )}
                </div>
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
                />
            )}
        </>
    );
};
