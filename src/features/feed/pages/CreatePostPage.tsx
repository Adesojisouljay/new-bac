import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import { pointsService } from '../../../services/pointsService';
import SimpleMDE from 'react-simplemde-editor';
import "easymde/dist/easymde.min.css";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import AdvancedSettingsModal, { AdvancedOptions } from '../components/AdvancedSettingsModal';
import { draftService, Draft } from '../services/draftService';
import { Settings, Save, Trash2, Calendar } from 'lucide-react';
import { useRef } from 'react';

export default function CreatePostPage() {
    const { config } = useCommunity();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [tags, setTags] = useState('');
    const dateInputRef = useRef<HTMLInputElement>(null);

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
    const [isDraftsOpen, setIsDraftsOpen] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<string>('');
    const [drafts, setDrafts] = useState<Draft[]>(draftService.getDrafts());

    const options = useMemo(() => ({
        spellChecker: false,
        placeholder: "Write your story...",
        status: false,
        autosave: {
            enabled: false, // We'll handle it manually with draftService for consistency
            uniqueId: "create-post-content",
            delay: 1000,
        },
        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"] as any
    }), []);

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
                setDrafts(draftService.getDrafts()); // Sync state
            }
        }, 10000); // Save every 10 seconds

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
        setIsDraftsOpen(false);
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
        setDrafts(draftService.getDrafts()); // Sync state
        showNotification('Draft saved manually!', 'success');
    };

    const handleDeleteDraft = (id: string) => {
        draftService.deleteDraft(id);
        setDrafts(draftService.getDrafts()); // Sync state
        if (currentDraftId === id) setCurrentDraftId(null);
    };

    const generatePermlink = (title: string) => {
        const slug = title.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-word chars
            .replace(/\s+/g, '-') // Replace spaces with -
            .substring(0, 50); // Limit length

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
            const tagList = tags.split(',').map(t => t.trim()).filter(t => t);

            // Ensure community tag is present and first (for category)
            const communityTag = config?.id || 'hive-106130';
            const finalTags = [communityTag, ...tagList.filter(t => t !== communityTag)];

            // Construct metadata
            const metadataObj: any = {
                tags: finalTags,
                app: 'breakaway-communities/0.1',
                format: 'markdown'
            };

            if (advancedOptions.description) {
                metadataObj.description = advancedOptions.description;
            }

            const jsonMetadata = JSON.stringify(metadataObj);

            // Prepare comment options
            let commentOptions;
            if (advancedOptions.reward !== 'default' || advancedOptions.beneficiaries.length > 0) {
                commentOptions = {
                    max_accepted_payout: advancedOptions.reward === 'decline' ? '0.000 HBD' : '1000000.000 HBD',
                    percent_hbd: advancedOptions.reward === 'power_up' ? 0 : 10000, // 10000 = 50%, 0 = 100% HP
                    allow_votes: true,
                    allow_curation_rewards: true,
                    beneficiaries: advancedOptions.beneficiaries
                };
            }

            const result = await transactionService.broadcast({
                type: 'comment',
                username,
                parent_author: '', // Empty for root post
                parent_permlink: communityTag, // First tag defines category/community
                permlink,
                title,
                body,
                json_metadata: jsonMetadata,
                options: commentOptions
            }, (_data) => {
                showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
            });

            if (result.success) {
                // Clear draft
                if (currentDraftId) {
                    draftService.deleteDraft(currentDraftId);
                }
                // Award post points (fire-and-forget)
                pointsService.awardPoints(username, communityTag, 'posts', communityTag);
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
        <div className="h-[calc(100vh-7rem)] -mb-8 max-w-[1600px] mx-auto pb-0 flex flex-col">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg mb-4 shrink-0">
                    {error}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
                {/* Left Column: Inputs */}
                <div className="flex flex-col gap-4 h-full min-h-0">
                    <div className="shrink-0">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-lg font-bold focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none transition-all"
                            placeholder="Post Title..."
                            disabled={loading}
                        />
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                        <SimpleMDE
                            value={body}
                            onChange={setBody}
                            options={options}
                            className="h-full flex flex-col [&_.EasyMDEContainer]:h-full [&_.EasyMDEContainer]:flex [&_.EasyMDEContainer]:flex-col [&_.CodeMirror]:flex-1 [&_.CodeMirror]:min-h-0"
                        />
                    </div>

                    <div className="shrink-0">
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none transition-all"
                            placeholder="Tags (e.g. photography, travel)"
                            disabled={loading}
                        />
                        <div className="flex items-center justify-between mt-1 ml-1">
                            <p className="text-xs text-[var(--text-secondary)]">
                                Community tag <b>#{config?.id || 'hive-106130'}</b> is added automatically.
                            </p>
                            <div
                                className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-canvas)] px-2 py-1 rounded-lg transition-all"
                                onClick={() => dateInputRef.current?.showPicker?.()}
                            >
                                <Calendar size={14} className="text-[var(--primary-color)]" />
                                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Schedule:</span>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    className="text-xs bg-transparent border-none text-[var(--primary-color)] font-bold outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark] w-28 [&::-webkit-calendar-picker-indicator]:hidden"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="hidden lg:block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-8 overflow-y-auto h-full shadow-sm custom-scrollbar">
                    <div className="mb-6 border-b border-[var(--border-color)] pb-4 sticky top-0 bg-[var(--bg-card)] z-10">
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Live Preview</span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-6 break-words">
                        {title || <span className="text-[var(--text-secondary)] italic">Post Title</span>}
                    </h1>

                    <div className="prose prose-lg dark:prose-invert max-w-none break-words">
                        {body ? (
                            <ReactMarkdown
                                rehypePlugins={[rehypeRaw]}
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                            >
                                {body.replace(/\n/g, '<br/>')}
                            </ReactMarkdown>
                        ) : (
                            <p className="text-[var(--text-secondary)] italic">Start writing to see the preview here...</p>
                        )}
                    </div>

                    {tags && (
                        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-[var(--border-color)]">
                            {tags.split(',').map((tag, i) => tag.trim() && (
                                <span key={i} className="px-3 py-1 rounded-full bg-[var(--bg-canvas)] text-sm text-[var(--text-secondary)]">
                                    #{tag.trim()}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between py-2 shrink-0 gap-3 mt-2">
                <button
                    onClick={() => setIsDraftsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)] transition-all"
                >
                    <Save size={20} />
                    <span>My Drafts ({drafts.length})</span>
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handleManualSave}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)] transition-all"
                    >
                        <Save size={20} />
                        <span>Save Draft</span>
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-color)] transition-all"
                    >
                        <Settings size={20} />
                        <span>Advanced</span>
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--primary-color)] hover:brightness-110 shadow-lg'}`}
                    >
                        {loading ? 'Publishing...' : scheduledDate ? 'Schedule Post' : 'Publish'}
                    </button>
                </div>
            </div>

            {/* Simple Drafts Modal */}
            {isDraftsOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-3xl shadow-2xl border border-[var(--border-color)] overflow-hidden">
                        <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                            <h3 className="text-xl font-black">My Drafts</h3>
                            <button onClick={() => setIsDraftsOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                            {drafts.length === 0 ? (
                                <p className="text-center py-8 text-[var(--text-secondary)] italic">No saved drafts found.</p>
                            ) : (
                                drafts.map(d => (
                                    <div key={d.id} className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)] flex items-center justify-between group hover:border-[var(--primary-color)] transition-all">
                                        <div className="flex-1 cursor-pointer" onClick={() => handleLoadDraft(d)}>
                                            <h4 className="font-bold truncate">{d.title || '(No Title)'}</h4>
                                            <p className="text-xs text-[var(--text-secondary)]">Updated: {new Date(d.lastUpdated).toLocaleString()}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDraft(d.id)}
                                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AdvancedSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                options={advancedOptions}
                onSave={setAdvancedOptions}
            />
        </div>
    );
}
