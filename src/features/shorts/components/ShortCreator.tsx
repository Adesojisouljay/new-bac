import React, { useState, useRef } from 'react';
import { shortService } from '../services/shortService';
import { useNotification } from '../../../contexts/NotificationContext';
import { cloudinaryService } from '../../../services/cloudinaryService';
import { Video, X, Upload, Smartphone, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MentionSuggestions } from '../../../components/MentionSuggestions';

interface ShortCreatorProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const ShortCreator: React.FC<ShortCreatorProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [caption, setCaption] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [hasQr, setHasQr] = useState<string | null>(null);

    // Mention State
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [showMentions, setShowMentions] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const username = localStorage.getItem('hive_user')?.replace(/^@/, '');
    const { showNotification } = useNotification();

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) { // 100MB limit
                showNotification('Video too large (max 100MB)', 'error');
                return;
            }
            setVideoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setStep(2); // Auto-advance to captioning
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setCaption(value);

        const cursor = e.target.selectionStart;
        const textBefore = value.substring(0, cursor);
        const mentionMatch = textBefore.match(/@([a-z0-9.-]*)$/i);

        if (mentionMatch) {
            const query = mentionMatch[1];
            // Approximate position for standard textarea (below the editor)
            const rect = e.target.getBoundingClientRect();
            setMentionQuery(query);
            setMentionPosition({ top: rect.top + 50, left: rect.left + 20 });
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const handleMentionSelect = (username: string) => {
        if (!textareaRef.current) return;
        const cursor = textareaRef.current.selectionStart;
        const textBefore = caption.substring(0, cursor);
        const textAfter = caption.substring(cursor);
        const startOfWord = textBefore.lastIndexOf('@');

        if (startOfWord !== -1) {
            const newText = textBefore.substring(0, startOfWord) + `@${username} ` + textAfter;
            setCaption(newText);
        }
        setShowMentions(false);
        setMentionQuery('');
        textareaRef.current.focus();
    };

    const handlePost = async () => {
        if (!username || !videoFile) return;

        setIsPosting(true);
        setUploadProgress(0);

        try {
            // 1. Upload to Cloudinary with progress
            const videoUrl = await cloudinaryService.uploadFile(
                videoFile,
                'video',
                (progress) => setUploadProgress(progress)
            );

            // 2. Broadcast onchain via unified transaction service
            const container = await shortService.getShortsContainer();
            const permlink = `bac-short-${username}-${Date.now()}`;

            const { transactionService } = await import('../../wallet/services/transactionService');

            const result = await transactionService.broadcast({
                type: 'comment',
                username,
                parent_author: container.author,
                parent_permlink: container.permlink,
                permlink,
                title: '',
                body: `Video Short: ${videoUrl}\n\n${caption}`,
                json_metadata: JSON.stringify({
                    app: 'bac/shorts/1.0',
                    type: 'short',
                    content: {
                        videoUrl,
                        caption
                    },
                    tags: ['bac-shorts', 'breakaway']
                })
            }, (hasData) => {
                setHasQr(hasData.qr);
            });

            if (result.success) {
                // Determine transaction ID based on broadcast method (result.result for HAS/Relay, result.result.id for Keychain)
                const hiveTrxId = result.result?.id || result.result?.txid || (typeof result.result === 'string' ? result.result : null);

                // Add 3-second delay as requested by user to ensure sync reliability
                setTimeout(async () => {
                    await shortService.postShort(username, {
                        type: 'video',
                        videoUrl,
                        caption
                    }, hiveTrxId, permlink);
                    showNotification('Short posted successfully! 🎬', 'success');
                    onSuccess();
                    onClose();
                }, 3000);
            } else {

                showNotification(result.error || 'Broadcast failed', 'error');
            }
        } catch (error) {
            console.error('[Short] Post error:', error);
            showNotification('Failed to post short', 'error');
        } finally {
            setIsPosting(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-[var(--border-color)] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[var(--primary-color)]/10 rounded-lg flex items-center justify-center">
                            <Video className="text-[var(--primary-color)]" size={18} />
                        </div>
                        <h3 className="font-black uppercase tracking-tight text-base">Create Short</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors text-[var(--text-secondary)]">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {step === 1 ? (
                        /* Step 1: Upload */
                        <div
                            onClick={() => !isPosting && fileInputRef.current?.click()}
                            className="aspect-[4/5] bg-[var(--bg-canvas)] rounded-[24px] border-2 border-dashed border-[var(--border-color)] hover:border-[var(--primary-color)] flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden"
                        >
                            <div className="w-16 h-16 bg-[var(--primary-color)]/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="text-[var(--primary-color)]" size={32} />
                            </div>
                            <p className="font-black uppercase tracking-widest text-[10px]">Select Video</p>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-1 uppercase opacity-60">MP4, WebM up to 100MB</p>
                        </div>
                    ) : (
                        /* Step 2: Preview & Caption */
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            {/* Small Preview */}
                            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-inner">
                                <video
                                    src={previewUrl || ''}
                                    className="w-full h-full object-contain"
                                    muted
                                    autoPlay
                                    loop
                                />
                                <button
                                    onClick={() => !isPosting && setStep(1)}
                                    className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Caption</label>
                                <textarea
                                    ref={textareaRef}
                                    value={caption}
                                    onChange={handleTextareaChange}
                                    placeholder="What's happening?..."
                                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl p-4 min-h-[120px] focus:outline-none focus:border-[var(--primary-color)] transition-colors resize-none text-sm font-medium leading-relaxed"
                                    disabled={isPosting}
                                />
                            </div>

                            <button
                                onClick={handlePost}
                                disabled={isPosting || !videoFile}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all shadow-lg shadow-[var(--primary-color)]/20 ${isPosting || !videoFile
                                    ? 'bg-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed opacity-50'
                                    : 'bg-[var(--primary-color)] text-white hover:brightness-110 hover:shadow-[var(--primary-color)]/40'
                                    }`}
                            >
                                {isPosting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Posting...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={18} />
                                        <span>Post Short</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Unified Transaction Overlay (Upload Progress OR QR) */}
                    {isPosting && (
                        <div className="absolute inset-0 z-[120] bg-[var(--bg-card)]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                            {hasQr ? (
                                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                    <div className="bg-white p-5 rounded-[32px] shadow-2xl mb-6 ring-8 ring-[var(--primary-color)]/5">
                                        <QRCodeSVG value={hasQr} size={200} />
                                    </div>
                                    <h4 className="text-lg font-black uppercase tracking-tight mb-2 text-[var(--text-primary)]">Authorize Post</h4>
                                    <p className="text-[10px] text-[var(--text-secondary)] uppercase font-black tracking-[0.2em] flex items-center gap-2">
                                        <Smartphone size={14} className="text-[var(--primary-color)]" /> Scan with Hive Wallet
                                    </p>
                                    <p className="mt-6 text-[10px] font-bold text-[var(--primary-color)] animate-pulse uppercase tracking-widest">
                                        Waiting for signature...
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full max-w-[240px] flex flex-col items-center">
                                    <div className="relative w-20 h-20 mb-8">
                                        <div className="absolute inset-0 border-4 border-[var(--primary-color)]/10 rounded-full" />
                                        <div className="absolute inset-0 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Upload size={24} className="text-[var(--primary-color)] animate-bounce" />
                                        </div>
                                    </div>
                                    <div className="w-full bg-[var(--bg-canvas)] h-2 rounded-full overflow-hidden mb-4 shadow-inner">
                                        <div
                                            className="h-full bg-[var(--primary-color)] transition-all duration-300 ease-out shadow-[0_0_15px_var(--primary-color)]"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.1em] mb-1 text-[var(--text-primary)]">Uploading Video</h4>
                                    <p className="text-[10px] font-black text-[var(--primary-color)] tabular-nums">
                                        {Math.round(uploadProgress)}% COMPLETE
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleVideoSelect}
                    accept="video/*"
                    className="hidden"
                />
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
};
