import { useEffect, useState } from 'react';
import { UnifiedDataService } from '../../../services/unified';
import { WalletView } from '../../profiles/components/WalletView';

interface HiveWalletProps {
    username: string;
}

export function HiveWallet({ username }: HiveWalletProps) {
    const [wallet, setWallet] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyStart, setHistoryStart] = useState(-1);

    const fetchWallet = async () => {
        setLoading(true);
        try {
            const data = await UnifiedDataService.getWallet(username);
            setWallet(data);
        } catch (err) {
            console.error('Failed to fetch Hive wallet:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (start = -1, append = false) => {
        setLoadingHistory(true);
        try {
            const data = await UnifiedDataService.getAccountHistory(username, start, 20);
            setHistory(prev => append ? [...prev, ...data] : data);
            if (data.length > 0) {
                setHistoryStart(data[data.length - 1].id - 1);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (!username) return;
        fetchWallet();
        fetchHistory();
    }, [username]);

    const handleLoadMore = () => {
        if (historyStart >= 0) {
            fetchHistory(historyStart, true);
        }
    };

    return (
        <WalletView
            wallet={wallet}
            history={history}
            username={username}
            loading={loading}
            onLoadMore={handleLoadMore}
            loadingHistory={loadingHistory}
        />
    );
}
