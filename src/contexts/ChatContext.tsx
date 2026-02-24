import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/socketService';
import { useLocation } from 'react-router-dom';

interface ChatContextType {
    unreadCount: number;
    resetUnreadCount: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState<number>(() => {
        const saved = localStorage.getItem('unread_messages_count');
        return saved ? parseInt(saved, 10) : 0;
    });

    const location = useLocation();
    const isMessagesPage = location.pathname === '/messages';

    const resetUnreadCount = useCallback(() => {
        setUnreadCount(0);
        localStorage.setItem('unread_messages_count', '0');
    }, []);

    useEffect(() => {
        // Automatically reset if we are on the messages page
        if (isMessagesPage && unreadCount > 0) {
            resetUnreadCount();
        }
    }, [isMessagesPage, unreadCount, resetUnreadCount]);

    useEffect(() => {
        const handleNewMessage = (msg: any) => {
            // Only increment if we are NOT on the messages page
            if (!isMessagesPage) {
                setUnreadCount(prev => {
                    const next = prev + 1;
                    localStorage.setItem('unread_messages_count', next.toString());
                    return next;
                });
            }
        };

        socketService.on('new_message', handleNewMessage);

        return () => {
            socketService.off('new_message', handleNewMessage);
        };
    }, [isMessagesPage]);

    return (
        <ChatContext.Provider value={{ unreadCount, resetUnreadCount }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
