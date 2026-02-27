import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, Image, Loader2, Send, Mic, Square, ArrowLeft, MessageCircle, CircleDashed, PlusCircle, MoreVertical, Plus, X, Search, ShieldCheck, Zap, Trash2, Shield, Reply, Smile, Pencil, Volume2, RefreshCw, Bot, Sparkles } from 'lucide-react';
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
import { speechService } from '../services/speechService';
import { aiService } from '../../../services/aiService';

const CodeBlock = ({ code, language }: { code: string; language: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group/code my-4 rounded-xl overflow-hidden bg-[#0f172a] border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{language}</span>
                <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                    title="Copy code"
                >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span className="text-[10px] font-bold">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <pre className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                <code className="text-xs md:text-sm text-blue-100/90 font-mono leading-relaxed">
                    {code}
                </code>
            </pre>
        </div>
    );
};

const SpeakButton = ({ text }: { text: string }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const handleSpeak = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSpeaking) {
            speechService.stop();
            setIsSpeaking(false);
        } else {
            speechService.speak(text, () => setIsSpeaking(false));
            setIsSpeaking(true);
        }
    };

    return (
        <button
            onClick={handleSpeak}
            className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${isSpeaking ? 'bg-[var(--primary-color)] text-white shadow-lg scale-110' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
            title={isSpeaking ? "Stop speaking" : "Speak message"}
        >
            <Volume2 size={14} className={isSpeaking ? "animate-pulse" : ""} />
        </button>
    );
};

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
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedBlob, setRecordedBlob] = useState<File | null>(null);
    const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
    const [selectedImageForLightbox, setSelectedImageForLightbox] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'chats' | 'status'>('chats');
    const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
    const [showStoryCreator, setShowStoryCreator] = useState(false);
    const [selectedStoryGroup, setSelectedStoryGroup] = useState<GroupedStory | null>(null);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [initialStoryId, setInitialStoryId] = useState<string | undefined>(undefined);
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
    const [showUserInfo, setShowUserInfo] = useState(false);
    const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
    const [loadingUserDetails, setLoadingUserDetails] = useState(false);
    const [showHeaderActions, setShowHeaderActions] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [isAiTyping, setIsAiTyping] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

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

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

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
                    // 1. Deduplicate by exact ID
                    if (prev.some(m => m.id === msg.id)) return prev;

                    if (msg.from === username) {
                        // 2. Try to match an optimistic message waiting for a real ID
                        const existingTempIndex = prev.findIndex(m =>
                            m.id?.startsWith('temp-') &&
                            // Either exactly matches or matches decrypted content if we set it
                            (m.message === msg.message || m.message === msg.decrypted) &&
                            // Extent timeout to 120s (120000ms) for media messages which might take a long time to upload
                            Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 120000
                        );

                        if (existingTempIndex !== -1) {
                            const updated = [...prev];
                            // Replace the temp message with the actual message, preserving localUrl
                            updated[existingTempIndex] = { ...msg, localUrl: updated[existingTempIndex].localUrl };

                            const convos = messageService.getConversations(updated, username!).filter(c => c.otherUser !== username);
                            setConversations(convos);
                            resetUnreadCount();

                            return updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        }

                        // 3. Fallback: drop it if we already have an identical non-temp message recently (15s for regular text)
                        if (prev.some(m => m.message === msg.message && Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 15000)) return prev;
                    }

                    const newMessages = [...prev, msg].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    // Update conversations too
                    const convos = messageService.getConversations(newMessages, username!).filter(c => c.otherUser !== username);
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
        setLoadingMessages(true);
        try {
            const history = await messageService.getMessageHistory(username);
            setMessages(history);

            let convos = messageService.getConversations(history, username).filter(c => c.otherUser !== username);

            // Inject AI Guide at the top if not already present
            if (!convos.some(c => c.otherUser === '@hive_guide')) {
                convos = [{
                    otherUser: '@hive_guide',
                    lastMessage: {
                        from: '@hive_guide',
                        to: username,
                        message: "Hello! I'm your Hive Guide. Ask me anything about the Hive blockchain!",
                        timestamp: new Date().toISOString(),
                        isEncrypted: false
                    },
                    unreadCount: 0
                }, ...convos];
            }

            setConversations(convos);
            if (convos.length > 0 && !selectedUser) {
                // On mobile, don't auto-select a chat so the list view is shown first
                const isMobile = window.innerWidth < 1024;
                if (!isMobile) {
                    setSelectedUser(convos[0].otherUser);
                }
            }
        } finally {
            setLoadingMessages(false);
        }
    };

    const loadUserDetails = async (targetUser: string) => {
        setLoadingUserDetails(true);
        try {
            const profile = await messageService.getUserProfile(targetUser);
            setSelectedUserDetails(profile);
        } catch (error) {
            console.error('Failed to load user details:', error);
        } finally {
            setLoadingUserDetails(false);
        }
    };

    useEffect(() => {
        if (selectedUser) {
            loadUserDetails(selectedUser);
            setShowUserInfo(false); // Reset when switching chats
        } else {
            setSelectedUserDetails(null);
            setShowUserInfo(false);
        }

        // Stop any ongoing AI speech when switching users or starting new work
        speechService.stop();

        return () => speechService.stop();
    }, [selectedUser]);

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
        if (!username || !selectedUser) return;

        // Special handling for Pending Media (Optimistic Flow)
        if (pendingImageFile) {
            await sendPendingImage();
            return;
        }

        if (recordedBlob) {
            await sendRecordedAudio();
            return;
        }

        if (!newMessage.trim()) return;

        if (username === selectedUser) {
            showNotification("You cannot message yourself.", "warning");
            return;
        }

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
                const refText = (replyingTo.decrypted || replyingTo.message || '').slice(0, 80);
                const envelope = { _r: { from: replyingTo.from, txt: refText }, _t: payload };
                payload = JSON.stringify(envelope);
            }

            // Encrypt if needed
            let finalMessage = payload;
            if (isSecure && selectedUser !== '@hive_guide') {
                showNotification('Waiting for Keychain encryption...', 'info');
                finalMessage = await messageService.encryptMessage(username, selectedUser, payload);
            }

            // Handle AI Guide Interception
            if (selectedUser === '@hive_guide') {
                // Add user message to UI immediately
                const userMsg: Message = {
                    from: username,
                    to: '@hive_guide',
                    message: payload,
                    timestamp: new Date().toISOString(),
                    isEncrypted: false,
                    id: 'temp-' + Date.now()
                };
                setMessages(prev => [...prev, userMsg]);
                setNewMessage('');

                // Save user message to database
                messageService.saveMessage({
                    from: username,
                    to: '@hive_guide',
                    message: payload,
                    timestamp: userMsg.timestamp
                }).catch(err => console.error('Failed to persist user query:', err));

                // Simulate AI Thinking
                setIsAiTyping(true);
                setAiSuggestions([]);

                try {
                    const aiRes = await aiService.ask(payload);

                    // Add AI response to UI
                    const aiMsg: Message = {
                        from: '@hive_guide',
                        to: username,
                        message: aiRes.message,
                        timestamp: new Date().toISOString(),
                        isEncrypted: false,
                        id: 'ai-' + Date.now()
                    };

                    setMessages(prev => [...prev, aiMsg]);

                    // Save AI response to database
                    messageService.saveMessage({
                        from: '@hive_guide',
                        to: username,
                        message: aiRes.message,
                        timestamp: aiMsg.timestamp
                    }).catch(err => console.error('Failed to persist AI response:', err));

                    if (aiRes.suggestions) {
                        setAiSuggestions(aiRes.suggestions);
                    }
                } catch (error) {
                    console.error('AI Guide error:', error);
                    showNotification('AI Guide encountered an error. Please try again.', 'error');
                } finally {
                    setIsAiTyping(false);
                }
                return;
            }

            // Send Message (Normal flow)
            await messageService.sendMessage(username, selectedUser, finalMessage);
            setNewMessage('');
            setReplyingTo(null);

            // Focus back on input
            messageInputRef.current?.focus();
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
    };

    const sendPendingImage = async () => {
        if (!pendingImageFile || !username || !selectedUser) return;

        const caption = newMessage.trim();
        const localUrl = pendingImagePreviewUrl!;
        const tempId = `temp-${Date.now()}`;

        // 1. Add Optimistic Message
        const tempMsg: Message = {
            from: username,
            to: selectedUser,
            message: caption ? `[IMAGE]${localUrl}\n${caption}` : `[IMAGE]${localUrl}`,
            timestamp: new Date().toISOString(),
            isEncrypted: false,
            localUrl: localUrl,
            status: 'uploading',
            caption: caption,
            id: tempId
        };

        setMessages(prev => [...prev, tempMsg]);

        // Clear UI input state but DO NOT revoke the ObjectURL yet (so the chat bubble can render it)
        setPendingImageFile(null);
        setPendingImagePreviewUrl(null);
        setNewMessage('');

        try {
            // 2. Upload to Cloudinary
            const imageUrl = await cloudinaryService.uploadFile(pendingImageFile, 'image');
            const combined = caption ? `[IMAGE]${imageUrl}\n${caption}` : `[IMAGE]${imageUrl}`;

            let finalMessage = combined;
            if (isSecure) {
                finalMessage = await messageService.encryptMessage(username, selectedUser, combined);
            }

            // 3. Update the optimistic message so deduplication handles the socket echo
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent', message: finalMessage, decrypted: combined } : m));

            // 4. Send via Message Service
            await messageService.sendMessage(username, selectedUser, finalMessage);

        } catch (error: any) {
            showNotification(`Upload failed: ${error.message}`, 'error');
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        }
    };

    const discardPendingImage = () => {
        if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
        setPendingImageFile(null);
        setPendingImagePreviewUrl(null);
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
        handleAudioUpload(recordedBlob); // Don't await here, so UI returns instantly
    };

    const discardRecording = () => {
        if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlob(null);
        setRecordedBlobUrl(null);
        setRecordingTime(0);
    };

    const handleAudioUpload = async (file: File) => {
        if (!username || !selectedUser) return;

        const localUrl = URL.createObjectURL(file);
        const tempId = `temp-${Date.now()}`;

        // 1. Add Optimistic Message
        const tempMsg: Message = {
            from: username,
            to: selectedUser,
            message: `[AUDIO]${localUrl}`,
            timestamp: new Date().toISOString(),
            isEncrypted: false,
            localUrl: localUrl,
            status: 'uploading',
            id: tempId
        };
        setMessages(prev => [...prev, tempMsg]);
        discardRecording(); // Clear UI immediately before upload blocks!

        try {
            const audioUrl = await cloudinaryService.uploadFile(file, 'video');
            const combined = `[AUDIO]${audioUrl}`;

            let finalMessage = combined;
            if (isSecure) {
                finalMessage = await messageService.encryptMessage(username, selectedUser, combined);
            }

            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent', message: finalMessage, decrypted: combined } : m));
            await messageService.sendMessage(username, selectedUser, finalMessage);

            // --- AI Listening Logic ---
            if (selectedUser === '@hive_guide') {
                setIsAiTyping(true);
                try {
                    // Convert audio file to Base64 for Gemini multimodal processing
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onloadend = async () => {
                        const base64Audio = (reader.result as string).split(',')[1];

                        const aiResponse = await aiService.ask("Please listen to this voice note and respond.", base64Audio);

                        const aiMsg: Message = {
                            from: '@hive_guide',
                            to: username,
                            message: aiResponse.message,
                            timestamp: new Date().toISOString(),
                            isEncrypted: false,
                            id: `ai-${Date.now()}`
                        };

                        setMessages(prev => [...prev, aiMsg]);
                        messageService.saveMessage(aiMsg);
                        setIsAiTyping(false);
                        if (aiResponse.suggestions) setAiSuggestions(aiResponse.suggestions);
                    };
                } catch (aiErr) {
                    console.error('AI Listening failed:', aiErr);
                    setIsAiTyping(false);
                }
            }
        } catch (error: any) {
            showNotification(`Upload failed: ${error.message}`, 'error');
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        }
    };

    const retryMediaUpload = async (msg: Message) => {
        if (!username || !selectedUser || !msg.localUrl) return;

        try {
            // Set back to uploading
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'uploading' } : m));

            // Fetch the original file from the local blob URL
            const response = await fetch(msg.localUrl);
            const blob = await response.blob();

            // Determine type and create File
            const isAudio = msg.message.includes('[AUDIO]');
            const type = isAudio ? 'video' : 'image'; // cloudinaryService uses 'video' for audio
            const file = new File([blob], `retry-${Date.now()}.${isAudio ? 'webm' : 'jpg'}`, { type: blob.type });

            // Upload
            const uploadedUrl = await cloudinaryService.uploadFile(file, type);
            const combined = isAudio ? `[AUDIO]${uploadedUrl}` : (msg.caption ? `[IMAGE]${uploadedUrl}\n${msg.caption}` : `[IMAGE]${uploadedUrl}`);

            let finalMessage = combined;
            if (isSecure) {
                finalMessage = await messageService.encryptMessage(username, selectedUser, combined);
            }

            // Update UI and send
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent', message: finalMessage, decrypted: combined } : m));
            await messageService.sendMessage(username, selectedUser, finalMessage);

        } catch (error: any) {
            showNotification(`Retry failed: ${error.message}`, 'error');
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'failed' } : m));
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

    const formatMessagePreview = (msg: Message) => {
        if (msg.isEncrypted && !msg.decrypted) return <span className="flex items-center gap-1"><Shield size={12} /> Locked Message</span>;
        const raw = msg.decrypted || msg.message;

        const isAudio = raw.includes('[AUDIO]') || /\/video\/upload\//.test(raw) || /\.(mp3|wav|ogg|webm)(\?|$)/i.test(raw);
        const isImage = raw.includes('[IMAGE]') || /\/image\/upload\//.test(raw) || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(raw);

        if (isAudio) return <span className="flex items-center gap-1 text-[var(--primary-color)]"><Volume2 size={12} /> Audio</span>;

        if (isImage) {
            const urlMatch = raw.match(/(blob:https?:\/\/[\S]+|https?:\/\/[\S]+)/i);
            const url = urlMatch ? urlMatch[0] : '';
            const caption = raw.replace(url, '').replace('[IMAGE]', '').trim();
            return (
                <span className="flex items-center gap-1">
                    <span className="flex items-center gap-1 text-[var(--primary-color)] shrink-0"><Image size={12} /> Image</span>
                    {caption && <span className="truncate opacity-75"> - {caption}</span>}
                </span>
            );
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed._t) return parsed._t;
        } catch { }
        return raw;
    };

    const hasMedia = (msg: Message) => {
        const raw = msg.decrypted || msg.message;
        const isAudio = raw.includes('[AUDIO]') || /\/video\/upload\//.test(raw) || /\.(mp3|wav|ogg|webm)(\?|$)/i.test(raw);
        const isImage = raw.includes('[IMAGE]') || /\/image\/upload\//.test(raw) || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(raw);
        const isGiphy = /giphy\.gif/.test(raw);
        return isAudio || isImage || isGiphy;
    };

    const renderMessageContent = (msg: Message) => {
        const raw = msg.decrypted || msg.message;

        // Check for envelope: {"_r":...} (reply) or {"_s":...} (story)
        let replyRef: { from: string; txt: string } | null = null;
        let text = raw;
        try {
            const parsed = JSON.parse(raw);
            // 1. Check for standard reply envelope
            if (parsed._r && parsed._t) {
                replyRef = parsed._r;
                text = parsed._t;
            }
            // 2. Check for story reference envelope
            else if (parsed._s && parsed._t) {
                text = parsed._t;
            }
        } catch { }

        const renderBody = (content: string, msgId: string) => {
            const threshold = 450;
            const isExpanded = expandedMessages.has(msgId);
            const shouldTruncate = content.length > threshold && !isExpanded;
            const displayContent = shouldTruncate ? content.substring(0, threshold) : content;

            // Step 1: extract the first URL from the message (on the possibly truncated content)
            const urlMatch = displayContent.match(/(blob:https?:\/\/[^\s]+|https?:\/\/[^\s]+)/i);

            const TruncateToggle = () => shouldTruncate ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpandedMessages(prev => new Set(prev).add(msgId));
                    }}
                    className="text-[var(--primary-color)] font-bold text-xs mt-1 block hover:underline"
                >
                    Read more
                </button>
            ) : null;

            if (!urlMatch) {
                return (
                    <div className="relative markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeText = String(children).replace(/\n$/, '');

                                    if (!inline && match) {
                                        return <CodeBlock code={codeText} language={match[1]} />;
                                    }
                                    return (
                                        <code className={`${className} bg-[var(--bg-canvas)]/50 px-1 rounded text-sm`} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline break-all">{children}</a>,
                                ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>
                            }}
                        >
                            {displayContent}
                        </ReactMarkdown>
                        {shouldTruncate && <span className="text-[var(--text-secondary)]">...</span>}
                        <TruncateToggle />
                    </div>
                );
            }

            const url = urlMatch[0];
            const cleanContent = displayContent.replace(url, '').replace('[IMAGE]', '').replace('[AUDIO]', '').trim();

            const isAudio = displayContent.includes('[AUDIO]') || /\/video\/upload\//.test(url) || /\.(mp3|wav|ogg|webm)(\?|$)/i.test(url);
            const isImage = displayContent.includes('[IMAGE]') || /\/image\/upload\//.test(url) || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);

            const TextBody = () => cleanContent ? (
                <div className="markdown-content mb-3">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                            code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeText = String(children).replace(/\n$/, '');

                                if (!inline && match) {
                                    return <CodeBlock code={codeText} language={match[1]} />;
                                }
                                return (
                                    <code className={`${className} bg-[var(--bg-canvas)]/50 px-1 rounded text-sm`} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline break-all">{children}</a>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>
                        }}
                    >
                        {cleanContent}
                    </ReactMarkdown>
                </div>
            ) : null;

            if (isAudio) {
                return (
                    <div className="relative inline-block w-full min-w-[220px]">
                        <TextBody />
                        <div className={`transition-all ${msg.status === 'uploading' ? 'opacity-60 pointer-events-none' : ''} ${msg.status === 'failed' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <VoiceNotePlayer src={url} />
                        </div>
                        {msg.status === 'uploading' && (
                            <div className="absolute top-1/2 left-1.5 -translate-y-1/2 flex items-center justify-center z-10 pointer-events-none w-8 h-8 bg-black/60 rounded-full backdrop-blur-md shadow-lg border border-white/10">
                                <Loader2 size={16} className="text-white animate-spin" />
                            </div>
                        )}
                        {msg.status === 'failed' && msg.localUrl && msg.from === username && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                <button onClick={() => retryMediaUpload(msg)} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] text-[var(--text-primary)] p-2 text-xs rounded-full flex items-center gap-2 backdrop-blur-sm transition-all shadow-xl font-bold">
                                    <RefreshCw size={14} /> Retry
                                </button>
                            </div>
                        )}
                    </div>
                );
            }

            if (isImage) {
                return (
                    <div className="space-y-2 relative group">
                        <div className="relative overflow-hidden rounded-2xl">
                            <img
                                src={msg.localUrl || url}
                                alt="Shared image"
                                className={`max-w-[260px] md:max-w-sm max-h-[350px] object-cover border border-white/10 shadow-sm transition-all ${msg.status === 'uploading' ? 'opacity-80 brightness-75' : 'hover:opacity-95 cursor-pointer'} ${msg.status === 'failed' ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                                onClick={() => {
                                    if (msg.status === 'uploading' || msg.status === 'failed') return;
                                    setSelectedImageForLightbox(msg.localUrl || url);
                                }}
                            />
                            {msg.status === 'uploading' && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <div className="bg-black/50 p-3 rounded-full backdrop-blur-md shadow-lg border border-white/10">
                                        <Loader2 size={24} className="text-white animate-spin" />
                                    </div>
                                </div>
                            )}
                            {msg.status === 'failed' && msg.localUrl && msg.from === username && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-[2px]">
                                    <button onClick={() => retryMediaUpload(msg)} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] text-[var(--text-primary)] px-4 py-2 font-bold text-sm rounded-full flex items-center gap-2 backdrop-blur-sm transition-colors shadow-2xl">
                                        <RefreshCw size={16} /> Retry Upload
                                    </button>
                                </div>
                            )}
                        </div>
                        <TextBody />
                        <TruncateToggle />
                    </div>
                );
            }

            return (
                <div className="relative markdown-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                            code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeText = String(children).replace(/\n$/, '');

                                if (!inline && match) {
                                    return <CodeBlock code={codeText} language={match[1]} />;
                                }
                                return (
                                    <code className={`${className} bg-[var(--bg-canvas)]/50 px-1 rounded text-sm`} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline break-all">{children}</a>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>
                        }}
                    >
                        {displayContent}
                    </ReactMarkdown>
                    {shouldTruncate && <span className="text-[var(--text-secondary)]">...</span>}
                    <TruncateToggle />
                </div>
            );
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
                            <span className="line-clamp-2 break-all">{replyRef.txt}</span>
                        </div>
                    </button>
                )}
                {/* Story reference quote block */}
                {(() => {
                    let storyRef: { id: string; text: string; type: string; username: string } | null = null;
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed._s) storyRef = parsed._s;
                    } catch { }

                    if (!storyRef) return null;

                    return (
                        <button
                            type="button"
                            onClick={() => {
                                const group = groupedStories.find(g => g.username === storyRef!.username);
                                if (group) {
                                    setSelectedStoryGroup(group);
                                    setInitialStoryId(storyRef!.id);
                                } else {
                                    showNotification(`Could not find active stories for @${storyRef!.username}`, 'warning');
                                }
                            }}
                            className="flex items-start gap-1.5 -mx-1 mb-2 w-full text-left hover:opacity-80 transition-opacity cursor-pointer group/story"
                            title="View Story"
                        >
                            <div className="w-0.5 bg-[var(--primary-color)] group-hover/story:brightness-125 rounded-full self-stretch flex-shrink-0 transition-all" />
                            <div className="bg-[var(--primary-color)]/10 p-2 rounded-r-xl flex-1 min-w-0">
                                <p className="text-[10px] font-black text-[var(--primary-color)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <CircleDashed size={10} />
                                    Story Update
                                </p>
                                <div className="text-xs text-white/60 leading-snug line-clamp-1 italic break-all">
                                    {storyRef.text}
                                </div>
                            </div>
                        </button>
                    );
                })()}
                <div className="flex items-center gap-2">
                    {renderBody(text, msg.id?.toString() || '')}
                    {msg.from === '@hive_guide' && <SpeakButton text={text} />}
                </div>
                {/* Edited label */}
                {(msg as any).edited && (
                    <p className="text-[9px] text-white/40 italic">edited</p>
                )}
            </div>
        );
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
        <div className={`flex flex-col md:flex-row fixed inset-x-0 bg-[var(--bg-canvas)] overflow-hidden transition-all duration-300 ${(selectedUser || selectedStoryGroup)
            ? 'top-0 bottom-0 z-[110] md:top-16 md:bottom-0 md:z-40 md:left-0 md:right-0'
            : 'top-16 bottom-[60px] z-40 md:bottom-0 md:left-0 md:right-0'
            }`}>
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
            <div className={`w-full md:w-[320px] md:flex-none border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-canvas)] flex-1 min-h-0 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
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
                        <div className="px-4 pt-4 pb-5">
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
                        <div className="px-4 pt-1 pb-6 flex gap-2 overflow-x-auto scrollbar-none">
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
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {searchQuery.length > 0 ? (
                                <div className="py-2">
                                    <div className="px-6 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Search Results</div>
                                    {searchResults.length === 0 ? (
                                        <div className="px-6 py-4 text-sm text-[var(--text-secondary)] italic">No users found.</div>
                                    ) : (
                                        searchResults.map(user => (
                                            <button
                                                key={user}
                                                onClick={() => {
                                                    if (user === username) {
                                                        showNotification("You cannot message yourself.", "warning");
                                                        return;
                                                    }
                                                    setSelectedUser(user);
                                                    setSearchQuery('');
                                                }}
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
                                                    {convo.otherUser === '@hive_guide' ? (
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[var(--primary-color)] to-amber-500 flex items-center justify-center text-white shadow-lg">
                                                            <Bot size={24} />
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={`https://images.hive.blog/u/${convo.otherUser}/avatar`}
                                                            alt={convo.otherUser}
                                                            className="w-12 h-12 rounded-full shadow-sm object-cover"
                                                        />
                                                    )}
                                                    {onlineUsers.includes(convo.otherUser) && convo.otherUser !== '@hive_guide' && (
                                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" title="Online" />
                                                    )}
                                                    {convo.otherUser === '@hive_guide' && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 border-2 border-[var(--bg-card)] rounded-full flex items-center justify-center text-[8px] text-white font-bold" title="AI Assistant">
                                                            <Sparkles size={8} />
                                                        </div>
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
                                                        {formatMessagePreview(convo.lastMessage)}
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
                    <div className="flex-1 flex flex-col bg-[var(--bg-canvas)] relative overflow-hidden">
                        <div className="hidden md:block p-6 border-b border-[var(--border-color)]">
                            <h2 className="text-xl font-black tracking-tight">Status</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
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
            <div className={`flex-1 flex flex-row bg-[var(--bg-canvas)] h-full overflow-hidden ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {activeTab === 'chats' ? (
                        selectedUser ? (
                            <>
                                {/* Chat Header */}
                                <div className="p-4 md:p-6 border-b border-[var(--border-color)] bg-[var(--bg-card)]/30 backdrop-blur-md flex items-center justify-between z-10">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <button
                                            onClick={() => setSelectedUser(null)}
                                            className="p-2 md:hidden text-[var(--text-secondary)] hover:bg-[var(--primary-color)]/10 rounded-xl"
                                        >
                                            <ArrowLeft size={20} />
                                        </button>
                                        <div
                                            className="flex items-center gap-3 cursor-pointer group"
                                            onClick={() => setShowUserInfo(true)}
                                        >
                                            <div className="relative">
                                                {selectedUser === '@hive_guide' ? (
                                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-[var(--primary-color)] to-amber-500 flex items-center justify-center text-white shadow-lg">
                                                        <Bot size={24} />
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={`https://images.hive.blog/u/${selectedUser}/avatar`}
                                                        alt={selectedUser}
                                                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[var(--primary-color)]/50 transition-all border border-[var(--border-color)]"
                                                    />
                                                )}
                                                {onlineUsers.includes(selectedUser!) && selectedUser !== '@hive_guide' && (
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" />
                                                )}
                                                {selectedUser === '@hive_guide' && (
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 border-2 border-[var(--bg-card)] rounded-full flex items-center justify-center text-white shadow-sm">
                                                        <Sparkles size={10} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="font-bold truncate text-[var(--text-primary)]">
                                                        {selectedUser === '@hive_guide' ? 'Hive Guide' : `@${selectedUser}`}
                                                    </div>
                                                    {selectedUser === '@hive_guide' && (
                                                        <div className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 text-[10px] font-black uppercase rounded-[4px] border border-amber-500/20">AI</div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                                    {selectedUser === '@hive_guide' ? (
                                                        <span className="flex items-center gap-1 text-amber-500/80 font-medium">Assistant</span>
                                                    ) : onlineUsers.includes(selectedUser!) ? (
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Online</span>
                                                    ) : 'Offline'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 md:gap-2">
                                        <div className="hidden md:flex items-center gap-2">
                                            <button
                                                onClick={() => setIsSecure(!isSecure)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${isSecure
                                                    ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)] shadow-lg shadow-[var(--primary-color)]/20'
                                                    : 'bg-[var(--bg-canvas)] border-[var(--border-color)] text-[var(--text-secondary)]'
                                                    }`}
                                                title={isSecure ? "End-to-end encrypted (Keychain required)" : "Standard chat (Fast, no popups)"}
                                            >
                                                {isSecure ? <ShieldCheck size={14} /> : <Zap size={14} />}
                                                {isSecure ? 'Secure' : 'Fast'}
                                            </button>
                                            <button
                                                onClick={handleBulkDecrypt}
                                                className="px-4 py-2 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-xs font-bold hover:bg-[var(--primary-color)]/5 transition-all"
                                            >
                                                Unlock All
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={() => setShowHeaderActions(!showHeaderActions)}
                                                className="p-2 text-[var(--text-secondary)] hover:bg-[var(--primary-color)]/10 rounded-xl transition-all"
                                            >
                                                <MoreVertical size={20} />
                                            </button>

                                            {showHeaderActions && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderActions(false)} />
                                                    <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {selectedUser === '@hive_guide' && (
                                                            <button
                                                                onClick={() => {
                                                                    const current = speechService.getGender();
                                                                    const next = current === 'female' ? 'male' : 'female';
                                                                    speechService.setGender(next);
                                                                    showNotification(`AI voice set to ${next}`, 'success');
                                                                    setShowHeaderActions(false);
                                                                }}
                                                                className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-[var(--primary-color)]/5 transition-all font-bold text-[var(--primary-color)] border-b border-[var(--border-color)]/50"
                                                            >
                                                                <Volume2 size={16} /> Change Voice ({speechService.getGender()})
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setShowUserInfo(true); setShowHeaderActions(false); }}
                                                            className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-[var(--primary-color)]/5 transition-all font-medium text-[var(--text-primary)]"
                                                        >
                                                            <Search size={16} /> View Profile
                                                        </button>
                                                        <button
                                                            onClick={() => { setIsSecure(!isSecure); setShowHeaderActions(false); }}
                                                            className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-[var(--primary-color)]/5 transition-all font-medium text-[var(--text-primary)] md:hidden"
                                                        >
                                                            {isSecure ? <Zap size={16} /> : <ShieldCheck size={16} />}
                                                            {isSecure ? 'Switch to Fast' : 'Switch to Secure'}
                                                        </button>
                                                        <button
                                                            onClick={() => { handleBulkDecrypt(); setShowHeaderActions(false); }}
                                                            className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-[var(--primary-color)]/5 transition-all font-medium text-[var(--text-primary)] md:hidden border-b border-[var(--border-color)]/50"
                                                        >
                                                            Unlock All
                                                        </button>
                                                        <button
                                                            onClick={() => { /* clearChat() */; setShowHeaderActions(false); }}
                                                            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-500 hover:bg-red-500/5 transition-all font-bold"
                                                        >
                                                            <Trash2 size={16} /> Clear Chat
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Messages Scroll Area */}
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide bg-[var(--bg-canvas)]/30">
                                    {loadingMessages ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-secondary)]">
                                            <Loader2 size={32} className="animate-spin text-[var(--primary-color)]" />
                                            <p className="text-sm font-medium animate-pulse">Decrypting safe conversation...</p>
                                        </div>
                                    ) : filteredMessages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[var(--bg-card)]/30 rounded-3xl border border-dashed border-[var(--border-color)]">
                                            <div className="w-16 h-16 bg-[var(--primary-color)]/10 rounded-full flex items-center justify-center mb-4 text-[var(--primary-color)]">
                                                <Shield size={32} />
                                            </div>
                                            <h3 className="font-bold text-lg mb-2">Secure Channel Established</h3>
                                            <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
                                                Your messages are end-to-end encrypted. No one else, not even Breakaway, can read them.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {filteredMessages.map((msg, index) => {
                                                const isMine = msg.from === username;
                                                const showAvatar = index === 0 || filteredMessages[index - 1].from !== msg.from;
                                                const isLastInGroup = index === filteredMessages.length - 1 || filteredMessages[index + 1].from !== msg.from;

                                                return (
                                                    <div
                                                        key={msg.mongoId || msg.id || index}
                                                        ref={(el) => {
                                                            if (el) messageRefs.current.set(index, el);
                                                            else messageRefs.current.delete(index);
                                                        }}
                                                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${!isLastInGroup ? 'mb-1' : 'mb-4'} group/msg transition-all duration-300 ${highlightedKey === String(index) ? 'ring-2 ring-[var(--primary-color)] ring-offset-2 ring-offset-[var(--bg-canvas)] bg-[var(--primary-color)]/5 rounded-2xl' : ''}`}
                                                    >
                                                        <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] group relative`}>
                                                            {!isMine && (
                                                                <div className="w-8 flex-shrink-0">
                                                                    {showAvatar ? (
                                                                        <img
                                                                            src={`https://images.hive.blog/u/${msg.from}/avatar`}
                                                                            alt={msg.from}
                                                                            className="w-8 h-8 rounded-full object-cover border border-[var(--border-color)]"
                                                                        />
                                                                    ) : <div className="w-8" />}
                                                                </div>
                                                            )}

                                                            <div className="flex flex-col gap-1 min-w-0">
                                                                <div
                                                                    className={`relative px-4 py-3 rounded-2xl break-words transition-all shadow-sm ${isMine
                                                                        ? 'bg-[#1e293b] text-white border border-white/5'
                                                                        : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]'
                                                                        } ${!isMine && showAvatar ? 'rounded-bl-none' : ''} ${isMine && isLastInGroup ? 'rounded-br-none' : ''}`}
                                                                >
                                                                    {renderMessageContent(msg)}

                                                                    <div className={`flex items-center gap-2 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                                        <span className="text-[10px] font-medium opacity-60">
                                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Quick Actions (Reply/Edit) */}
                                                            {msg.status !== 'uploading' && (
                                                                <div className={`absolute top-0 ${isMine ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex flex-col gap-1`}>
                                                                    <button
                                                                        onClick={() => startReply(msg)}
                                                                        className="p-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all shadow-xl"
                                                                        title="Reply"
                                                                    >
                                                                        <Reply size={14} />
                                                                    </button>
                                                                    {isMine && !hasMedia(msg) && (
                                                                        <button
                                                                            onClick={() => startEdit(msg)}
                                                                            className="p-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all shadow-xl"
                                                                            title="Edit"
                                                                        >
                                                                            <Pencil size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {isAiTyping && (
                                                <div className="flex items-start gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--primary-color)] to-amber-500 flex items-center justify-center text-white shadow-md">
                                                        <Bot size={16} />
                                                    </div>
                                                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-3 rounded-2xl rounded-bl-none shadow-sm">
                                                        <div className="flex gap-1.5">
                                                            <div className="w-1.5 h-1.5 bg-[var(--text-secondary)]/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                            <div className="w-1.5 h-1.5 bg-[var(--text-secondary)]/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                            <div className="w-1.5 h-1.5 bg-[var(--text-secondary)]/50 rounded-full animate-bounce" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={chatEndRef} className="h-4" />
                                        </div>
                                    )}
                                </div>

                                {/* Chat Input Area */}
                                <form
                                    onSubmit={handleSendMessage}
                                    className="p-4 bg-[var(--bg-card)]/50 backdrop-blur-md border-t border-[var(--border-color)] relative z-40"
                                >
                                    {/* AI Suggestions */}
                                    {selectedUser === '@hive_guide' && aiSuggestions.length > 0 && (
                                        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1 animate-in slide-in-from-bottom-2 duration-300">
                                            {aiSuggestions.map((suggestion, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setNewMessage(suggestion);
                                                        // Use a temporary event-like object to trigger send
                                                        handleSendMessage({ preventDefault: () => { } } as any);
                                                    }}
                                                    className="whitespace-nowrap px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 hover:bg-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <Sparkles size={12} />
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {/* Media Previews */}
                                    {pendingImagePreviewUrl && (
                                        <div className="media-preview-container flex items-center gap-4">
                                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl group/preview">
                                                <img src={pendingImagePreviewUrl} className="w-full h-full object-cover" alt="Pending upload" />
                                                <button
                                                    type="button"
                                                    onClick={discardPendingImage}
                                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={24} className="text-white" />
                                                </button>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--primary-color)] mb-1">Upload Preview</p>
                                                <p className="text-xs text-[var(--text-secondary)] italic truncate">Image selected for sharing...</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={discardPendingImage}
                                                className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-all"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Reply Preview Bar */}
                                    {replyingTo && (
                                        <div className="mb-3 p-3 bg-[var(--primary-color)]/5 border-l-4 border-[var(--primary-color)] rounded-r-xl flex items-center justify-between transition-all duration-200">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <Reply size={12} className="text-[var(--primary-color)]" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary-color)]">Replying to @{replyingTo.from}</span>
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary)] truncate italic">
                                                    {formatMessagePreview(replyingTo)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setReplyingTo(null)}
                                                className="p-1 hover:bg-[var(--primary-color)]/10 text-[var(--text-secondary)] rounded-full transition-all"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Message Input Container */}
                                    <div className="flex items-center gap-0.5 md:gap-2 px-0.5 md:px-2 py-1.5 md:py-2.5 bg-[var(--bg-card)]/50 backdrop-blur-sm border-t border-[var(--border-color)]">
                                        {/* Hidden File Input */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*,video/*,audio/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file);
                                            }}
                                        />

                                        {/* Attachment Button */}
                                        <button
                                            type="button"
                                            className="p-1 md:p-1.5 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all flex-shrink-0"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Plus size={24} />
                                        </button>

                                        {/* Input Pill */}
                                        <div className="flex-1 relative flex items-center bg-[var(--bg-canvas)] rounded-3xl border border-[var(--border-color)] px-2 md:px-3 group focus-within:border-[var(--primary-color)]/50 transition-all">
                                            {isRecording ? (
                                                <div className="flex-1 flex items-center gap-3 py-3 transition-all duration-300">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    <span className="text-sm font-black text-red-500 min-w-[40px]">{formatTime(recordingTime)}</span>
                                                    <div className="flex-1 h-6 flex items-center gap-1 justify-center overflow-hidden">
                                                        {[...Array(16)].map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className="wave-bar"
                                                                style={{
                                                                    animationDelay: `${i * 0.05}s`,
                                                                    height: `${Math.random() * 10 + 8}px`
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] animate-pulse hidden sm:inline">Recording</span>
                                                </div>
                                            ) : recordedBlobUrl ? (
                                                <div className="flex-1 flex items-center gap-4 py-2 transition-all duration-300">
                                                    <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)]">
                                                        <Volume2 size={20} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-xs font-black uppercase tracking-widest text-[var(--primary-color)]">Voice Note Recorded</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <audio src={recordedBlobUrl} controls className="h-8 max-w-[200px]" />
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={discardRecording}
                                                        className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-all"
                                                        title="Delete recording"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <textarea
                                                        ref={messageInputRef as any}
                                                        rows={1}
                                                        value={newMessage}
                                                        onChange={(e) => {
                                                            setNewMessage(e.target.value);
                                                            e.target.style.height = 'auto';
                                                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey && !isRecording) {
                                                                e.preventDefault();
                                                                handleSendMessage();
                                                                if (messageInputRef.current) {
                                                                    (messageInputRef.current as any).style.height = 'auto';
                                                                }
                                                            }
                                                        }}
                                                        placeholder={editingMessage ? "Edit message..." : "Message..."}
                                                        disabled={sending}
                                                        className="flex-1 py-3 bg-transparent text-[var(--text-primary)] outline-none text-sm md:text-base placeholder:text-[var(--text-secondary)] resize-none overflow-y-auto max-h-[120px] CustomScrollbar min-h-[44px]"
                                                        style={{ height: 'auto' }}
                                                    />

                                                    {/* Emoji Picker inside */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowMediaPicker(!showMediaPicker)}
                                                        className={`p-1 md:p-1.5 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all ${showMediaPicker ? 'text-[var(--primary-color)]' : ''}`}
                                                    >
                                                        <Smile size={24} />
                                                    </button>

                                                    {showMediaPicker && (
                                                        <div className="absolute bottom-full right-0 mb-4 z-[60]">
                                                            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl p-2">
                                                                <MediaPicker
                                                                    onEmojiSelect={(emoji) => {
                                                                        setNewMessage(prev => prev + emoji);
                                                                        setShowMediaPicker(false);
                                                                    }}
                                                                    onStickerSelect={sendSticker}
                                                                    isOpen={showMediaPicker}
                                                                    onToggle={() => setShowMediaPicker(!showMediaPicker)}
                                                                    onClose={() => setShowMediaPicker(false)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Action Button (Mic, Stop, or Send) */}
                                        {isRecording ? (
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="p-2 md:p-2.5 bg-red-500 text-white rounded-full hover:brightness-110 shadow-lg animate-pulse transition-all flex-shrink-0"
                                            >
                                                <Square size={20} fill="currentColor" />
                                            </button>
                                        ) : !newMessage.trim() && !pendingImageFile && !recordedBlob ? (
                                            <button
                                                type="button"
                                                onClick={startRecording}
                                                className="p-1 md:p-1.5 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all flex-shrink-0"
                                            >
                                                <Mic size={24} />
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={sending || (!newMessage.trim() && !pendingImageFile && !recordedBlob) || !socketService.isConnected}
                                                className="p-1 md:p-1.5 text-[var(--primary-color)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center flex-shrink-0"
                                                onClick={() => handleSendMessage()}
                                            >
                                                <Send size={24} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-[var(--text-secondary)] opacity-50 my-1 italic text-center">
                                        {isSecure
                                            ? "* Secure mode encrypts messages with Hive Memo keys (1 popup per send)."
                                            : "* Fast mode delivers messages instantly without popups."}
                                    </p>
                                </form>
                            </>
                        ) : (
                            /* No user selected (Desktop Empty State) */
                            <div className="flex-1 hidden md:flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-canvas)]/30">
                                <div className="w-24 h-24 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full flex items-center justify-center mb-6 text-[var(--primary-color)]">
                                    <MessageCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-black mb-2">Your Conversations</h3>
                                <p className="text-[var(--text-secondary)] max-w-sm">Select a friend from the left to start chatting or sharing files securely.</p>
                            </div>
                        )
                    ) : (
                        /* Status Updates Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center h-full p-12 text-center bg-[var(--bg-canvas)]/30">
                            <div className="w-24 h-24 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full flex items-center justify-center mb-6 text-[var(--primary-color)]">
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

                {/* 4. User Info Panel (Contact Info) */}
                {
                    selectedUser && showUserInfo && (
                        <div className="absolute inset-0 z-50 bg-[var(--bg-canvas)] md:relative md:w-80 md:border-l md:border-[var(--border-color)] overflow-y-auto animate-in slide-in-from-right duration-300">
                            {/* Header */}
                            <div className="sticky top-0 bg-[var(--bg-canvas)]/90 backdrop-blur-md p-4 border-b border-[var(--border-color)] flex items-center gap-4 z-10">
                                <button
                                    onClick={() => setShowUserInfo(false)}
                                    className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-all"
                                >
                                    <X size={24} />
                                </button>
                                <h2 className="font-bold text-lg">Contact Info</h2>
                            </div>

                            {/* Profile Section */}
                            <div className="p-6 flex flex-col items-center text-center border-b border-[var(--border-color)]/30">
                                <div className="w-32 h-32 mb-4 relative group">
                                    <img
                                        src={`https://images.hive.blog/u/${selectedUser}/avatar`}
                                        alt={selectedUser}
                                        className="w-full h-full rounded-full object-cover shadow-2xl ring-4 ring-[var(--primary-color)]/20"
                                    />
                                    {onlineUsers.includes(selectedUser!) && (
                                        <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-[var(--bg-canvas)] rounded-full shadow-lg" />
                                    )}
                                </div>
                                <h3 className="text-xl font-black mb-1">@{selectedUser}</h3>
                                <p className="text-sm text-[var(--text-secondary)] font-medium">
                                    {onlineUsers.includes(selectedUser!) ? 'Online' : 'Offline'}
                                </p>
                            </div>

                            {/* About Section */}
                            <div className="p-6 space-y-4 border-b border-[var(--border-color)]/30">
                                <div>
                                    <h4 className="text-[10px] font-black text-[var(--primary-color)] uppercase tracking-widest mb-2">About & Bio</h4>
                                    {loadingUserDetails ? (
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-2">
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Fetching bio...</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                                            {selectedUserDetails?.profile?.about || 'No bio available.'}
                                        </p>
                                    )}
                                </div>

                                {selectedUserDetails?.profile?.location && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Location</h4>
                                        <p className="text-sm">{selectedUserDetails.profile.location}</p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Account Created</h4>
                                    <p className="text-sm">
                                        {selectedUserDetails?.created ? new Date(selectedUserDetails.created).toLocaleDateString() : '---'}
                                    </p>
                                </div>
                            </div>

                            {/* Placeholder Chat Settings */}
                            <div className="p-2">
                                <h4 className="p-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Chat Settings</h4>
                                <div className="space-y-1">
                                    {[
                                        { icon: <Mic size={18} />, label: 'Mute Notifications', hint: 'Coming Soon' },
                                        { icon: <Image size={18} />, label: 'Media Visibility', hint: 'Coming Soon' },
                                        { icon: <MoreVertical size={18} />, label: 'Encryption Settings', hint: 'Secure Mode Active' },
                                    ].map((item, idx) => (
                                        <button
                                            key={idx}
                                            disabled
                                            className="w-full p-4 flex items-center justify-between rounded-2xl hover:bg-[var(--primary-color)]/5 opacity-60 cursor-not-allowed group transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-[var(--text-secondary)]">{item.icon}</span>
                                                <span className="text-sm font-bold">{item.label}</span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-[var(--bg-card)] px-2 py-1 rounded-full uppercase tracking-tighter opacity-70">
                                                {item.hint}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="p-4 mt-4 border-t border-[var(--border-color)]/30">
                                <button
                                    disabled
                                    className="w-full p-4 flex items-center gap-3 text-red-500 opacity-50 cursor-not-allowed font-bold text-sm bg-red-500/5 rounded-2xl"
                                >
                                    <X size={18} />
                                    Block User (Coming Soon)
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Image Lightbox */}
            {selectedImageForLightbox && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
                    onClick={() => setSelectedImageForLightbox(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md"
                        onClick={() => setSelectedImageForLightbox(null)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={selectedImageForLightbox}
                        alt="Enlarged view"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform transform scale-100"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Modals */}
            {
                showStoryCreator && (
                    <StoryCreator
                        onClose={() => setShowStoryCreator(false)}
                        onSuccess={() => { setShowStoryCreator(false); loadStories(); }}
                    />
                )
            }
            {
                selectedStoryGroup && (
                    <StoryViewer
                        key={selectedStoryGroup?.username || 'story-viewer'}
                        group={selectedStoryGroup}
                        initialStoryId={initialStoryId}
                        onClose={() => {
                            setSelectedStoryGroup(null);
                            setInitialStoryId(undefined);
                        }}
                        onNext={handleNextStoryGroup}
                        onPrev={handlePrevStoryGroup}
                    />
                )
            }
        </div >
    );
}
