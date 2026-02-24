import { hiveClient } from '../../../services/hive/client';
import { socketService } from '../../../services/socketService';

export interface Message {
    from: string;
    to: string;
    message: string;
    timestamp: string;
    decrypted?: string;
    isEncrypted: boolean;
    id?: string;       // trx_id (Hive transaction ID)
    mongoId?: string;  // MongoDB _id (used for PATCH /api/messages/:id)
    edited?: boolean;
}

export interface Conversation {
    otherUser: string;
    lastMessage: Message;
    unreadCount: number;
}

class MessageService {

    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    public readonly hiveClient = hiveClient;

    // Memory cache for decrypted messages in this session
    private decryptedCache = new Map<string, string>();

    /**
     * Encrypt a message using Hive Keychain
     */
    async encryptMessage(username: string, receiver: string, message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            (window as any).hive_keychain.requestEncodeMessage(
                username,
                receiver,
                message.startsWith('#') ? message : '#' + message,
                'Memo',
                (response: any) => {
                    if (response && response.success) {
                        resolve(response.result);
                    } else {
                        reject(new Error(response?.message || 'Encryption failed'));
                    }
                }
            );
        });
    }

    /**
     * Decrypt a message using Hive Keychain
     */
    async decryptMessage(username: string, msg: Message): Promise<string> {
        const encryptedMessage = msg.message;
        if (!encryptedMessage.startsWith('#')) return encryptedMessage;

        // 1. Check cache first
        if (msg.id && this.decryptedCache.has(msg.id)) {
            return this.decryptedCache.get(msg.id)!;
        }

        return new Promise((resolve, reject) => {
            (window as any).hive_keychain.requestVerifyKey(
                username,
                encryptedMessage,
                'Memo',
                (response: any) => {
                    if (response && response.success) {
                        const result = response.result;
                        const decrypted = result.startsWith('#') ? result.substring(1) : result;

                        // 2. Save to cache
                        if (msg.id) {
                            this.decryptedCache.set(msg.id, decrypted);
                        }

                        resolve(decrypted);
                    } else {
                        reject(new Error(response?.message || 'Decryption failed'));
                    }
                }
            );
        });
    }

    /**
     * Send a message off-chain via Socket.io
     */
    async sendMessage(_sender: string, receiver: string, encryptedMessage: string): Promise<any> {
        if (!socketService.isConnected) {
            console.warn(`⚠️ [MessageService] Cannot send message to @${receiver}: Socket disconnected`);
            throw new Error('Chat server is currently offline. Please try again in a moment.');
        }

        console.log(`📡 [MessageService] Emitting send_message to @${receiver}`);

        // Emit directly via Socket for total confidentiality (Off-Chain)
        socketService.emit('send_message', {
            to: receiver,
            message: encryptedMessage,
            v: '1.0'
        });

        return { success: true, message: 'Message sent off-chain' };
    }

    /**
     * Fetch message history for a user
     */
    async getMessageHistory(username: string, limit: number = 100): Promise<Message[]> {
        let history: Message[] = [];

        // 1. Fetch only from the private backend API (Off-Chain)
        if (this.BACKEND_URL) {
            try {
                console.log(`📡 [MessageService] Fetching history from: ${this.BACKEND_URL}/api/messages?account=${username}`);
                const response = await fetch(`${this.BACKEND_URL}/api/messages?account=${username}&limit=${limit}`);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ [MessageService] Fetched ${data.messages?.length || 0} messages`);
                    history = data.messages.map((m: any) => ({
                        from: m.from,
                        to: m.to,
                        message: m.message,
                        timestamp: m.timestamp,
                        isEncrypted: m.message.startsWith('#'),
                        id: m.trx_id,
                        mongoId: m._id,
                        edited: m.edited
                    }));
                } else {
                    const errorText = await response.text().catch(() => 'No error text');
                    console.error(`❌ [MessageService] Backend fetch failed (${response.status}):`, errorText);
                }
            } catch (error: any) {
                console.error('❌ [MessageService] Backend history fetch error:', error.message || error);
            }
        }

        // Note: We no longer fallback to blockchain history to ensure total confidentiality
        // and consistency with the new off-chain system.

        // 2. Apply cache to results
        return history.map(msg => {
            if (msg.id && this.decryptedCache.has(msg.id)) {
                return { ...msg, decrypted: this.decryptedCache.get(msg.id) };
            }
            return msg;
        }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    /**
     * Group messages into conversations
     */
    getConversations(messages: Message[], currentUser: string): Conversation[] {
        const convos: Record<string, Conversation> = {};

        // Sort descending for "last message" correctly
        const sorted = [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        sorted.forEach(msg => {
            const otherUser = msg.from === currentUser ? msg.to : msg.from;
            if (!convos[otherUser]) {
                convos[otherUser] = {
                    otherUser,
                    lastMessage: msg,
                    unreadCount: 0
                };
            }
        });

        return Object.values(convos);
    }
}

export const messageService = new MessageService();
