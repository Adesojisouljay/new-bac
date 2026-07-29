import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import { pointsService } from '../../../services/pointsService';
import SimpleMDE from 'react-simplemde-editor';
import "easymde/dist/easymde.min.css";
import HiveMarkdown from '../../../components/HiveMarkdown';
import AdvancedSettingsModal, { AdvancedOptions, Draft } from '../components/AdvancedSettingsModal';
import { draftService } from '../services/draftService';
import { Settings, MoreVertical } from 'lucide-react';
import { UnifiedDataService } from '../../../services/unified';
import { CommunitySelect } from '../components/CommunitySelect';
import { cloudinaryService } from '../../../services/cloudinaryService';
import EasyMDE from 'easymde';
import { MentionSuggestions } from '../../../components/MentionSuggestions';

export default function CreatePostPage() {
    const { config } = useCommunity();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [tags, setTags] = useState('');
    const [destination, setDestination] = useState<string>('');
    const [communities, setCommunities] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const isGlobal = config?.id === 'global';
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial list of popular communities
    const fetchPopularCommunities = async () => {
        try {
            const result = await UnifiedDataService.listCommunities('', 50);
            setCommunities(result || []);
        } catch (e) {
            console.error("Failed to fetch global communities", e);
        }
    };

    // Lock body scroll to prevent page-level scrolling
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Fetch popular communities for Global Mode
    useEffect(() => {
        if (isGlobal) {
            fetchPopularCommunities();
        }
    }, [isGlobal]);

    const handleSearch = async (query: string) => {
        if (!isGlobal) return;

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!query.trim()) {
            fetchPopularCommunities();
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const result = await UnifiedDataService.listCommunities(query, 50);
                setCommunities(result || []);
            } catch (e) {
                console.error("Search failed", e);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce
    };

    // Advanced Options State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [advancedOptions, setAdvancedOptions] = useState<AdvancedOptions>({
        reward: 'default',
        beneficiaries: [],
        description: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [scheduledDate, setScheduledDate] = useState<string>('');
    const [drafts, setDrafts] = useState<Draft[]>(draftService.getDrafts() as Draft[]);

    // Media States
    const [showMediaChoice, setShowMediaChoice] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mdeInstance, setMdeInstance] = useState<EasyMDE | null>(null);

    // Mention State
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [showMentions, setShowMentions] = useState(false);

    const handleImageUpload = async (file: File) => {
        if (!mdeInstance) return;
        const cm = mdeInstance.codemirror;
        const startPos = cm.getCursor();
        const placeholder = `![Uploading ${file.name} (0%)...]()`;

        cm.replaceSelection(placeholder);

        try {
            const url = await cloudinaryService.uploadFile(file, 'image');
            const content = cm.getValue();
            const newContent = content.replace(placeholder, `![${file.name}](${url})`);
            cm.setValue(newContent);
            cm.setCursor({ line: startPos.line, ch: startPos.ch + `![${file.name}](${url})`.length });
        } catch (error: any) {
            showNotification(error.message || 'Image upload failed', 'error');
            const content = cm.getValue();
            cm.setValue(content.replace(placeholder, ''));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                showNotification('Image size should be less than 10MB', 'error');
                return;
            }
            handleImageUpload(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowMediaChoice(false);
    };

    const handleInsertUrl = () => {
        if (!mdeInstance || !linkUrl.trim()) return;
        const cm = mdeInstance.codemirror;
        cm.replaceSelection(`![image](${linkUrl.trim()})`);
        setLinkUrl('');
        setShowUrlInput(false);
        setShowMediaChoice(false);
    };

    const options = useMemo(() => ({
        spellChecker: false,
        placeholder: "Write your story...",
        status: false,
        autosave: {
            enabled: false,
            uniqueId: "create-post-content",
            delay: 1000,
        },
        minHeight: "500px",
        toolbar: [
            "bold", "italic", "heading", "|",
            "quote", "unordered-list", "ordered-list", "|",
            "link",
            {
                name: "image",
                action: () => {
                    setShowMediaChoice(prev => !prev);
                    setShowUrlInput(false);
                },
                className: "fa fa-image",
                title: "Media Options",
            },
            "|", "guide"
        ] as any
    }), []);

    const handleMentionSelect = (username: string) => {
        if (!mdeInstance) return;
        const cm = mdeInstance.codemirror;
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        const startOfWord = line.lastIndexOf('@', cursor.ch - 1);

        if (startOfWord !== -1) {
            cm.replaceRange(
                `@${username} `,
                { line: cursor.line, ch: startOfWord },
                { line: cursor.line, ch: cursor.ch }
            );
        }
        setShowMentions(false);
        setMentionQuery('');
        cm.focus();
    };

    // CodeMirror listener for mentions
    useEffect(() => {
        const cm = mdeInstance?.codemirror;
        if (!cm) return;

        const handleChange = (instance: any) => {
            const cursor = instance.getCursor();
            const line = instance.getLine(cursor.line);

            // Check for @ starting from cursor backwards
            const textBefore = line.substring(0, cursor.ch);
            const mentionMatch = textBefore.match(/@([a-z0-9.-]*)$/i);

            if (mentionMatch) {
                const query = mentionMatch[1];
                const coords = instance.cursorCoords(true, 'window');
                setMentionQuery(query);
                setMentionPosition({ top: coords.top + 30, left: coords.left });
                setShowMentions(true);
            } else {
                setShowMentions(false);
            }
        };

        const handleDrop = (instance: any, e: DragEvent) => {
            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                e.preventDefault();
                if (file.size > 10 * 1024 * 1024) {
                    showNotification('Image size should be less than 10MB', 'error');
                    return;
                }
                const pos = instance.coordsChar({ left: e.clientX, top: e.clientY });
                instance.setCursor(pos);
                handleImageUpload(file);
            }
        };

        const handlePaste = (_instance: any, e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                            showNotification('Image size should be less than 10MB', 'error');
                            return;
                        }
                        handleImageUpload(file);
                    }
                    break;
                }
            }
        };

        cm.on('keyup', handleChange);
        cm.on('drop', handleDrop);
        cm.on('paste', handlePaste);

        return () => {
            cm.off('keyup', handleChange);
            cm.off('drop', handleDrop);
            cm.off('paste', handlePaste);
        };
    }, [mdeInstance]);

    // Auto-save logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (title || body || tags) {
                const saved = draftService.saveDraft({
                    id: currentDraftId || undefined,
                    title,
                    body,
                    tags,
                    scheduledAt: scheduledDate ? new Date(scheduledDate).getTime() : undefined
                });
                if (!currentDraftId) setCurrentDraftId(saved.id);
                setDrafts(draftService.getDrafts() as Draft[]);
            }
        }, 10000);

        return () => clearTimeout(timer);
    }, [title, body, tags, scheduledDate, currentDraftId]);

    const handleLoadDraft = (draft: Draft) => {
        setTitle(draft.title);
        setBody(draft.body);
        setTags(draft.tags || '');
        setCurrentDraftId(draft.id);
        if (draft.scheduledAt) {
            setScheduledDate(new Date(draft.scheduledAt).toISOString().split('T')[0]);
        }
        setIsSettingsOpen(false); // Close settings if it was open
        showNotification('Draft loaded successfully!', 'success');
    };

    const handleManualSave = () => {
        if (!title && !body && !tags) return;
        const saved = draftService.saveDraft({
            id: currentDraftId || undefined,
            title,
            body,
            tags,
            scheduledAt: scheduledDate ? new Date(scheduledDate).getTime() : undefined
        });
        if (!currentDraftId) setCurrentDraftId(saved.id);
        setDrafts(draftService.getDrafts() as Draft[]);
        showNotification('Draft saved successfully!', 'success');
    };

    const handleDeleteDraft = (id: string) => {
        draftService.deleteDraft(id);
        setDrafts(draftService.getDrafts() as Draft[]);
        if (currentDraftId === id) setCurrentDraftId(null);
    };

    const generatePermlink = (title: string) => {
        const slug = title.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);

        const random = Math.random().toString(36).substring(2, 7);
        return `${slug}-${random}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const username = localStorage.getItem('hive_user');

        if (!username) {
            setError("Please login to create a post");
            return;
        }

        if (!title.trim() || !body.trim()) {
            setError("Title and body are required");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const permlink = generatePermlink(title);
            const tagList = tags.split(/\s+/).map(t => t.trim().toLowerCase()).filter(t => t);
            const baseTag = isGlobal ? destination : (config?.id || 'global');
            const finalTags = baseTag ? [baseTag, ...tagList.filter(t => t !== baseTag)] : tagList;
            const parentPermlink = finalTags.length > 0 ? finalTags[0] : 'blog';

            const metadataObj: any = {
                tags: finalTags,
                app: 'sovraniche/0.1',
                format: 'markdown'
            };

            if (advancedOptions.description) {
                metadataObj.description = advancedOptions.description;
            }

            const jsonMetadata = JSON.stringify(metadataObj);

            let commentOptions;
            if (advancedOptions.reward !== 'default' || advancedOptions.beneficiaries.length > 0) {
                commentOptions = {
                    max_accepted_payout: advancedOptions.reward === 'decline' ? '0.000 HBD' : '1000000.000 HBD',
                    percent_hbd: advancedOptions.reward === 'power_up' ? 0 : 10000,
                    allow_votes: true,
                    allow_curation_rewards: true,
                    beneficiaries: advancedOptions.beneficiaries
                };
            }

            const result = await transactionService.broadcast({
                type: 'comment',
                username,
                parent_author: '',
                parent_permlink: parentPermlink,
                permlink,
                title,
                body,
                json_metadata: jsonMetadata,
                options: commentOptions
            }, (_data) => {
                showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
            });

            if (result.success) {
                if (currentDraftId) {
                    draftService.deleteDraft(currentDraftId);
                }
                if (baseTag) {
                    pointsService.awardPoints(username, baseTag, 'posts', baseTag);
                }
                navigate(`/post/${username}/${permlink}`);
            } else {
                setError(result.error || "Failed to publish post");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[calc(100dvh-150px)] lg:h-[calc(100dvh-100px)] max-w-[1600px] mx-auto flex flex-col gap-2 px-4 md:px-8 overflow-hidden">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg shrink-0">
                    {error}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pt-2">
                {/* 1. Compose side (Left) */}
                <div className="flex flex-col gap-4 min-h-0 h-full">
                    {/* Community Selector - stacked above Compose card */}
                    {isGlobal && (
                        <div className="shrink-0">
                            <CommunitySelect
                                value={destination}
                                onChange={setDestination}
                                communities={communities}
                                disabled={loading}
                                onSearch={handleSearch}
                                isSearching={isSearching}
                            />
                        </div>
                    )}

                    {/* Compose card */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                        {/* Header: Title */}
                        <div className="shrink-0 p-4 border-b border-[var(--border-color)]">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent text-[var(--text-primary)] text-xl font-bold outline-none placeholder:text-[var(--text-secondary)]"
                                placeholder="Post Title..."
                                disabled={loading}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck="false"
                            />
                        </div>
                        {/* Body: Editor */}
                        <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
                            <SimpleMDE
                                value={body}
                                onChange={setBody}
                                options={options}
                                getMdeInstance={(instance) => setMdeInstance(instance as any)}
                                className="h-full flex flex-col [&_.EasyMDEContainer]:flex-1 [&_.EasyMDEContainer]:flex [&_.EasyMDEContainer]:flex-col [&_.CodeMirror]:flex-1 [&_.CodeMirror]:!min-h-0 [&_.CodeMirror]:!h-0 [&_.CodeMirror-scroll]:!min-h-0 [&_.cm-s-easymde]:border-none"
                            />
                            {/* Media Input/Overlays integrated inside the editor card */}
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                            {(showMediaChoice || showUrlInput) && (
                                <div className="absolute bottom-0 left-0 right-0 z-20 animate-in slide-in-from-bottom-2">
                                    {showUrlInput ? (
                                        <div className="flex gap-2 p-3 bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-xl">
                                            <input
                                                type="text"
                                                value={linkUrl}
                                                onChange={(e) => setLinkUrl(e.target.value)}
                                                placeholder="Paste image URL..."
                                                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-canvas)] text-xs outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                autoFocus
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck="false"
                                            />
                                            <button onClick={handleInsertUrl} disabled={!linkUrl.trim()} className="px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-lg hover:brightness-110">Insert</button>
                                            <button onClick={() => { setShowUrlInput(false); setShowMediaChoice(false); setLinkUrl(''); }} className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors">✕</button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 p-3 bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-xl">
                                            <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--bg-canvas)] hover:brightness-95 text-xs font-bold border border-[var(--border-color)]">
                                                <span className="fa fa-upload text-[var(--primary-color)]"></span> Upload Device
                                            </button>
                                            <button onClick={() => setShowUrlInput(true)} className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--bg-canvas)] hover:brightness-95 text-xs font-bold border border-[var(--border-color)]">
                                                <span className="fa fa-link text-[var(--primary-color)]"></span> Paste URL
                                            </button>
                                            <button onClick={() => setShowMediaChoice(false)} className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors">✕</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Preview card (Right) */}
                <div className="hidden lg:flex flex-col h-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                    <div className="shrink-0 p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Live Preview</span>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 hover:bg-[var(--bg-canvas)] rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--primary-color)] group"
                            title="Advanced Settings & Drafts"
                        >
                            <Settings size={18} className="group-hover:rotate-45 transition-transform" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[var(--bg-card)]">
                        <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-6 break-words">
                            {title || <span className="text-[var(--text-secondary)] italic">Post Title</span>}
                        </h1>
                        <div className="prose prose-lg dark:prose-invert max-w-none break-words">
                            {body ? (
                                <HiveMarkdown content={body} />
                            ) : (
                                <p className="text-[var(--text-secondary)] italic">Start writing to see the preview here...</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Bottom Footer: Only Tags and Publish */}
            <div className="shrink-0 pt-2 lg:pt-4 border-t border-[var(--border-color)] lg:border-none">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
                    {/* Left side: Tag Input */}
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-all shadow-sm"
                            placeholder="Add tags separated by spaces..."
                            disabled={loading}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                        />
                        <div className="flex px-1.5">
                            {isGlobal ? (
                                <p className="text-[10px] md:text-xs text-[var(--text-secondary)] leading-tight italic">First tag becomes the category.</p>
                            ) : (
                                <p className="text-[10px] md:text-xs text-[var(--text-secondary)] leading-tight italic">Auto-tag: <b>#{config?.id || 'global'}</b></p>
                            )}
                        </div>
                    </div>

                    {/* Right side: Final Tags Preview and Publish */}
                    <div className="flex flex-col gap-3">
                        {/* Live Tags Preview in Footer area */}
                        <div className="flex flex-wrap items-center justify-end gap-2 px-1">
                            {tags && tags.split(/\s+/).map((tag, i) => tag.trim() && (
                                <span key={i} className="px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] font-bold shadow-sm">
                                    #{tag.trim().toLowerCase()}
                                </span>
                            ))}
                        </div>

                        {/* Publish Button and Settings (on mobile) */}
                        <div className="flex items-center justify-end gap-3 md:gap-4 pb-1">
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="lg:hidden p-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-all"
                            >
                                <MoreVertical size={20} />
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`flex-1 sm:flex-none px-10 md:px-14 py-3 rounded-2xl font-black text-white transition-all shadow-lg active:scale-95 ${loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-[var(--primary-color)] to-[#ff4e50] hover:brightness-110 shadow-xl'}`}
                            >
                                <span className="text-sm md:text-base">{loading ? 'Publishing...' : scheduledDate ? 'Schedule Post' : 'Publish Post'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AdvancedSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                options={advancedOptions}
                onSave={setAdvancedOptions}
                drafts={drafts}
                onLoadDraft={handleLoadDraft}
                onSaveDraft={handleManualSave}
                onDeleteDraft={handleDeleteDraft}
                scheduledDate={scheduledDate}
                onScheduledDateChange={setScheduledDate}
            />

            {showMentions && (
                <MentionSuggestions
                    query={mentionQuery}
                    position={mentionPosition}
                    onSelect={handleMentionSelect}
                />
            )}
        </div>
    );
}
