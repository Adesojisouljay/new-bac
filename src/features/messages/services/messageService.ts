import { hiveClient } from '../../../services/hive/client';

export interface Message {
    from: string;
    to: string;
    message: string;
    timestamp: string;
    decrypted?: string;
    isEncrypted: boolean;
    id?: string;
}

export interface Conversation {
    otherUser: string;
    lastMessage: Message;
    unreadCount: number;
}

class MessageService {
    private readonly CUSTOM_JSON_ID = 'messaging';
    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    public readonly hiveClient = hiveClient;

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
    async decryptMessage(username: string, encryptedMessage: string): Promise<string> {
        if (!encryptedMessage.startsWith('#')) return encryptedMessage;

        return new Promise((resolve, reject) => {
            (window as any).hive_keychain.requestVerifyKey(
                username,
                encryptedMessage,
                'Memo',
                (response: any) => {
                    if (response && response.success) {
                        const result = response.result;
                        resolve(result.startsWith('#') ? result.substring(1) : result);
                    } else {
                        reject(new Error(response?.message || 'Decryption failed'));
                    }
                }
            );
        });
    }

    /**
     * Send a message via custom_json (Sting Protocol)
     */
    async sendMessage(sender: string, receiver: string, encryptedMessage: string): Promise<any> {
        const json = JSON.stringify([
            'message',
            {
                to: receiver,
                message: encryptedMessage,
                v: '1.0'
            }
        ]);

        return new Promise((resolve, reject) => {
            (window as any).hive_keychain.requestCustomJson(
                sender,
                this.CUSTOM_JSON_ID,
                'Posting',
                json,
                'Send Encrypted Message',
                (response: any) => {
                    if (response.success) resolve(response);
                    else reject(new Error(response.message));
                }
            );
        });
    }

    /**
     * Fetch message history for a user
     */
    async getMessageHistory(username: string, limit: number = 50): Promise<Message[]> {
        // 1. Try fetching from the custom backend if configured
        if (this.BACKEND_URL && !this.BACKEND_URL.includes('your-backend-api.com')) {
            try {
                const response = await fetch(`${this.BACKEND_URL}/api/messages?account=${username}&limit=${limit}`);
                if (response.ok) {
                    const data = await response.json();
                    return data.messages.map((m: any) => ({
                        from: m.from,
                        to: m.to,
                        message: m.message,
                        timestamp: m.timestamp || m.time,
                        isEncrypted: m.message.startsWith('#'),
                        id: m.id || m.trx_id
                    }));
                }
            } catch (error) {
                console.warn('Custom backend failed, falling back to blockchain:', error);
            }
        }

        // 2. Fallback: Fetch directly from Hive Blockchain (Standard condenser_api)
        // NOTE: This will only show messages SIGNED by the current user (sent messages).
        // Received messages won't show up here because standard Hive nodes don't index custom_json for receivers.
        try {
            const history = await this.hiveClient.database.getAccountHistory(username, -1, limit);
            const messages: Message[] = [];

            for (const entry of history) {
                const op = entry[1].op;
                if (op[0] === 'custom_json' && op[1].id === this.CUSTOM_JSON_ID) {
                    try {
                        const parsed = JSON.parse(op[1].json);
                        if (Array.isArray(parsed) && parsed[0] === 'message') {
                            const msgData = parsed[1];
                            const sender = op[1].required_posting_auths[0];

                            // Since standard nodes only return transactions signed by the account,
                            // we will mostly find messages SENT by the user here.
                            if (sender === username || msgData.to === username) {
                                messages.push({
                                    from: sender,
                                    to: msgData.to,
                                    message: msgData.message,
                                    timestamp: entry[1].timestamp,
                                    isEncrypted: msgData.message.startsWith('#'),
                                    id: entry[1].trx_id
                                });
                            }
                        }
                    } catch (e) { }
                }
            }
            return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch (error) {
            console.error('Failed to fetch blockchain history:', error);
            return [];
        }
    }

    /**
     * Group messages into conversations
     */
    getConversations(messages: Message[], currentUser: string): Conversation[] {
        const convos: Record<string, Conversation> = {};

        messages.forEach(msg => {
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
