import { io, Socket } from 'socket.io-client';

class SocketService {
    private socket: Socket | null = null;
    private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    connect(username: string) {
        if (this.socket?.connected) return;

        this.socket = io(this.BACKEND_URL, {
            query: { username },
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            console.log('📡 Connected to chat server');
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnected from chat server');
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
