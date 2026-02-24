import React, { createContext, useContext, useEffect, useState } from 'react';
import { socketService } from '../services/socketService';

interface SocketContextType {
    isConnected: boolean;
    onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const username = localStorage.getItem('hive_user');

    useEffect(() => {
        if (username) {
            socketService.connect(username);

            const handleConnect = () => setIsConnected(true);
            const handleDisconnect = () => setIsConnected(false);
            const handleOnlineUsers = (users: string[]) => {
                setOnlineUsers(users);
            };

            socketService.on('connect', handleConnect);
            socketService.on('disconnect', handleDisconnect);
            socketService.on('online_users', handleOnlineUsers);

            // Sync initial state if already connected
            if (socketService.isConnected) setIsConnected(true);

            return () => {
                socketService.off('connect', handleConnect);
                socketService.off('disconnect', handleDisconnect);
                socketService.off('online_users', handleOnlineUsers);
                socketService.disconnect();
                setIsConnected(false);
            };
        }
    }, [username]);

    return (
        <SocketContext.Provider value={{ isConnected, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
