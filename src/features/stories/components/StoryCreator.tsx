import React, { useState, useRef } from 'react';
import { storyService } from '../services/storyService';
import { useNotification } from '../../../contexts/NotificationContext';
import { cloudinaryService } from '../../../services/cloudinaryService';
import { Image, X, Upload } from 'lucide-react';

interface StoryCreatorProps {
    onClose: () => void;
    onSuccess: () => void;
}

const STORY_CONTAINER_ACCOUNT = 'breakaway.app';

/** Deterministic daily container — same formula as backend storyChain.js */
function getTodayContainer(): { author: string; permlink: string } {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return {
        author: STORY_CONTAINER_ACCOUNT,
        permlink: `bac-stories-${y}-${m}-${d}`
    };
}

/**
 * Broadcast the story comment via Hive Keychain's requestBroadcast.
 * This is the most reliable Keychain method — works with any posting-level op.
 * Returns true on success, false on cancel/failure.
 */
async function broadcastViaKeychain(
    username: string,
    container: { author: string; permlink: string },
    content: { type: string; text?: string; imageUrl?: string }
): Promise<boolean> {
    const keychain = (window as any).hive_keychain;
    if (!keychain) {
        console.warn('[Story] Keychain not installed');
        return false;
    }

    const permlink = `bac-story-${username}-${Date.now()}`;
    let body = content.text || '';
    if (content.imageUrl) {
        body = content.imageUrl + (content.text ? `\n\n${content.text}` : '');
    }
    if (!body.trim()) body = '📸 (Story)';

    const ops = [
        ['comment', {
            parent_author: container.author,
            parent_permlink: container.permlink,
            author: username,
            permlink,
            title: '',
            body,
            json_metadata: JSON.stringify({
                app: 'bac/stories/1.0',
                type: 'story',
                content,
                tags: ['bac-stories', 'breakaway']
            })
        }]
    ];

    return new Promise((resolve) => {
        keychain.requestBroadcast(
            username,
            ops,
            'posting',
            (response: any) => {
                if (response.success) {
                    console.log(`✅ [Story] Onchain! tx: ${response.result?.id}`);
                    resolve(true);
                } else {
                    console.warn('[Story] Keychain broadcast rejected/cancelled:', response.message);
                    resolve(false);
                }
            }
        );
    });
}

export const StoryCreator: React.FC<StoryCreatorProps> = ({ onClose, onSuccess }) => {
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [postingStatus, setPostingStatus] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const username = localStorage.getItem('hive_user');
    const { showNotification } = useNotification();

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                showNotification('Image too large (max 10MB)', 'warning');
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePost = async () => {
        if (!username) return;
        if (!content.trim() && !imageFile) return;

        setIsPosting(true);
        try {
            // --- Build content ---
            let storyContent: any = { type: 'text', text: content };

            if (imageFile) {
                setIsUploading(true);
                setPostingStatus('Uploading image...');
                try {
                    const imageUrl = await cloudinaryService.uploadFile(imageFile, 'image');
                    storyContent = { type: 'image', imageUrl, text: content };
                } catch (err: any) {
                    showNotification(`Image upload failed: ${err.message}`, 'error');
                    return;
                } finally {
                    setIsUploading(false);
                }
            }

            // --- Step 1: Post onchain via Keychain FIRST ---
            const keychainInstalled = !!(window as any).hive_keychain;
            if (keychainInstalled) {
                setPostingStatus('Confirm in Keychain...');
                const container = getTodayContainer();
                const success = await broadcastViaKeychain(username, container, storyContent);
                if (success) {
                    // --- Step 2: Save offchain to backend (after onchain confirmed) ---
                    setPostingStatus('Saving story...');
                    await storyService.postStory(username, storyContent);
                    showNotification('Story posted onchain! ⛓', 'success');
                    onSuccess();
                    onClose();
                } else {
                    // User cancelled Keychain — ask if they want to save offchain only
                    showNotification('Keychain cancelled — story not posted', 'warning');
                    // Still allow modal to close; offchain not saved since user bailed
                }
            } else {
                // No Keychain — offchain only
                setPostingStatus('Saving story...');
                await storyService.postStory(username, storyContent);
                showNotification('Story posted!', 'success');
                onSuccess();
                onClose();
            }
        } catch (error) {
            showNotification('Failed to post story', 'error');
        } finally {
            setIsPosting(false);
            setIsUploading(false);
            setPostingStatus('');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
                    <h2 className="text-xl font-bold">New Story</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    {imagePreview ? (
                        <div className="relative rounded-2xl overflow-hidden aspect-video bg-black/20 group">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                            <button
                                onClick={() => { setImageFile(null); setImagePreview(null); }}
                                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-40 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[var(--primary-color)]/5 hover:border-[var(--primary-color)]/50 transition-all text-[var(--text-secondary)]"
                        >
                            <Image size={32} />
                            <span className="font-medium">Add Image (Optional)</span>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageSelect}
                    />

                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={imageFile ? 'Add a caption...' : "What's happening? (Stories last 24 hours)"}
                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-4 min-h-[120px] text-lg focus:outline-none focus:border-[var(--primary-color)] resize-none"
                    />

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            disabled={isPosting}
                            className="px-6 py-3 rounded-xl font-bold text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePost}
                            disabled={isPosting || isUploading || (!content.trim() && !imageFile)}
                            className="px-8 py-3 bg-[var(--primary-color)] text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[var(--primary-color)]/20 flex items-center gap-2"
                        >
                            {isPosting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{postingStatus || 'Posting...'}</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Post Story
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
