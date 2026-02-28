import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hiveClient } from '../../../services/hive/client';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';

interface Witness {
    owner: string;
    votes: string;
    url: string;
    total_missed: number;
    last_confirmed_block_num: number;
}

interface Proposal {
    id: number;
    proposal_id: number;
    creator: string;
    receiver: string;
    start_date: string;
    end_date: string;
    daily_pay: {
        amount: string;
        precision: number;
        nai: string;
    };
    subject: string;
    permlink: string;
    total_votes: string;
    status: string;
}

export function GovernancePage() {
    const { tab } = useParams<{ tab?: string }>();
    const navigate = useNavigate();
    const activeTab = (tab === 'proposal' || tab === 'proposals') ? 'proposals' : 'witnesses';

    const { showNotification } = useNotification();
    const [witnesses, setWitnesses] = useState<Witness[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [username] = useState(localStorage.getItem('hive_user'));
    const [userVotes, setUserVotes] = useState<string[]>([]);
    const [votedProposals, setVotedProposals] = useState<number[]>([]);

    // Search & Pagination stats
    const [witnessSearch, setWitnessSearch] = useState('');
    const [proposalSearch, setProposalSearch] = useState('');
    const [hasMoreWitnesses, setHasMoreWitnesses] = useState(true);
    const [hasMoreProposals, setHasMoreProposals] = useState(true);
    // Proxy
    const [currentProxy, setCurrentProxy] = useState('');
    const [proxyInput, setProxyInput] = useState('');
    const [settingProxy, setSettingProxy] = useState(false);

    useEffect(() => {
        fetchData();
        if (username) fetchUserGovernanceData();
    }, [username, activeTab]);

    const fetchData = async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            if (activeTab === 'witnesses') {
                // get_witnesses_by_vote doesn't support offset easily with dhive, usually we fetch by rank/votes
                // We'll fetch 50 at a time
                const lastWitness = isLoadMore ? witnesses[witnesses.length - 1] : null;
                const witnessData = await hiveClient.database.call('get_witnesses_by_vote', [lastWitness ? lastWitness.owner : '', 50]);

                const newWitnesses = isLoadMore ? [...witnesses, ...witnessData.slice(1)] : witnessData;
                setWitnesses(newWitnesses);
                setHasMoreWitnesses(witnessData.length === 50);
            } else {
                const lastProposal = isLoadMore ? proposals[proposals.length - 1] : null;
                const proposalData = await hiveClient.call('database_api', 'list_proposals', {
                    start: lastProposal ? [lastProposal.total_votes, lastProposal.proposal_id] : [],
                    limit: 50,
                    order: 'by_total_votes',
                    order_direction: 'descending',
                    status: 'all'
                });

                const newProposals = isLoadMore ? [...proposals, ...proposalData.proposals.slice(1)] : proposalData.proposals;
                setProposals(newProposals);
                setHasMoreProposals(proposalData.proposals.length === 50);
            }
        } catch (error) {
            console.error('Failed to fetch governance data:', error);
        }

        setLoading(false);
        setLoadingMore(false);
    };

    const fetchUserGovernanceData = async () => {
        if (!username) return;
        try {
            const [account] = await hiveClient.database.getAccounts([username]);
            setUserVotes(account.witness_votes);
            setCurrentProxy(account.proxy || '');

            // Fetch user proposal votes
            const votes = await hiveClient.call('database_api', 'list_proposal_votes', {
                start: [username, 0],
                limit: 1000,
                order: 'by_voter_proposal',
                order_direction: 'descending',
                status: 'all'
            });
            const userVotedIds = votes.proposal_votes
                .filter((v: any) => v.voter === username)
                .map((v: any) => v.proposal.proposal_id);
            setVotedProposals(userVotedIds);
        } catch (error) {
            console.error('Failed to fetch user governance data:', error);
        }
    };

    const handleWitnessVote = async (witness: string, approve: boolean) => {
        if (!username) {
            showNotification('Please login to vote', 'error');
            return;
        }

        try {
            const op = {
                type: 'witness_vote' as const,
                username,
                witness,
                approve
            };

            const result = await transactionService.broadcast(op, () => {
                showNotification('Please sign the transaction', 'info');
            });

            if (result.success) {
                showNotification(`Successfully ${approve ? 'voted for' : 'unvoted'} ${witness}`, 'success');
                fetchUserGovernanceData();
            } else {
                showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    };

    const handleSetProxy = async (proxy: string) => {
        if (!username) {
            showNotification('Please login to set a proxy', 'error');
            return;
        }
        setSettingProxy(true);
        try {
            const result = await transactionService.broadcast({
                type: 'set_proxy' as any,
                username,
                proxy
            }, () => {
                showNotification('Please sign the transaction', 'info');
            });

            if (result.success) {
                const msg = proxy ? `Proxy set to @${proxy}` : 'Proxy cleared';
                showNotification(msg, 'success');
                setCurrentProxy(proxy);
                setProxyInput('');
            } else {
                showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            setSettingProxy(false);
        }
    };

    const handleProposalVote = async (proposal_id: number, approve: boolean) => {
        if (!username) {
            showNotification('Please login to vote', 'error');
            return;
        }

        try {
            const op = {
                type: 'proposal_vote' as any, // Need to add to transactionService
                username,
                proposal_ids: [proposal_id],
                approve
            };

            const result = await transactionService.broadcast(op, () => {
                showNotification('Please sign the transaction', 'info');
            });

            if (result.success) {
                showNotification(`Successfully ${approve ? 'supported' : 'removed support for'} proposal #${proposal_id}`, 'success');
                fetchUserGovernanceData();
            } else {
                showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-black text-[var(--text-primary)] mb-4 tracking-tight">Hive Governance</h1>
                <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
                    Participate in the decentralization of Hive. Vote for witnesses who run the network and support proposals that build the ecosystem.
                </p>
            </header>

            <div className="flex flex-col gap-6 mb-8">
                <div className="relative w-full max-w-2xl mx-auto">
                    <input
                        type="text"
                        placeholder={activeTab === 'witnesses' ? "Search witness name..." : "Search proposal title or creator..."}
                        value={activeTab === 'witnesses' ? witnessSearch : proposalSearch}
                        onChange={(e) => {
                            const val = e.target.value.toLowerCase();
                            if (activeTab === 'witnesses') setWitnessSearch(val);
                            else setProposalSearch(val);
                        }}
                        className="w-full pl-12 pr-4 py-3 bg-[var(--bg-card)] border border-2 border-[var(--border-color)] rounded-2xl text-base shadow-sm focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] outline-none transition-all placeholder:text-[var(--text-secondary)]"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-50">🔍</span>
                </div>

                <div className="flex p-1.5 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex max-w-sm mx-auto w-full shadow-sm">
                    <button
                        onClick={() => navigate('/governance/witness')}
                        className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'witnesses' ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Witnesses
                    </button>
                    <button
                        onClick={() => navigate('/governance/proposal')}
                        className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'proposals' ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Proposals
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-[var(--bg-card)] h-20 rounded-2xl animate-pulse border border-[var(--border-color)]"></div>
                    ))}
                </div>
            ) : activeTab === 'witnesses' ? (
                <div className="space-y-6">
                    {/* Proxy Panel */}
                    {username && (
                        <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] p-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-4">Voting Proxy</h3>
                            {currentProxy ? (
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-[var(--text-secondary)] mb-1">Your witness votes are delegated to:</p>
                                        <span className="font-black text-[var(--primary-color)] text-lg">@{currentProxy}</span>
                                    </div>
                                    <button
                                        onClick={() => handleSetProxy('')}
                                        disabled={settingProxy}
                                        className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                    >
                                        {settingProxy ? 'Clearing...' : 'Clear Proxy'}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="text"
                                        placeholder="Enter Hive username to set as proxy..."
                                        value={proxyInput}
                                        onChange={(e) => setProxyInput(e.target.value.toLowerCase().replace('@', ''))}
                                        className="flex-1 px-4 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10 outline-none transition-all"
                                    />
                                    <button
                                        onClick={() => handleSetProxy(proxyInput.trim())}
                                        disabled={!proxyInput.trim() || settingProxy}
                                        className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--primary-color)] text-white shadow-md shadow-[var(--primary-color)]/20 hover:brightness-110 transition-all disabled:opacity-50"
                                    >
                                        {settingProxy ? 'Setting...' : 'Set Proxy'}
                                    </button>
                                </div>
                            )}
                            <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-3">Setting a proxy delegates ALL your witness votes to that account. You can clear it anytime.</p>
                        </div>
                    )}

                    {/* Witness Table */}
                    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--bg-canvas)]/50 text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">
                                <tr>
                                    <th className="px-6 py-4">Rank</th>
                                    <th className="px-6 py-4">Witness</th>
                                    <th className="px-6 py-4">Votes</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {witnesses
                                    .filter(w => w.owner.toLowerCase().includes(witnessSearch.toLowerCase()))
                                    .map((w, i) => {
                                        const isVoted = userVotes.includes(w.owner);
                                        return (
                                            <tr key={w.owner} className="hover:bg-[var(--bg-canvas)] transition-colors group">
                                                <td className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)]">#{i + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-color)] transition-colors">@{w.owner}</span>
                                                        <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--text-secondary)] hover:underline truncate max-w-[150px]">Link</a>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-[var(--text-primary)]">
                                                    {(parseFloat(w.votes) / 1e12).toFixed(2)}T
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleWitnessVote(w.owner, !isVoted)}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${isVoted ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] border-[var(--primary-color)]/20 hover:bg-[var(--primary-color)] hover:text-white'}`}
                                                    >
                                                        {isVoted ? 'Unvote' : 'Vote'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>

                        {hasMoreWitnesses && witnessSearch === '' && (
                            <div className="p-6 text-center border-t border-[var(--border-color)]">
                                <button
                                    onClick={() => fetchData(true)}
                                    disabled={loadingMore}
                                    className="px-8 py-2 text-sm font-bold uppercase tracking-widest text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 border border-[var(--primary-color)]/20 rounded-xl transition-all disabled:opacity-50"
                                >
                                    {loadingMore ? 'Loading More...' : 'Load More Witnesses'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {proposals
                        .filter(p => p.subject.toLowerCase().includes(proposalSearch.toLowerCase()) || p.creator.toLowerCase().includes(proposalSearch.toLowerCase()))
                        .map(p => {
                            const isVoted = votedProposals.includes(p.proposal_id);
                            return (
                                <div key={p.proposal_id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 transition-all hover:shadow-lg group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h3 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-color)] transition-colors leading-tight mb-1 truncate">
                                                {p.subject}
                                            </h3>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                By <span className="font-bold">@{p.creator}</span> • Proposal #{p.proposal_id}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleProposalVote(p.proposal_id, !isVoted)}
                                            className={`px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border shadow-sm ${isVoted ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'}`}
                                        >
                                            {isVoted ? 'Supported' : 'Support'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        <div className="bg-[var(--bg-canvas)] p-3 rounded-2xl border border-[var(--border-color)]">
                                            <span className="block text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mb-1">Daily Pay</span>
                                            <span className="text-sm font-bold text-[var(--text-primary)]">
                                                {(parseInt(p.daily_pay.amount) / Math.pow(10, p.daily_pay.precision)).toFixed(2)} HBD
                                            </span>
                                        </div>
                                        <div className="bg-[var(--bg-canvas)] p-3 rounded-2xl border border-[var(--border-color)]">
                                            <span className="block text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mb-1">Duration</span>
                                            <span className="text-sm font-bold text-[var(--text-primary)] text-xs truncate">
                                                {new Date(p.start_date).toLocaleDateString()} - {new Date(p.end_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="bg-[var(--bg-canvas)] p-3 rounded-2xl border border-[var(--border-color)]">
                                            <span className="block text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mb-1">Status</span>
                                            <span className={`text-sm font-bold capitalize ${p.status === 'active' ? 'text-green-500' :
                                                p.status === 'expired' ? 'text-gray-500' :
                                                    'text-yellow-500'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </div>
                                        <div className="bg-[var(--bg-canvas)] p-3 rounded-2xl border border-[var(--border-color)]">
                                            <span className="block text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mb-1">Votes</span>
                                            <span className="text-sm font-bold text-[var(--text-primary)]">
                                                {(parseFloat(p.total_votes) / 1e12).toFixed(2)}T HP
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <a
                                            href={`https://peakd.com/proposals/${p.proposal_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-[var(--primary-color)] hover:underline flex items-center gap-1"
                                        >
                                            Read Proposal Details ↗
                                        </a>
                                    </div>
                                </div>
                            );
                        })}

                    {hasMoreProposals && proposalSearch === '' && (
                        <div className="py-4 text-center">
                            <button
                                onClick={() => fetchData(true)}
                                disabled={loadingMore}
                                className="px-8 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-all shadow-sm disabled:opacity-50"
                            >
                                {loadingMore ? 'Fetching More Proposals...' : 'Load More Proposals'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
