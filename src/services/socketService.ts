import { io, Socket } from 'socket.io-client';

class SocketService {
    private socket: Socket | null = null;
    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    connect(username: string) {
        if (this.socket?.connected) return;

        this.socket = io(this.BACKEND_URL, {
            query: { username },
            transports: ['websocket', 'polling'], // Prefer WebSockets for production performance
            reconnectionAttempts: 10,
            timeout: 10000
        });

        this.socket.on('connect', () => {

        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ [Socket] Connection Error:', error.message);
        });

        this.socket.on('reconnect_attempt', (_attempt) => {

        });

        this.socket.on('disconnect', (_reason) => {

        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event: string, callback: (data: any) => void) {
        this.socket?.on(event, callback);
    }

    off(event: string, callback: (data: any) => void) {
        this.socket?.off(event, callback);
    }

    emit(event: string, data: any) {
        this.socket?.emit(event, data);
    }

    get isConnected() {
        return this.socket?.connected || false;
    }
}

export const socketService = new SocketService();
