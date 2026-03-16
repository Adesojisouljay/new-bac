import { useState, useMemo, useRef } from 'react';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCommunity } from '../../community/context/CommunityContext';
import { pointsService } from '../../../services/pointsService';
import { cloudinaryService } from '../../../services/cloudinaryService';
import SimpleMDE from 'react-simplemde-editor';
import "easymde/dist/easymde.min.css";
import HiveMarkdown from '../../../components/HiveMarkdown';
import { MentionSuggestions } from '../../../components/MentionSuggestions';
import { useEffect } from 'react';

interface CommentBoxProps {
    parentAuthor: string;
    parentPermlink: string;
    onSuccess?: () => void;
}

export function CommentBox({ parentAuthor, parentPermlink, onSuccess }: CommentBoxProps) {
    const { showNotification } = useNotification();
    const { config } = useCommunity();
    const community = config?.id || 'global';
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
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

        // Insert placeholder
        cm.replaceSelection(placeholder);

        try {
            // Note: Since cloudinaryService.uploadFile doesn't naturally emit progress,
            // we'll update the text to show it's "Uploading..." until it finishes.
            const url = await cloudinaryService.uploadFile(file, 'image');

            // Find and replace the placeholder with the actual image markdown
            const content = cm.getValue();
            const newContent = content.replace(placeholder, `![${file.name}](${url})`);
            cm.setValue(newContent);

            // Restore cursor position roughly
            cm.setCursor({ line: startPos.line, ch: startPos.ch + `![${file.name}](${url})`.length });
        } catch (error: any) {
            showNotification(error.message || 'Image upload failed', 'error');
            // Remove the placeholder on failure
            const content = cm.getValue();
            cm.setValue(content.replace(placeholder, ''));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showNotification('Image size should be less than 10MB', 'error');
                return;
            }
            handleImageUpload(file);
        }
        // Reset input so the same file can be selected again
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
        placeholder: "Write a comment...",
        status: false,
        minHeight: "100px",
        maxHeight: "150px",
        autosave: {
            enabled: false,
            uniqueId: "comment-box-content",
            delay: 1000,
        },
        toolbar: [
            "bold", "italic", "heading", "|",
            "quote", "unordered-list", "ordered-list", "|",
            "link",
            {
                name: "image",
                action: () => {
                    setShowMediaChoice(!showMediaChoice);
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

        cm.on('keyup', handleChange);
        return () => cm.off('keyup', handleChange);
    }, [mdeInstance]);

    const handleSubmit = async () => {
        const username = localStorage.getItem('hive_user');
        if (!username) {
            showNotification("Please login to comment", 'warning');
            return;
        }

        if (!comment.trim()) return;

        setLoading(true);

        const permlink = `re-${parentAuthor}-${parentPermlink}-${Date.now()}`;

        try {
            const result = await transactionService.broadcast({
                type: 'comment',
                username,
                parent_author: parentAuthor,
                parent_permlink: parentPermlink,
                permlink,
                title: '',
                body: comment,
                json_metadata: JSON.stringify({ tags: ['sovraniche'], app: 'sovraniche/0.1' })
            }, (_data) => {
                showNotification("Action required: Sign with HiveAuth mobile app.", 'info');
            });

            if (result.success) {
                setComment('');
                showNotification("Comment published!", 'success');
                // Award comment points (fire-and-forget)
                const username = localStorage.getItem('hive_user');
                if (username) pointsService.awardPoints(username, community, 'comments', community);
                if (onSuccess) onSuccess();
            } else {
                showNotification("Comment failed: " + result.error, 'error');
            }
        } catch (e: any) {
            showNotification("Error: " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-6 flex flex-col w-full">
            {isPreview ? (
                <div className="flex-1 min-h-[100px] border border-[var(--border-color)] rounded-xl bg-[var(--bg-card)] p-4 overflow-y-auto mb-2 prose prose-sm max-w-none dark:prose-invert">
                    {comment.trim() ? (
                        <HiveMarkdown content={comment} />
                    ) : (
                        <p className="text-[var(--text-secondary)] italic">Nothing to preview...</p>
                    )}
                </div>
            ) : (
                <div className="flex-1 min-h-[100px] flex flex-col overflow-hidden border border-[var(--border-color)] rounded-xl bg-[var(--bg-canvas)] [&_.editor-toolbar]:border-x-0 [&_.editor-toolbar]:border-t-0 [&_.editor-toolbar]:border-b-[var(--border-color)] [&_.editor-toolbar]:bg-transparent [&_.editor-toolbar_button]:text-[var(--text-secondary)] hover:[&_.editor-toolbar_button]:bg-[var(--bg-canvas)] hover:[&_.editor-toolbar_button]:text-[var(--primary-color)] [&_.CodeMirror]:border-none [&_.CodeMirror]:bg-transparent [&_.CodeMirror]:text-[var(--text-primary)] [&_.CodeMirror]:rounded-b-lg">
                    <SimpleMDE
                        value={comment}
                        onChange={setComment}
                        options={options}
                        getMdeInstance={(instance) => setMdeInstance(instance as any)}
                        className="flex flex-col w-full [&_.EasyMDEContainer]:flex [&_.EasyMDEContainer]:flex-col [&_.CodeMirror]:flex-1 [&_.CodeMirror]:!min-h-[100px] [&_.CodeMirror]:!max-h-[150px] [&_.CodeMirror]:overflow-y-auto [&_.CodeMirror-scroll]:!min-h-[100px] cursor-text"
                    />
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
            />

            {showMediaChoice && !showUrlInput && (
                <div className="flex gap-2 mb-2 p-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-[var(--bg-canvas)] hover:bg-[var(--primary-color)]/10 text-xs font-bold transition-all border border-[var(--border-color)]"
                    >
                        <span className="fa fa-upload text-[var(--primary-color)]"></span>
                        Upload from Device
                    </button>
                    <button
                        onClick={() => setShowUrlInput(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-[var(--bg-canvas)] hover:bg-[var(--primary-color)]/10 text-xs font-bold transition-all border border-[var(--border-color)]"
                    >
                        <span className="fa fa-link text-[var(--primary-color)]"></span>
                        Paste Image URL
                    </button>
                    <button
                        onClick={() => setShowMediaChoice(false)}
                        className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}

            {showUrlInput && (
                <div className="flex gap-2 mb-2 p-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                        type="text"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="Paste image URL here..."
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInsertUrl();
                            if (e.key === 'Escape') setShowUrlInput(false);
                        }}
                        className="flex-1 px-3 py-1.5 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-md text-xs outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                    />
                    <button
                        onClick={handleInsertUrl}
                        disabled={!linkUrl.trim()}
                        className="px-3 py-1.5 bg-[var(--primary-color)] text-white text-xs font-bold rounded-md hover:brightness-110 disabled:opacity-50"
                    >
                        Insert
                    </button>
                    <button
                        onClick={() => {
                            setShowUrlInput(false);
                            setShowMediaChoice(false);
                            setLinkUrl('');
                        }}
                        className="p-1 px-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center mt-2 px-1">
                <button
                    onClick={() => setIsPreview(!isPreview)}
                    className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors"
                >
                    {isPreview ? 'Back to typing' : 'Preview comment'}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading || !comment.trim()}
                    className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? 'Posting...' : 'Reply'}
                </button>
            </div>

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
