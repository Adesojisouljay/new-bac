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
            setIsConnected(true);

            const handleOnlineUsers = (users: string[]) => {
                setOnlineUsers(users);
            };

            socketService.on('online_users', handleOnlineUsers);

            return () => {
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
