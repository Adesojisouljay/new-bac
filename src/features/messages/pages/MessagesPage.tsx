import { useState, useEffect, useRef } from 'react';
import { messageService, Message, Conversation } from '../services/messageService';
import { useNotification } from '../../../contexts/NotificationContext';

export function MessagesPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [username] = useState(localStorage.getItem('hive_user'));
    const { showNotification } = useNotification();
    const chatEndRef = useRef<HTMLDivElement>(null);

    const { hiveClient } = messageService; // Re-use client

    useEffect(() => {
        if (username) {
            loadMessages();
        }
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
            const encrypted = await messageService.encryptMessage(username, selectedUser, newMessage);
            await messageService.sendMessage(username, selectedUser, encrypted);
            showNotification('Message sent!', 'success');
            setNewMessage('');
            // Give the blockchain a second to index the transaction
            setTimeout(() => {
                loadMessages();
            }, 2000);
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
            const decrypted = await messageService.decryptMessage(username, msg.message);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, decrypted } : m));
        } catch (error: any) {
            showNotification(`Decryption failed: ${error.message}`, 'error');
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
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                                        <img
                                            src={`https://images.hive.blog/u/${user}/avatar`}
                                            alt={user}
                                            className="w-10 h-10 rounded-xl"
                                        />
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
                                        <img
                                            src={`https://images.hive.blog/u/${convo.otherUser}/avatar`}
                                            alt={convo.otherUser}
                                            className="w-12 h-12 rounded-2xl shadow-sm"
                                        />
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="font-bold text-[var(--text-primary)] truncate">@{convo.otherUser}</div>
                                            <div className="text-xs text-[var(--text-secondary)] truncate">
                                                {convo.lastMessage.from === username ? 'You: ' : ''}
                                                {convo.lastMessage.isEncrypted ? 'Locked Message' : convo.lastMessage.message}
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
                                <img
                                    src={`https://images.hive.blog/u/${selectedUser}/avatar`}
                                    alt={selectedUser}
                                    className="w-10 h-10 rounded-xl"
                                />
                                <span className="font-black text-lg">@{selectedUser}</span>
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
                                                className="flex items-center gap-2 text-sm font-bold opacity-80 hover:opacity-100"
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
