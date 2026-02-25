import React, { useState, useEffect, useRef } from 'react';
import { Image, Loader2, Send, Mic, Square, ArrowLeft, MessageCircle, CircleDashed, PlusCircle, MoreVertical, Plus, X, Search } from 'lucide-react';
import { VoiceNotePlayer } from '../../../components/VoiceNotePlayer';
import { MediaPicker } from '../../../components/MediaPicker';
import { storyService, GroupedStory } from '../../stories/services/storyService';
import { fixWebmDuration } from '../../../utils/fixWebmDuration';
import { StoryCreator } from '../../stories/components/StoryCreator';
import { StoryViewer } from '../../stories/components/StoryViewer';
import { useNotification } from '../../../contexts/NotificationContext';
import { useChat } from '../../../contexts/ChatContext';
import { useSocket } from '../../../contexts/SocketContext';
import { messageService, Message, Conversation } from '../services/messageService';
import { socketService } from '../../../services/socketService';
import { cloudinaryService } from '../../../services/cloudinaryService';

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
    const [activeTab, setActiveTab] = useState<'chats' | 'status'>('chats');
    const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
    const [showStoryCreator, setShowStoryCreator] = useState(false);
    const [selectedStoryGroup, setSelectedStoryGroup] = useState<GroupedStory | null>(null);
    const [showChatMenu, setShowChatMenu] = useState(false);

    const { showNotification } = useNotification();
    const { resetUnreadCount } = useChat();
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const chatMenuRef = useRef<HTMLDivElement>(null);
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
    }, [messages, selectedUser, activeTab]);

    useEffect(() => {
        if (activeTab === 'status') {
            loadStories();
        }

        const handleNewStory = () => {
            if (activeTab === 'status') loadStories();
        };

        socketService.on('new_story', handleNewStory);
        return () => socketService.off('new_story', handleNewStory);
    }, [activeTab]);

    const loadStories = async () => {
        const stories = await storyService.getStories();
        setGroupedStories(stories);
    };

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
            // On mobile, don't auto-select a chat so the list view is shown first
            const isMobile = window.innerWidth < 1024;
            if (!isMobile) {
                setSelectedUser(convos[0].otherUser);
            }
        }
    };

    // Close chat menu on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
                setShowChatMenu(false);
            }
        }
        if (showChatMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showChatMenu]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
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

    const handleNextStoryGroup = () => {
        if (!selectedStoryGroup) return;
        const currentIndex = groupedStories.findIndex(g => g.username === selectedStoryGroup.username);
        if (currentIndex < groupedStories.length - 1) {
            setSelectedStoryGroup(groupedStories[currentIndex + 1]);
        } else {
            setSelectedStoryGroup(null);
        }
    };

    const handlePrevStoryGroup = () => {
        if (!selectedStoryGroup) return;
        const currentIndex = groupedStories.findIndex(g => g.username === selectedStoryGroup.username);
        if (currentIndex > 0) {
            setSelectedStoryGroup(groupedStories[currentIndex - 1]);
        }
    };

    if (!username) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
                <h2 className="text-2xl font-bold mb-4">Please log in to use DMs</h2>
            </div>
        );
    }

    return (
        <div className={`flex flex-col md:flex-row h-[calc(100dvh-64px)] fixed inset-x-0 bottom-0 top-16 md:left-0 md:right-0 bg-[var(--bg-canvas)] md:bg-[var(--bg-card)] ${selectedStoryGroup ? 'z-[100] !top-0 !h-screen' : 'z-40'}`}>
            {/* 1. Vertical Nav (WhatsApp style) */}
            <div className="hidden md:flex w-20 flex-col items-center py-8 gap-8 bg-[var(--bg-canvas)] border-r border-[var(--border-color)]">
                <button
                    onClick={() => setActiveTab('chats')}
                    className={`p-3 rounded-2xl transition-all ${activeTab === 'chats' ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--primary-color)]/10 hover:text-[var(--primary-color)]'}`}
                    title="Messages"
                >
                    <MessageCircle size={28} />
                </button>
                <button
                    onClick={() => setActiveTab('status')}
                    className={`p-3 rounded-2xl transition-all ${activeTab === 'status' ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--primary-color)]/10 hover:text-[var(--primary-color)]'}`}
                    title="Status"
                >
                    <CircleDashed size={28} />
                </button>

                <div className="mt-auto">
                    <button
                        onClick={() => setShowStoryCreator(true)}
                        className="p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--primary-color)] hover:brightness-110 shadow-sm transition-all"
                        title="Post Status"
                    >
                        <PlusCircle size={28} />
                    </button>
                </div>
            </div>

            {/* 2. Sidebar Area (Chats or Status) */}
            <div className={`w-full md:w-[320px] md:flex-none border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-canvas)]/50 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {/* Mobile Tab Switcher */}
                <div className="flex md:hidden bg-[var(--bg-card)] border-b border-[var(--border-color)] z-10">
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest transition-all border-b-2 ${activeTab === 'chats' ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-[var(--text-secondary)] opacity-60'}`}
                    >
                        <MessageCircle size={16} />
                        CHATS
                    </button>
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest transition-all border-b-2 ${activeTab === 'status' ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-[var(--text-secondary)] opacity-60'}`}
                    >
                        <CircleDashed size={16} />
                        STATUS
                    </button>
                </div>

                {activeTab === 'chats' ? (
                    <>
                        <div className="hidden md:flex p-6 justify-between items-center">
                            <h2 className="text-2xl font-bold">Chats</h2>
                            <button className="p-2 hover:bg-[var(--primary-color)]/10 rounded-full text-[var(--text-secondary)]">
                                <PlusCircle size={20} />
                            </button>
                        </div>
                        <div className="px-4 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
                                    placeholder="Search"
                                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border-none rounded-full text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all"
                                />
                            </div>
                        </div>
                        {/* WhatsApp-style Filter Tabs */}
                        <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none">
                            {['All', 'Unread', 'Favorites', 'Groups'].map((tab) => (
                                <button
                                    key={tab}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${(tab === 'All' && searchQuery === '')
                                        ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]'
                                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/80'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
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
                                                className="relative group w-full p-4 flex items-center gap-3 hover:bg-[var(--primary-color)]/5 transition-all"
                                            >
                                                {/* Selection Indicator */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--primary-color)] opacity-0 group-hover:opacity-30 transition-opacity" />

                                                <div className="relative">
                                                    <img
                                                        src={`https://images.hive.blog/u/${user}/avatar`}
                                                        alt={user}
                                                        className="w-12 h-12 rounded-full object-cover"
                                                    />
                                                    {onlineUsers.includes(user) && (
                                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--bg-canvas)] rounded-full" title="Online" />
                                                    )}
                                                </div>
                                                <div className="text-left font-bold text-[var(--text-primary)]">@{user}</div>
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
                                                className={`relative group w-full p-4 flex items-center gap-3 transition-all hover:bg-[var(--primary-color)]/5 ${selectedUser === convo.otherUser ? 'bg-[var(--primary-color)]/10' : ''}`}
                                            >
                                                {/* Selection Indicator */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-[var(--primary-color)] transition-opacity ${selectedUser === convo.otherUser ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'}`} />

                                                <div className="relative">
                                                    <img
                                                        src={`https://images.hive.blog/u/${convo.otherUser}/avatar`}
                                                        alt={convo.otherUser}
                                                        className="w-12 h-12 rounded-full shadow-sm object-cover"
                                                    />
                                                    {onlineUsers.includes(convo.otherUser) && (
                                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" title="Online" />
                                                    )}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <span className="font-bold text-[var(--text-primary)] truncate">@{convo.otherUser}</span>
                                                        <span className="text-[10px] text-[var(--text-secondary)]">
                                                            {new Date(convo.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
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
                    </>
                ) : (
                    // STATUS SIDEBAR
                    <div className="flex-1 flex flex-col bg-[var(--bg-card)] relative overflow-hidden">
                        <div className="hidden md:block p-6 border-b border-[var(--border-color)]">
                            <h2 className="text-xl font-black tracking-tight">Status</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {/* My Status Item */}
                            {(() => {
                                const myGroup = groupedStories.find(g => g.username === username);
                                const otherStories = groupedStories.filter(g => g.username !== username);

                                return (
                                    <>
                                        <div
                                            className="w-full p-4 flex items-center gap-4 hover:bg-[var(--primary-color)]/5 transition-all border-b border-[var(--border-color)]/30 group"
                                        >
                                            <button
                                                onClick={() => myGroup ? setSelectedStoryGroup(myGroup) : setShowStoryCreator(true)}
                                                className="relative"
                                            >
                                                <img
                                                    src={`https://images.hive.blog/u/${username}/avatar`}
                                                    alt="My Status"
                                                    className={`w-14 h-14 rounded-full p-0.5 border-2 ${myGroup ? 'border-[var(--primary-color)]' : 'border-dashed border-[var(--text-secondary)]/30'}`}
                                                />
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setShowStoryCreator(true); }}
                                                    className="absolute bottom-0 right-0 w-5 h-5 bg-[var(--primary-color)] text-white rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] text-xs font-bold hover:scale-110 transition-transform"
                                                >
                                                    +
                                                </div>
                                            </button>
                                            <div
                                                onClick={() => myGroup ? setSelectedStoryGroup(myGroup) : setShowStoryCreator(true)}
                                                className="flex-1 flex-col text-left cursor-pointer"
                                            >
                                                <div className="font-bold text-[var(--text-primary)] text-base">My Status</div>
                                                <div className="text-xs text-[var(--text-secondary)]">
                                                    {myGroup ? 'Tap to view your stories' : 'Tap to add status update'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest bg-[var(--bg-canvas)]/30">Recent Updates</div>

                                        {otherStories.length === 0 ? (
                                            <div className="p-8 text-center text-[var(--text-secondary)] text-sm italic">
                                                No status updates available.
                                            </div>
                                        ) : (
                                            otherStories.map(group => (
                                                <button
                                                    key={group.username}
                                                    onClick={() => setSelectedStoryGroup(group)}
                                                    className="w-full p-4 flex items-center gap-4 hover:bg-[var(--primary-color)]/5 transition-all"
                                                >
                                                    <div className="relative">
                                                        <div className="w-14 h-14 rounded-full border-2 border-[var(--primary-color)] p-0.5">
                                                            <img
                                                                src={`https://images.hive.blog/u/${group.username}/avatar`}
                                                                alt={group.username}
                                                                className="w-full h-full rounded-full object-cover"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <div className="font-bold text-[var(--text-primary)] truncate">@{group.username}</div>
                                                        <div className="text-xs text-[var(--text-secondary)]">
                                                            {new Date(group.stories[group.stories.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Mobile Floating Action Button for Status */}
                        <button
                            onClick={() => setShowStoryCreator(true)}
                            className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-[var(--primary-color)] text-white rounded-full shadow-2xl flex items-center justify-center z-20 hover:scale-110 active:scale-95 transition-all ring-4 ring-[var(--bg-card)]"
                        >
                            <PlusCircle size={28} />
                        </button>
                    </div>
                )}
            </div>

            {/* 3. Main Content Area */}
            <div className={`flex-1 flex flex-col bg-[var(--bg-card)] h-full overflow-hidden ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {activeTab === 'chats' ? (
                    selectedUser ? (
                        <>
                            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)]/95 backdrop-blur-md shadow-sm z-30 sticky top-0">
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
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        {onlineUsers.includes(selectedUser) && (
                                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" title="Online" />
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black text-lg leading-tight truncate max-w-[120px] md:max-w-none">@{selectedUser}</span>
                                        {!socketService.isConnected ? (
                                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider animate-pulse">Connecting...</span>
                                        ) : onlineUsers.includes(selectedUser) ? (
                                            <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</span>
                                        ) : (
                                            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider opacity-60">Offline</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 relative">
                                    {/* Desktop Actions */}
                                    <div className="hidden md:flex items-center gap-2">
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

                                    {/* Mobile Actions (3-dots menu) */}
                                    <div className="md:hidden relative" ref={chatMenuRef}>
                                        <button
                                            onClick={() => setShowChatMenu(!showChatMenu)}
                                            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--primary-color)]/10 rounded-xl transition-all"
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        {showChatMenu && (
                                            <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <button
                                                    onClick={() => { setIsSecure(!isSecure); setShowChatMenu(false); }}
                                                    className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-[var(--primary-color)]/5 flex items-center gap-3"
                                                >
                                                    {isSecure ? '🔓 Switch to Fast' : '🔒 Switch to Secure'}
                                                </button>
                                                <button
                                                    onClick={() => { handleBulkDecrypt(); setShowChatMenu(false); }}
                                                    className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-[var(--primary-color)]/5 flex items-center gap-3 border-t border-[var(--border-color)]/50"
                                                >
                                                    🔓 Unlock All
                                                </button>
                                            </div>
                                        )}
                                    </div>
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
                                className="px-1 py-1.5 md:p-2 bg-[var(--bg-canvas)]/30 relative"
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
                                    <div className="flex flex-col gap-3 p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
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
                                    <div className="flex items-end gap-1.5 md:gap-3 bg-[var(--bg-canvas)]/50 py-1.5 md:py-2 px-1 md:px-3 rounded-[24px] md:rounded-[32px]">
                                        {/* 1. Left Attach Button */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 md:p-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex-shrink-0"
                                            title="Attach content"
                                            disabled={isRecording}
                                        >
                                            <Plus size={28} />
                                        </button>

                                        {isRecording ? (
                                            <div className="flex-1 flex items-center justify-between px-3 md:px-6 py-2 bg-red-500/10 border border-red-500/30 rounded-full animate-pulse min-w-0">
                                                <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                                                    <span className="font-mono font-bold text-red-500 text-sm md:text-base">
                                                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={stopRecording}
                                                    className="p-1.5 md:p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all flex-shrink-0"
                                                >
                                                    <Square className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" />
                                                </button>
                                            </div>
                                        ) : recordedBlobUrl ? (
                                            /* Voice preview stage */
                                            <div className="flex-1 flex items-center gap-2 px-2 py-1 bg-[#2a3a52] border border-blue-500/30 rounded-full min-w-0">
                                                <div className="flex-1 min-w-0">
                                                    <VoiceNotePlayer src={recordedBlobUrl} />
                                                </div>
                                                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={sendRecordedAudio}
                                                        disabled={uploadingImage}
                                                        className="p-2 bg-[var(--primary-color)] text-white rounded-full hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                                        title="Send audio"
                                                    >
                                                        <Send size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={discardRecording}
                                                        disabled={uploadingImage}
                                                        className="p-2 bg-white/10 text-white/70 rounded-full hover:bg-white/20 active:scale-95 transition-all"
                                                        title="Discard"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 relative flex items-center">
                                                <textarea
                                                    ref={messageInputRef}
                                                    rows={1}
                                                    value={newMessage}
                                                    onChange={(e) => {
                                                        setNewMessage(e.target.value);
                                                        // Auto-expand logic
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSendMessage();
                                                            // Reset height
                                                            if (messageInputRef.current) {
                                                                messageInputRef.current.style.height = 'auto';
                                                            }
                                                        }
                                                    }}
                                                    placeholder={editingMessage ? 'Edit message...' : 'Message...'}
                                                    className="w-full pl-4 md:pl-6 pr-12 py-1.5 md:py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[20px] focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all placeholder:text-[var(--text-secondary)] text-sm md:text-base font-medium resize-none overflow-y-auto scrollbar-hide leading-tight"
                                                    disabled={sending || uploadingImage}
                                                    style={{ height: 'auto', minHeight: '36px', maxHeight: '120px' }}
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                    <MediaPicker
                                                        onEmojiSelect={(emoji) => {
                                                            setNewMessage(prev => prev + emoji);
                                                            // Focus and trigger height update
                                                            setTimeout(() => {
                                                                if (messageInputRef.current) {
                                                                    messageInputRef.current.focus();
                                                                    messageInputRef.current.style.height = 'auto';
                                                                    messageInputRef.current.style.height = `${Math.min(messageInputRef.current.scrollHeight, 120)}px`;
                                                                }
                                                            }, 0);
                                                        }}
                                                        onStickerSelect={sendSticker}
                                                        isOpen={showMediaPicker}
                                                        onToggle={() => setShowMediaPicker(!showMediaPicker)}
                                                        onClose={() => setShowMediaPicker(false)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {!isRecording && !newMessage.trim() && !recordedBlobUrl ? (
                                            <button
                                                type="button"
                                                onClick={startRecording}
                                                disabled={uploadingImage}
                                                className="p-3 md:p-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex-shrink-0"
                                            >
                                                <Mic size={20} className="md:w-6 md:h-6" />
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={sending || uploadingImage || (!newMessage.trim() && !recordedBlobUrl) || !socketService.isConnected}
                                                className="p-3 md:p-4 text-[var(--primary-color)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center flex-shrink-0"
                                                title={!socketService.isConnected ? "Connecting..." : "Send"}
                                            >
                                                <Send size={20} className="md:w-6 md:h-6" />
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
                        <div className="flex-1 hidden md:flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-canvas)]/30">
                            <div className="w-24 h-24 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full flex items-center justify-center mb-6">
                                <MessageCircle size={48} />
                            </div>
                            <h3 className="text-2xl font-black mb-2">Your Conversations</h3>
                            <p className="text-[var(--text-secondary)] max-w-sm">Select a friend from the left to start chatting or sharing files securely.</p>
                        </div>
                    )
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-canvas)]/30">
                        <div className="w-24 h-24 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full flex items-center justify-center mb-6">
                            <CircleDashed size={48} />
                        </div>
                        <h3 className="text-2xl font-black mb-2">Status Updates</h3>
                        <p className="text-[var(--text-secondary)] max-w-sm mb-6">View status updates from your community members or post your own.</p>
                        <button
                            onClick={() => setShowStoryCreator(true)}
                            className="px-6 py-3 bg-[var(--primary-color)] text-white rounded-2xl font-bold shadow-lg hover:brightness-110 transition-all"
                        >
                            Post Your Update
                        </button>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showStoryCreator && (
                <StoryCreator
                    onClose={() => setShowStoryCreator(false)}
                    onSuccess={() => { setShowStoryCreator(false); loadStories(); }}
                />
            )}
            {selectedStoryGroup && (
                <StoryViewer
                    key={selectedStoryGroup.username}
                    group={selectedStoryGroup}
                    onClose={() => setSelectedStoryGroup(null)}
                    onNext={handleNextStoryGroup}
                    onPrev={handlePrevStoryGroup}
                />
            )}
        </div>
    );
}
