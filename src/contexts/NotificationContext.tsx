import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: number;
    message: string;
    type: NotificationType;
}

interface ConfirmState {
    title: string;
    message: string;
    resolve: (value: boolean) => void;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType) => void;
    showConfirm: (title: string, message: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);

    const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
        const id = Date.now();
        setNotifications((prev) => [...prev, { id, message, type }]);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }, []);

    const showConfirm = useCallback((title: string, message: string) => {
        return new Promise<boolean>((resolve) => {
            setConfirm({ title, message, resolve });
        });
    }, []);

    const handleConfirm = (value: boolean) => {
        if (confirm) {
            confirm.resolve(value);
            setConfirm(null);
        }
    };

    const removeNotification = (id: number) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showNotification, showConfirm }}>
            {children}

            {/* Toasts Container */}
            <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {notifications.map((n) => (
                    <div key={n.id} className="pointer-events-auto">
                        <Toast
                            message={n.message}
                            type={n.type}
                            onClose={() => removeNotification(n.id)}
                        />
                    </div>
                ))}
            </div>

            {/* Confirmation Modal */}
            {confirm && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-2">{confirm.title}</h3>
                        <p className="text-[var(--text-secondary)] mb-6">{confirm.message}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => handleConfirm(false)}
                                className="px-4 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-canvas)] transition-colors text-sm font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                className="px-6 py-2 rounded-xl bg-[var(--primary-color)] text-white hover:opacity-90 transition-opacity text-sm font-bold"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

const Toast: React.FC<{ message: string; type: NotificationType; onClose: () => void }> = ({ message, type, onClose }) => {
    const getStyles = () => {
        switch (type) {
            case 'success': return 'bg-green-500 border-green-600 text-white';
            case 'error': return 'bg-red-500 border-red-600 text-white';
            case 'warning': return 'bg-yellow-500 border-yellow-600 text-white';
            default: return 'bg-blue-500 border-blue-600 text-white';
        }
    };

    return (
        <div className={`flex items-center justify-between p-4 rounded-xl shadow-2xl border animate-in slide-in-from-right-full duration-300 ${getStyles()}`}>
            <span className="text-sm font-bold">{message}</span>
            <button onClick={onClose} className="ml-4 p-1 hover:bg-black/10 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};
