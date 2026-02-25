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
            <div className="flex items-center gap-4 p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-x-auto no-scrollbar mb-6 shadow-sm">
                {/* My Story Creator */}
                <div
                    onClick={() => setShowCreator(true)}
                    className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer group"
                >
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-[var(--border-color)] flex items-center justify-center group-hover:border-[var(--primary-color)] transition-all bg-[var(--bg-canvas)]">
                        <span className="text-2xl text-[var(--text-secondary)] group-hover:text-[var(--primary-color)]">+</span>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">Your Story</span>
                </div>

                {/* Other User Stories */}
                {groupedStories.map((group) => (
                    <div
                        key={group.username}
                        onClick={() => setSelectedGroup(group)}
                        className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer group"
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
                    <div className="flex-1 flex items-center justify-center py-2">
                        <p className="text-xs text-[var(--text-secondary)] italic">No active stories in the community yet.</p>
                    </div>
                )}
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
