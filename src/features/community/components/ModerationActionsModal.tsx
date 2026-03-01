import { useState } from 'react';
import { X, Pin, VolumeX, ShieldCheck, Settings } from 'lucide-react';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';

interface ModerationActionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    community: string;          // e.g. 'hive-106130'
    communityTitle?: string;
    userRole: string;           // viewer's role in this community
    // Post-level context (optional — when opened from a PostCard)
    postAuthor?: string;
    postPermlink?: string;
    isPinned?: boolean;
    // Community settings context (optional — when opened from community header)
    communityProps?: {
        title?: string;
        about?: string;
        description?: string;
        flag_text?: string;
        is_nsfw?: boolean;
    };
    onSuccess?: () => void;
    onPinChange?: (pinned: boolean) => void;
}

type ModTab = 'post' | 'user' | 'settings';

export function ModerationActionsModal({
    isOpen,
    onClose,
    community,
    communityTitle,
    userRole,
    postAuthor,
    postPermlink,
    isPinned = false,
    communityProps,
    onSuccess,
    onPinChange
}: ModerationActionsModalProps) {
    const { showNotification } = useNotification();
    const username = localStorage.getItem('hive_user') || '';

    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
    const isMod = userRole === 'mod' || isOwnerOrAdmin;

    const defaultTab: ModTab = postAuthor ? 'post' : 'settings';
    const [activeTab, setActiveTab] = useState<ModTab>(defaultTab);
    const [loading, setLoading] = useState(false);

    // Post actions state
    const pinned = isPinned;

    // Mute user state
    const [muteTarget, setMuteTarget] = useState(postAuthor || '');
    const [muteNotes, setMuteNotes] = useState('');

    // Set role state
    const [roleTarget, setRoleTarget] = useState('');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'mod' | 'member' | 'guest'>('member');

    // Community settings state
    const [settingsForm, setSettingsForm] = useState({
        title: communityProps?.title || '',
        about: communityProps?.about || '',
        description: communityProps?.description || '',
        flag_text: communityProps?.flag_text || '',
        is_nsfw: communityProps?.is_nsfw || false,
    });

    if (!isOpen || !isMod) return null;

    const broadcast = async (op: any) => {
        setLoading(true);
        try {
            const result = await transactionService.broadcast(op, () => {
                showNotification('Please sign with your Hive wallet', 'info');
            });
            if (result.success) {
                showNotification('Action completed successfully!', 'success');
                onSuccess?.();
                onClose();
            } else {
                showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (e: any) {
            showNotification(`Error: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const broadcastWithPinCallback = async (op: any) => {
        setLoading(true);
        try {
            const result = await transactionService.broadcast(op, () => {
                showNotification('Please sign with your Hive wallet', 'info');
            });
            if (result.success) {
                showNotification('Action completed successfully!', 'success');
                if (op.type === 'community_pin') {
                    onPinChange?.(op.pinned); // notify PostCard of new pin state
                }
                onSuccess?.();
                onClose();
            } else {
                showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (e: any) {
            showNotification(`Error: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePin = () => broadcastWithPinCallback({
        type: 'community_pin',
        username,
        community,
        account: postAuthor!,
        permlink: postPermlink!,
        pinned: !pinned
    });

    const handleMute = (mute: boolean) => {
        if (!muteTarget.trim()) return showNotification('Enter a username to mute', 'warning');
        broadcast({
            type: 'community_mute',
            username,
            community,
            account: muteTarget.trim().replace('@', ''),
            notes: muteNotes,
            mute
        });
    };

    const handleSetRole = () => {
        if (!roleTarget.trim()) return showNotification('Enter a username', 'warning');
        broadcast({
            type: 'community_set_role',
            username,
            community,
            account: roleTarget.trim().replace('@', ''),
            role: selectedRole
        });
    };

    const handleUpdateSettings = () => {
        broadcast({
            type: 'community_update',
            username,
            community,
            props: {
                title: settingsForm.title || undefined,
                about: settingsForm.about || undefined,
                description: settingsForm.description || undefined,
                flag_text: settingsForm.flag_text || undefined,
                is_nsfw: settingsForm.is_nsfw,
            }
        });
    };

    const inputClass = "w-full px-4 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10 outline-none transition-all";
    const btnClass = (color: string) => `px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 ${color}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-color)]">
                    <div>
                        <h2 className="font-black text-lg text-[var(--text-primary)]">Moderation</h2>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{communityTitle || community}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--bg-canvas)] text-[var(--text-secondary)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border-color)] px-2">
                    {postAuthor && isMod && (
                        <button onClick={() => setActiveTab('post')} className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeTab === 'post' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-[var(--text-secondary)]'}`}>
                            <Pin size={12} /> Post
                        </button>
                    )}
                    {isMod && (
                        <button onClick={() => setActiveTab('user')} className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeTab === 'user' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-[var(--text-secondary)]'}`}>
                            <VolumeX size={12} /> Users
                        </button>
                    )}
                    {isOwnerOrAdmin && (
                        <button onClick={() => setActiveTab('settings')} className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeTab === 'settings' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-[var(--text-secondary)]'}`}>
                            <Settings size={12} /> Settings
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="p-6 space-y-5">
                    {/* Post Actions */}
                    {activeTab === 'post' && postAuthor && (
                        <div className="space-y-4">
                            <div className="bg-[var(--bg-canvas)] rounded-2xl p-4 border border-[var(--border-color)]">
                                <p className="text-xs text-[var(--text-secondary)] mb-1 font-bold uppercase tracking-wider">Post by @{postAuthor}</p>
                                <p className="text-[10px] text-[var(--text-secondary)] opacity-60 font-mono truncate">{postPermlink}</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handlePin}
                                    disabled={loading}
                                    className={btnClass(pinned
                                        ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500 hover:text-white'
                                        : 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 hover:bg-[var(--primary-color)] hover:text-white'
                                    )}
                                >
                                    <Pin size={12} className="inline mr-1" />
                                    {pinned ? 'Unpin Post' : 'Pin Post'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* User Actions */}
                    {activeTab === 'user' && (
                        <div className="space-y-5">
                            {/* Mute / Unmute */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">Mute / Unmute User</label>
                                <input className={inputClass} placeholder="Username to mute..." value={muteTarget} onChange={e => setMuteTarget(e.target.value.toLowerCase().replace('@', ''))} />
                                <input className={`${inputClass} mt-2`} placeholder="Reason / notes (optional)" value={muteNotes} onChange={e => setMuteNotes(e.target.value)} />
                                <div className="flex gap-3 mt-3">
                                    <button onClick={() => handleMute(true)} disabled={loading || !muteTarget.trim()} className={btnClass('bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white')}>
                                        <VolumeX size={12} className="inline mr-1" /> Mute
                                    </button>
                                    <button onClick={() => handleMute(false)} disabled={loading || !muteTarget.trim()} className={btnClass('bg-[var(--bg-canvas)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]')}>
                                        Unmute
                                    </button>
                                </div>
                            </div>

                            {/* Set Role (admin+ only) */}
                            {isOwnerOrAdmin && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">Set User Role</label>
                                    <input className={inputClass} placeholder="Username..." value={roleTarget} onChange={e => setRoleTarget(e.target.value.toLowerCase().replace('@', ''))} />
                                    <select className={`${inputClass} mt-2`} value={selectedRole} onChange={e => setSelectedRole(e.target.value as any)}>
                                        <option value="admin">Admin</option>
                                        <option value="mod">Moderator</option>
                                        <option value="member">Member</option>
                                        <option value="guest">Guest (restricted)</option>
                                    </select>
                                    <button onClick={handleSetRole} disabled={loading || !roleTarget.trim()} className={`${btnClass('bg-purple-500/10 text-purple-500 border border-purple-500/20 hover:bg-purple-500 hover:text-white')} mt-3`}>
                                        <ShieldCheck size={12} className="inline mr-1" /> Set Role
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Community Settings */}
                    {activeTab === 'settings' && isOwnerOrAdmin && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Display Title</label>
                                <input className={inputClass} placeholder="Community display title..." value={settingsForm.title} onChange={e => setSettingsForm(s => ({ ...s, title: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">About (tagline)</label>
                                <input className={inputClass} placeholder="Short description..." value={settingsForm.about} onChange={e => setSettingsForm(s => ({ ...s, about: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Rules / Description</label>
                                <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Community rules or longer description..." value={settingsForm.description} onChange={e => setSettingsForm(s => ({ ...s, description: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Flag Text</label>
                                <input className={inputClass} placeholder="Text shown when a post is flagged..." value={settingsForm.flag_text} onChange={e => setSettingsForm(s => ({ ...s, flag_text: e.target.value }))} />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={settingsForm.is_nsfw} onChange={e => setSettingsForm(s => ({ ...s, is_nsfw: e.target.checked }))} className="w-4 h-4 accent-[var(--primary-color)]" />
                                <span className="text-sm font-bold text-[var(--text-primary)]">Mark community as NSFW</span>
                            </label>
                            <button onClick={handleUpdateSettings} disabled={loading} className={`${btnClass('bg-[var(--primary-color)] text-white shadow-md hover:brightness-110')} w-full mt-2`}>
                                {loading ? 'Saving...' : 'Save Community Settings'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
