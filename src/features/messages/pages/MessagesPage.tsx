import { useState, useEffect, useRef } from 'react';
import { messageService, Message, Conversation } from '../services/messageService';
import { useNotification } from '../../../contexts/NotificationContext';
import { socketService } from '../../../services/socketService';
import { useSocket } from '../../../contexts/SocketContext';
import { cloudinaryService } from '../../../services/cloudinaryService';
import { useChat } from '../../../contexts/ChatContext';
import { fixWebmDuration } from '../../../utils/fixWebmDuration';
import { Image, Loader2, Send, Mic, Square, ArrowLeft } from 'lucide-react';
import { VoiceNotePlayer } from '../../../components/VoiceNotePlayer';
import { EmojiPicker } from '../../../components/EmojiPicker';
import { StickerPicker } from '../../../components/StickerPicker';

export function MessagesPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [isSecure, setIsSecure] = useState(false); // Default to off for "normal" chat
    const [username] = useState(localStorage.getItem('hive_user'));
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedBlob, setRecordedBlob] = useState<File | null>(null);
    const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
    const [imageCaption, setImageCaption] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

    const { showNotification } = useNotification();
    const { resetUnreadCount } = useChat();
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);
    const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const recordingStartTimeRef = useRef<number>(0);
    const { onlineUsers } = useSocket();

    const { hiveClient } = messageService;

    useEffect(() => {
        if (username) {
            loadMessages();
        }
    }, [username]);

    useEffect(() => {
        const handleNewMessage = (rawMsg: any) => {
            // Map the message properties from the backend
            const msg: Message = {
                ...rawMsg,
                id: rawMsg.id || rawMsg.trx_id,
                isEncrypted: rawMsg.message?.startsWith('#')
            };

            console.log(`✉️ Received message: ${msg.id} from ${msg.from}`);

            if (msg.from === username || msg.to === username) {
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    const newMessages = [...prev, msg].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    // Update conversations too
                    const convos = messageService.getConversations(newMessages, username!);
                    setConversations(convos);

                    // Reset count if we are actively viewing this conversation or just seeing the list
                    resetUnreadCount();
                    return newMessages;
                });
            }
        };

        socketService.on('new_message', handleNewMessage);
        return () => socketService.off('new_message', handleNewMessage);
    }, [username]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedUser]);

    useEffect(() => {
        if (searchQuery.length > 2) {
            const timer = setTimeout(async () => {
                const results = await hiveClient.database.call('lookup_accounts', [searchQuery, 10]);
                setSearchResults(results.filter((u: string) => u !== username));
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, username]);

    const loadMessages = async () => {
        if (!username) return;
        const history = await messageService.getMessageHistory(username);
        setMessages(history);
        const convos = messageService.getConversations(history, username);
        setConversations(convos);
        if (convos.length > 0 && !selectedUser) {
            setSelectedUser(convos[0].otherUser);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !selectedUser || !newMessage.trim()) return;

        // If editing an existing message, delegate to edit handler
        if (editingMessage) {
            await handleEditSubmit();
            return;
        }

        setSending(true);
        try {
            let payload = newMessage.trim();

            // Wrap in a reply envelope if replying to a message
            if (replyingTo) {
                const refText = (replyingTo.decrypted || replyingTo.message).slice(0, 80);
                const envelope = { _r: { from: replyingTo.from, txt: refText }, _t: payload };
                payload = JSON.stringify(envelope);
            }

            let finalMessage = payload;
            if (isSecure) {
                showNotification('Waiting for Keychain encryption...', 'info');
                finalMessage = await messageService.encryptMessage(username, selectedUser, payload);
            }

            await messageService.sendMessage(username, selectedUser, finalMessage);
            setNewMessage('');
            setReplyingTo(null);
        } catch (error: any) {
            const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
            showNotification(`Error: ${errorMsg}`, 'error');
        } finally {
            setSending(false);
        }
    };

    const handleEditSubmit = async () => {
        if (!username || !editingMessage || !newMessage.trim()) return;
        setSending(true);
        try {
            let payload = newMessage.trim();
            if (isSecure) {
                payload = await messageService.encryptMessage(username, selectedUser!, payload);
            }

            const apiBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
            const msgId = editingMessage.mongoId;
            if (!msgId) throw new Error('Message ID not available — try refreshing the chat');

            const res = await fetch(`${apiBase}/api/messages/${msgId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: username, newMessage: payload }),
            });

            if (!res.ok) throw new Error('Failed to edit message');

            // Update local state
            setMessages(prev => prev.map(m =>
                m.mongoId === msgId
                    ? { ...m, message: payload, decrypted: newMessage.trim(), edited: true }
                    : m
            ));
            showNotification('Message updated', 'success');
        } catch (err: any) {
            showNotification(`Edit failed: ${err.message}`, 'error');
        } finally {
            setSending(false);
            setEditingMessage(null);
            setNewMessage('');
        }
    };

    const startReply = (msg: Message) => {
        setReplyingTo(msg);
        setEditingMessage(null);
        messageInputRef.current?.focus();
    };

    const startEdit = (msg: Message) => {
        const raw = msg.decrypted || msg.message;
        // If this is a reply envelope, extract the text portion to edit
        let text = raw;
        try {
            const parsed = JSON.parse(raw);
            if (parsed._t) text = parsed._t;
        } catch { /* plain text — use as-is */ }

        setEditingMessage(msg);
        setNewMessage(text);
        setReplyingTo(null);
        setTimeout(() => messageInputRef.current?.focus(), 50);
    };

    const cancelReplyOrEdit = () => {
        setReplyingTo(null);
        setEditingMessage(null);
        setNewMessage('');
    };

    const scrollToReply = (ref: { from: string; txt: string }) => {
        // Must use the same derived list that messageRefs was built from
        const list = messages
            .filter(m => m.from === selectedUser || m.to === selectedUser)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const idx = list.findIndex(m => {
            if (m.from !== ref.from) return false;
            const raw = m.decrypted || m.message;
            if (raw.slice(0, 80) === ref.txt) return true;
            // Also test the _t field of a reply envelope
            try {
                const parsed = JSON.parse(raw);
                if (parsed._t && parsed._t.slice(0, 80) === ref.txt) return true;
            } catch { }
            return false;
        });

        if (idx === -1) return;
        const el = messageRefs.current.get(idx);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedKey(String(idx));
            setTimeout(() => setHighlightedKey(null), 1800);
        }
    };


    const handleImageUpload = (file: File) => {
        if (!username || !selectedUser) return;

        if (file.size > 10 * 1024 * 1024) {
            showNotification('Image too large (max 10MB)', 'warning');
            return;
        }

        // Store locally for preview — don't upload yet
        setPendingImageFile(file);
        setPendingImagePreviewUrl(URL.createObjectURL(file));
        setImageCaption('');
        setIsDragging(false);
    };

    const sendPendingImage = async () => {
        if (!pendingImageFile || !username || !selectedUser) return;

        setUploadingImage(true);
        try {
            const imageUrl = await cloudinaryService.uploadFile(pendingImageFile, 'image');
            const combined = imageCaption.trim() ? `${imageUrl}\n${imageCaption.trim()}` : imageUrl;

            let finalMessage = combined;
            if (isSecure) {
                finalMessage = await messageService.encryptMessage(username, selectedUser, combined);
            }

            await messageService.sendMessage(username, selectedUser, finalMessage);
            showNotification('Image sent!', 'success');
            discardPendingImage();
        } catch (error: any) {
            showNotification(`Upload failed: ${error.message}`, 'error');
        } finally {
            setUploadingImage(false);
        }
    };

    const discardPendingImage = () => {
        if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
        setPendingImageFile(null);
        setPendingImagePreviewUrl(null);
        setImageCaption('');
        setIsDragging(false);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (selectedUser) setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        } else if (file) {
            showNotification('Only images are supported for now.', 'warning');
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = async () => {
                const rawBlob = new Blob(chunks, { type: 'audio/webm' });
                const durationSeconds = (Date.now() - recordingStartTimeRef.current) / 1000;
                const fixedBlob = await fixWebmDuration(rawBlob, durationSeconds);
                const file = new File([fixedBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
                // Store for preview — do NOT auto-send
                setRecordedBlob(file);
                setRecordedBlobUrl(URL.createObjectURL(file));
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            recordingStartTimeRef.current = Date.now();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err: any) {
            showNotification('Could not start recording: ' + err.message, 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
    };

    const sendRecordedAudio = async () => {
        if (!recordedBlob) return;
        await handleAudioUpload(recordedBlob);
        discardRecording();
    };

    const discardRecording = () => {
        if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlob(null);
        setRecordedBlobUrl(null);
        setRecordingTime(0);
    };

    const handleAudioUpload = async (file: File) => {
        if (!username || !selectedUser) return;

        setUploadingImage(true);
        try {
            const audioUrl = await cloudinaryService.uploadFile(file, 'video');

            let finalMessage = audioUrl;
            if (isSecure) {
                finalMessage = await messageService.encryptMessage(username, selectedUser, audioUrl);
            }

            await messageService.sendMessage(username, selectedUser, finalMessage);
            showNotification('Voice note sent!', 'success');
        } catch (error: any) {
            showNotification(`Upload failed: ${error.message}`, 'error');
        } finally {
            setUploadingImage(false);
        }
    };

    const sendSticker = async (url: string) => {
        if (!username || !selectedUser) return;
        try {
            let finalMessage = url;
            if (isSecure) {
                finalMessage = await messageService.encryptMessage(username, selectedUser, url);
            }
            await messageService.sendMessage(username, selectedUser, finalMessage);
        } catch (error: any) {
            showNotification(`Failed to send sticker: ${error.message}`, 'error');
        }
    };

    const renderMessageContent = (msg: Message) => {
        const raw = msg.decrypted || msg.message;

        // Check for reply envelope: {"_r":{"from":"...","txt":"..."},"_t":"..."}
        let replyRef: { from: string; txt: string } | null = null;
        let text = raw;
        try {
            const parsed = JSON.parse(raw);
            if (parsed._r && parsed._t) {
                replyRef = parsed._r;
                text = parsed._t;
            }
        } catch { }

        const renderBody = (content: string) => {
            // Step 1: extract the first URL from the message
            const urlMatch = content.match(/(https?:\/\/[^\s]+)/i);
            if (!urlMatch) return <p className="whitespace-pre-wrap">{content}</p>;

            const url = urlMatch[0];
            const caption = content.replace(url, '').trim();

            // Step 2: classify by Cloudinary resource type or file extension
            const isAudio = /\/video\/upload\//.test(url) || /\.(mp3|wav|ogg|webm)(\?|$)/i.test(url);
            const isImage = /\/image\/upload\//.test(url) || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);

            if (isAudio) return <VoiceNotePlayer src={url} />;

            if (isImage) {
                return (
                    <div className="space-y-2">
                        <img
                            src={url}
                            alt="Shared image"
                            className="max-w-full rounded-2xl border border-white/10 shadow-sm cursor-pointer hover:opacity-95 transition-all"
                            onClick={() => window.open(url, '_blank')}
                        />
                        {caption && <p className="whitespace-pre-wrap text-sm">{caption}</p>}
                    </div>
                );
            }

            return <p className="whitespace-pre-wrap">{content}</p>;
        };

        return (
            <div className="space-y-1">
                {/* Reply quote block */}
                {replyRef && (
                    <button
                        type="button"
                        onClick={() => scrollToReply(replyRef!)}
                        className="flex items-start gap-1.5 -mx-1 w-full text-left hover:opacity-80 transition-opacity cursor-pointer group/quote"
                        title="Jump to original message"
                    >
                        <div className="w-0.5 bg-white/40 group-hover/quote:bg-white/70 rounded-full self-stretch flex-shrink-0 transition-colors" />
                        <div className="text-xs text-white/60 leading-snug">
                            <span className="font-bold text-white/80">@{replyRef.from}</span><br />
                            <span className="line-clamp-2">{replyRef.txt}</span>
                        </div>
                    </button>
                )}
                {renderBody(text)}
                {/* Edited label */}
                {(msg as any).edited && (
                    <p className="text-[9px] text-white/40 italic">edited</p>
                )}
            </div>
        );
    };

    const handleDecryptMessage = async (msg: Message) => {
        if (!username || !msg.isEncrypted || msg.decrypted) return;

        try {
            const decrypted = await messageService.decryptMessage(username, msg);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, decrypted } : m));
        } catch (error: any) {
            showNotification(`Decryption failed: ${error.message}`, 'error');
        }
    };

    const handleBulkDecrypt = async () => {
        if (!username || !selectedUser) return;
        const encrypted = filteredMessages.filter(m => m.isEncrypted && !m.decrypted);
        if (encrypted.length === 0) {
            showNotification('No messages to unlock.', 'info');
            return;
        }

        showNotification(`Unlocking ${encrypted.length} messages...`, 'info');

        let count = 0;
        for (const msg of encrypted) {
            try {
                const decrypted = await messageService.decryptMessage(username, msg);
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, decrypted } : m));
                count++;
            } catch (error: any) {
                if (error.message?.includes('User denied')) {
                    showNotification('Decryption paused.', 'warning');
                    break;
                }
                console.error('Bulk decryption failed for msg:', msg.id, error);
            }
        }

        if (count > 0) {
            showNotification(`Unlocked ${count} messages!`, 'success');
        }
    };

    const filteredMessages = messages
        .filter(m => m.from === selectedUser || m.to === selectedUser)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (!username) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
                <h2 className="text-2xl font-bold mb-4">Please log in to use DMs</h2>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-160px)] bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden shadow-2xl relative">
            {/* Sidebar */}
            <div className={`w-full md:w-80 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-canvas)]/50 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-[var(--border-color)]">
                    <h2 className="text-xl font-black tracking-tight">Messages</h2>
                </div>
                <div className="p-4 border-b border-[var(--border-color)]">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
                        placeholder="Search users..."
                        className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {searchQuery.length > 0 ? (
                        <div className="py-2">
                            <div className="px-6 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Search Results</div>
                            {searchResults.length === 0 ? (
                                <div className="px-6 py-4 text-sm text-[var(--text-secondary)] italic">No users found.</div>
                            ) : (
                                searchResults.map(user => (
                                    <button
                                        key={user}
                                        onClick={() => { setSelectedUser(user); setSearchQuery(''); }}
                                        className="w-full p-4 flex items-center gap-3 hover:bg-[var(--primary-color)]/5 transition-all"
                                    >
                                        <div className="relative">
                                            <img
                                                src={`https://images.hive.blog/u/${user}/avatar`}
                                                alt={user}
                                                className="w-10 h-10 rounded-xl"
                                            />
                                            {onlineUsers.includes(user) && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[var(--bg-canvas)] rounded-full" title="Online" />
                                            )}
                                        </div>
                                        <span className="font-bold">@{user}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <>
                            {conversations.length === 0 ? (
                                <div className="p-8 text-center text-[var(--text-secondary)] text-sm italic">
                                    No conversations yet.
                                </div>
                            ) : (
                                conversations.map(convo => (
                                    <button
                                        key={convo.otherUser}
                                        onClick={() => setSelectedUser(convo.otherUser)}
                                        className={`w-full p-4 flex items-center gap-3 transition-all hover:bg-[var(--primary-color)]/5 border-l-4 ${selectedUser === convo.otherUser ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10' : 'border-transparent'}`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={`https://images.hive.blog/u/${convo.otherUser}/avatar`}
                                                alt={convo.otherUser}
                                                className="w-12 h-12 rounded-2xl shadow-sm"
                                            />
                                            {onlineUsers.includes(convo.otherUser) && (
                                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" title="Online" />
                                            )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="font-bold text-[var(--text-primary)] truncate">@{convo.otherUser}</div>
                                            <div className="text-xs text-[var(--text-secondary)] truncate">
                                                {convo.lastMessage.from === username ? 'You: ' : ''}
                                                {convo.lastMessage.isEncrypted && !convo.lastMessage.decrypted ? 'Locked Message' : (convo.lastMessage.decrypted || convo.lastMessage.message)}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col bg-[var(--bg-card)] ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {selectedUser ? (
                    <>
                        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)] shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                {/* Mobile Back Button */}
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="md:hidden p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div className="relative">
                                    <img
                                        src={`https://images.hive.blog/u/${selectedUser}/avatar`}
                                        alt={selectedUser}
                                        className="w-10 h-10 rounded-xl"
                                    />
                                    {onlineUsers.includes(selectedUser) && (
                                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" title="Online" />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-lg leading-tight">@{selectedUser}</span>
                                    {!socketService.isConnected ? (
                                        <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider animate-pulse">Connecting...</span>
                                    ) : onlineUsers.includes(selectedUser) ? (
                                        <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</span>
                                    ) : (
                                        <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider opacity-60">Offline</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsSecure(!isSecure)}
                                    className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isSecure
                                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-500'
                                        : 'bg-[var(--bg-canvas)] border-[var(--border-color)] text-[var(--text-secondary)]'
                                        }`}
                                    title={isSecure ? "End-to-end encrypted (Keychain required)" : "Standard chat (Fast, no popups)"}
                                >
                                    {isSecure ? '🔒 Secure' : '🔓 Fast'}
                                </button>
                                <button
                                    onClick={handleBulkDecrypt}
                                    className="px-4 py-2 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-xs font-bold hover:bg-[var(--primary-color)]/5 transition-all flex items-center gap-2"
                                >
                                    🔓 Unlock All
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {filteredMessages.map((msg, i) => (
                                <div
                                    key={msg.mongoId || msg.id || i}
                                    ref={(el) => {
                                        if (el) messageRefs.current.set(i, el);
                                        else messageRefs.current.delete(i);
                                    }}
                                    className={`flex items-end gap-2 group/row ${msg.from === username ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 rounded-2xl ${highlightedKey === String(i) ? 'ring-2 ring-[var(--primary-color)] ring-offset-2 ring-offset-[var(--bg-canvas)] bg-[var(--primary-color)]/5' : ''
                                        }`}
                                >
                                    {/* Message bubble */}
                                    <div
                                        className={`max-w-[85%] md:max-w-[65%] p-4 rounded-3xl shadow-sm transition-all ${msg.from === username
                                            ? 'bg-[#2a3a52] text-white rounded-tr-none'
                                            : 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-none'
                                            }`}
                                    >
                                        {msg.isEncrypted && !msg.decrypted ? (
                                            <button
                                                onClick={() => handleDecryptMessage(msg)}
                                                className="flex items-center gap-2 text-sm font-bold opacity-80 hover:opacity-100 py-1"
                                            >
                                                <span>🔒</span>
                                                Decrypt Message
                                            </button>
                                        ) : (
                                            renderMessageContent(msg)
                                        )}
                                        <span className={`text-[10px] mt-1 block opacity-50 ${msg.from === username ? 'text-right' : 'text-left'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Inline action buttons — in normal flow so they're never clipped by overflow-y:auto */}
                                    <div className="flex flex-col gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0 pb-1">
                                        <button
                                            onClick={() => startReply(msg)}
                                            className="p-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all text-sm leading-none"
                                            title="Reply"
                                        >
                                            ↩
                                        </button>
                                        {msg.from === username && (
                                            <button
                                                onClick={() => startEdit(msg)}
                                                className="p-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all text-sm leading-none"
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />

                            {/* Drag & Drop Overlay */}
                            {isDragging && (
                                <div
                                    onDragOver={onDragOver}
                                    onDragLeave={onDragLeave}
                                    onDrop={onDrop}
                                    className="absolute inset-x-0 bottom-[90px] top-[73px] bg-[var(--primary-color)]/10 backdrop-blur-[2px] border-2 border-dashed border-[var(--primary-color)] z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200"
                                >
                                    <div className="w-20 h-20 bg-[var(--primary-color)] text-white rounded-full flex items-center justify-center shadow-xl animate-bounce">
                                        <Image size={40} />
                                    </div>
                                    <p className="text-xl font-black text-[var(--primary-color)] bg-[var(--bg-card)] px-6 py-2 rounded-full shadow-sm">Drop image to send</p>
                                </div>
                            )}
                        </div>

                        <form
                            onSubmit={handleSendMessage}
                            className="p-3 md:p-6 border-t border-[var(--border-color)] bg-[var(--bg-canvas)]/30 relative"
                            onDragOver={onDragOver}
                        >
                            {/* Reply / Edit context bar */}
                            {(replyingTo || editingMessage) && (
                                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-sm ${editingMessage ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                                    <span className="text-lg">{editingMessage ? '✏️' : '↩'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-xs mb-0.5 opacity-70">
                                            {editingMessage ? 'Editing message' : `Replying to @${replyingTo!.from}`}
                                        </p>
                                        <p className="truncate text-xs opacity-60">
                                            {editingMessage
                                                ? (editingMessage.decrypted || editingMessage.message).slice(0, 60)
                                                : (replyingTo!.decrypted || replyingTo!.message).slice(0, 60)
                                            }
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={cancelReplyOrEdit}
                                        className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] transition-all flex-shrink-0"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                            />

                            {uploadingImage && (
                                <div className="absolute inset-0 bg-[var(--bg-card)]/80 flex items-center justify-center z-20 gap-3">
                                    <Loader2 className="animate-spin text-[var(--primary-color)]" size={24} />
                                    <span className="font-bold text-sm">Uploading your image...</span>
                                </div>
                            )}

                            {pendingImagePreviewUrl ? (
                                /* Image preview + caption stage */
                                <div className="flex flex-col gap-3 p-4 bg-[var(--bg-card)] border-2 border-[var(--border-color)] rounded-2xl">
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={pendingImagePreviewUrl}
                                            alt="Preview"
                                            className="w-20 h-20 object-cover rounded-xl border border-white/10 flex-shrink-0"
                                        />
                                        <div className="flex-1 flex flex-col gap-2">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={imageCaption}
                                                onChange={(e) => setImageCaption(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && sendPendingImage()}
                                                placeholder="Add a caption (optional)..."
                                                className="w-full px-4 py-2 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:border-[var(--primary-color)] transition-all text-sm placeholder:text-[var(--text-secondary)]"
                                                disabled={uploadingImage}
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={discardPendingImage}
                                                    disabled={uploadingImage}
                                                    className="px-4 py-1.5 bg-white/10 text-[var(--text-secondary)] text-xs font-bold rounded-xl hover:bg-white/20 transition-all"
                                                >
                                                    Discard
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={sendPendingImage}
                                                    disabled={uploadingImage}
                                                    className="px-4 py-1.5 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {uploadingImage ? <><Loader2 size={12} className="animate-spin" /> Sending...</> : <><Send size={12} /> Send</>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2 md:gap-4 items-center">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 bg-[var(--bg-card)] border border-2 border-[var(--border-color)] rounded-2xl hover:bg-[var(--primary-color)]/5 transition-all text-[var(--text-secondary)] hover:text-[var(--primary-color)]"
                                        title="Attach image"
                                        disabled={isRecording}
                                    >
                                        <Image size={24} />
                                    </button>
                                    <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                                    <StickerPicker onSelect={sendSticker} />

                                    {isRecording ? (
                                        <div className="flex-1 flex items-center justify-between px-6 py-2 bg-red-500/10 border-2 border-red-500/30 rounded-2xl animate-pulse">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                                <span className="font-mono font-bold text-red-500">
                                                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"
                                            >
                                                <Square size={20} fill="currentColor" />
                                            </button>
                                        </div>
                                    ) : recordedBlobUrl ? (
                                        /* Voice preview stage */
                                        <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-[#2a3a52] border-2 border-blue-500/30 rounded-2xl">
                                            <VoiceNotePlayer src={recordedBlobUrl} />
                                            <div className="flex flex-col gap-1 ml-1 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={sendRecordedAudio}
                                                    disabled={uploadingImage}
                                                    className="px-3 py-1.5 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    <Send size={12} /> Send
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={discardRecording}
                                                    disabled={uploadingImage}
                                                    className="px-3 py-1.5 bg-white/10 text-white/70 text-xs font-bold rounded-xl hover:bg-white/20 active:scale-95 transition-all"
                                                >
                                                    Discard
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            ref={messageInputRef}
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder={editingMessage ? 'Edit your message...' : 'Type a secure message...'}
                                            className="flex-1 px-6 py-3 bg-[var(--bg-card)] border border-2 border-[var(--border-color)] rounded-2xl focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] outline-none transition-all placeholder:text-[var(--text-secondary)]"
                                            disabled={sending || uploadingImage}
                                        />
                                    )}

                                    {!isRecording && !newMessage.trim() ? (
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            disabled={uploadingImage}
                                            className="p-4 bg-[var(--bg-card)] border-2 border-[var(--border-color)] text-[var(--text-secondary)] rounded-2xl hover:bg-[var(--primary-color)]/5 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] transition-all"
                                        >
                                            <Mic size={24} />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={sending || uploadingImage || !newMessage.trim() || !socketService.isConnected}
                                            className="px-8 py-3 bg-[var(--primary-color)] text-white font-bold rounded-2xl shadow-lg hover:shadow-[var(--primary-color)]/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                                            title={!socketService.isConnected ? "Connecting to chat server..." : "Send message"}
                                        >
                                            {sending ? 'Sending...' : 'Send'}
                                            <Send size={18} />
                                        </button>
                                    )}
                                </div>
                            )}
                            <p className="text-[10px] text-[var(--text-secondary)] mt-2 italic text-center">
                                {isSecure
                                    ? "* Secure mode encrypts messages with Hive Memo keys (1 popup per send)."
                                    : "* Fast mode delivers messages instantly without popups."}
                            </p>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-24 h-24 bg-[var(--primary-color)]/10 rounded-full flex items-center justify-center text-4xl mb-6">💬</div>
                        <h2 className="text-2xl font-black mb-2">Your Conversations</h2>
                        <p className="text-[var(--text-secondary)] max-w-sm">Select a user on the left or search for someone to start chatting securely.</p>
                    </div>
                )
                }
            </div >
        </div >
    );
}
