import { useState, useEffect, useRef } from 'react';
import { messageService, Message, Conversation } from '../services/messageService';
import { useNotification } from '../../../contexts/NotificationContext';
import { socketService } from '../../../services/socketService';
import { useSocket } from '../../../contexts/SocketContext';

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
    const { showNotification } = useNotification();
    const chatEndRef = useRef<HTMLDivElement>(null);
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

        setSending(true);
        try {
            let finalMessage = newMessage;

            if (isSecure) {
                showNotification('Waiting for Keychain encryption...', 'info');
                finalMessage = await messageService.encryptMessage(username, selectedUser, newMessage);
            }

            console.log(`🚀 Sending message to @${selectedUser} (Secure: ${isSecure})`);

            // Send (Silent off-chain)
            await messageService.sendMessage(username, selectedUser, finalMessage);

            setNewMessage('');
        } catch (error: any) {
            const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
            showNotification(`Error: ${errorMsg}`, 'error');
        } finally {
            setSending(false);
        }
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
        <div className="flex h-[calc(100vh-160px)] bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden shadow-2xl">
            {/* Sidebar */}
            <div className="w-80 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-canvas)]/50">
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
            <div className="flex-1 flex flex-col bg-[var(--bg-card)]">
                {selectedUser ? (
                    <>
                        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)] shadow-sm z-10">
                            <div className="flex items-center gap-3">
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
                                <span className="font-black text-lg">@{selectedUser}</span>
                                {onlineUsers.includes(selectedUser) && (
                                    <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Online</span>
                                )}
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
                                    key={msg.id || i}
                                    className={`flex flex-col ${msg.from === username ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`max-w-[70%] p-4 rounded-3xl shadow-sm relative group transition-all ${msg.from === username
                                            ? 'bg-[var(--primary-color)] text-white rounded-tr-none'
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
                                            <p className="whitespace-pre-wrap">{msg.decrypted || msg.message}</p>
                                        )}
                                        <span className={`text-[10px] mt-1 block opacity-50 ${msg.from === username ? 'text-right' : 'text-left'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-canvas)]/30">
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a secure message..."
                                    className="flex-1 px-6 py-3 bg-[var(--bg-card)] border border-2 border-[var(--border-color)] rounded-2xl focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] outline-none transition-all placeholder:text-[var(--text-secondary)]"
                                    disabled={sending}
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !newMessage.trim()}
                                    className="px-8 py-3 bg-[var(--primary-color)] text-white font-bold rounded-2xl shadow-lg hover:shadow-[var(--primary-color)]/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {sending ? 'Sending...' : 'Send'}
                                    <span>🚀</span>
                                </button>
                            </div>
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
                )}
            </div>
        </div>
    );
}
