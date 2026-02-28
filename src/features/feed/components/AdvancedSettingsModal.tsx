import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Save, History, Settings } from 'lucide-react';

interface Beneficiary {
    account: string;
    weight: number; // 0-10000 (e.g. 1000 = 10%)
}

export interface Draft {
    id: string;
    title: string;
    body: string;
    tags: string;
    lastUpdated: number;
    scheduledAt?: number;
}

export interface AdvancedOptions {
    reward: 'default' | 'power_up' | 'decline';
    beneficiaries: Beneficiary[];
    description: string;
}

interface AdvancedSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    options: AdvancedOptions;
    onSave: (options: AdvancedOptions) => void;
    // Drafts & Scheduling Props
    drafts: Draft[];
    onLoadDraft: (draft: Draft) => void;
    onSaveDraft: () => void;
    onDeleteDraft: (id: string) => void;
    scheduledDate: string;
    onScheduledDateChange: (date: string) => void;
}

export default function AdvancedSettingsModal({
    isOpen,
    onClose,
    options,
    onSave,
    drafts,
    onLoadDraft,
    onSaveDraft,
    onDeleteDraft,
    scheduledDate,
    onScheduledDateChange
}: AdvancedSettingsModalProps) {
    const [localOptions, setLocalOptions] = useState<AdvancedOptions>(options);
    const [newBeneficiary, setNewBeneficiary] = useState({ account: '', weight: 0 });

    // Sync when opening
    useEffect(() => {
        if (isOpen) setLocalOptions(options);
    }, [isOpen, options]);

    const handleSave = () => {
        onSave(localOptions);
        onClose();
    };

    const addBeneficiary = () => {
        if (!newBeneficiary.account || newBeneficiary.weight <= 0) return;

        setLocalOptions({
            ...localOptions,
            beneficiaries: [...localOptions.beneficiaries, {
                account: newBeneficiary.account.trim().toLowerCase(),
                weight: newBeneficiary.weight * 100 // Convert % to basis points
            }]
        });
        setNewBeneficiary({ account: '', weight: 0 });
    };

    const removeBeneficiary = (index: number) => {
        const newBeneficiaries = [...localOptions.beneficiaries];
        newBeneficiaries.splice(index, 1);
        setLocalOptions({ ...localOptions, beneficiaries: newBeneficiaries });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--primary-color)]/10 rounded-xl">
                            <Settings size={22} className="text-[var(--primary-color)]" />
                        </div>
                        <h2 className="text-xl font-black text-[var(--text-primary)]">Post Settings</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Post Options */}
                        <div className="space-y-8">
                            {/* Scheduling Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                                    <Calendar size={16} className="text-[var(--primary-color)]" />
                                    Publishing schedule
                                </h3>
                                <div className="p-4 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-color)] hover:border-[var(--primary-color)]/30 transition-all">
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Target Date</label>
                                    <input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={(e) => onScheduledDateChange(e.target.value)}
                                        className="w-full bg-transparent text-[var(--text-primary)] font-bold outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                    <p className="text-[10px] text-[var(--text-secondary)] mt-2 italic">Leave empty to publish immediately.</p>
                                </div>
                            </div>

                            {/* Reward Selection */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">Rewards</h3>
                                <select
                                    value={localOptions.reward}
                                    onChange={(e) => setLocalOptions({ ...localOptions, reward: e.target.value as any })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition-all"
                                >
                                    <option value="default">Default (50% HBD / 50% HP)</option>
                                    <option value="power_up">Power Up (100% HP)</option>
                                    <option value="decline">Decline Payout</option>
                                </select>
                            </div>

                            {/* Short Description */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">Search Description</h3>
                                <textarea
                                    value={localOptions.description}
                                    onChange={(e) => setLocalOptions({ ...localOptions, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium outline-none focus:ring-1 focus:ring-[var(--primary-color)] min-h-[100px] text-sm leading-relaxed"
                                    placeholder="Enter a short summary for search engines..."
                                />
                            </div>
                        </div>

                        {/* Right Column: Drafts & Beneficiaries */}
                        <div className="space-y-8">
                            {/* Drafts Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                                        <History size={16} className="text-[var(--primary-color)]" />
                                        My Drafts
                                    </h3>
                                    <button
                                        onClick={onSaveDraft}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full text-[10px] font-black hover:bg-[var(--primary-color)]/20 transition-all uppercase tracking-tighter"
                                    >
                                        <Save size={12} />
                                        Save Current
                                    </button>
                                </div>

                                <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                    {drafts.length === 0 ? (
                                        <div className="p-8 text-center bg-[var(--bg-canvas)] rounded-2xl border border-dashed border-[var(--border-color)]">
                                            <p className="text-xs text-[var(--text-secondary)] italic">No saved drafts yet.</p>
                                        </div>
                                    ) : (
                                        drafts.map(d => (
                                            <div key={d.id} className="group relative p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-color)] hover:border-[var(--primary-color)] transition-all cursor-pointer shadow-sm overflow-hidden" onClick={() => onLoadDraft(d)}>
                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-[var(--primary-color)] scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0 pr-8">
                                                        <h4 className="font-bold text-sm truncate text-[var(--text-primary)]">{d.title || '(No Title)'}</h4>
                                                        <p className="text-[10px] text-[var(--text-secondary)] font-medium opacity-70 mt-0.5">
                                                            {new Date(d.lastUpdated).toLocaleDateString()} at {new Date(d.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDeleteDraft(d.id); }}
                                                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Delete Draft"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Beneficiaries Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">Beneficiaries</h3>
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Account name"
                                            value={newBeneficiary.account}
                                            onChange={(e) => setNewBeneficiary({ ...newBeneficiary, account: e.target.value.toLowerCase() })}
                                            className="flex-1 px-4 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition-all"
                                        />
                                        <div className="relative w-20">
                                            <input
                                                type="number"
                                                placeholder="%"
                                                min="1"
                                                max="100"
                                                value={newBeneficiary.weight || ''}
                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, weight: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold outline-none focus:ring-1 focus:ring-[var(--primary-color)] pr-6"
                                            />
                                            <span className="absolute right-3 top-2.5 text-[var(--text-secondary)] text-xs font-bold">%</span>
                                        </div>
                                        <button
                                            onClick={addBeneficiary}
                                            disabled={!newBeneficiary.account || newBeneficiary.weight <= 0}
                                            className="bg-[var(--primary-color)] text-white p-2.5 rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {localOptions.beneficiaries.map((b, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-[var(--bg-canvas)]/50 px-3 py-2 rounded-xl border border-[var(--border-color)] group hover:border-red-500/30 transition-all">
                                                <span className="flex-1 font-bold text-xs text-[var(--text-primary)]">@{b.account}</span>
                                                <span className="text-xs font-black text-[var(--primary-color)]">{b.weight / 100}%</span>
                                                <button onClick={() => removeBeneficiary(i)} className="text-[var(--text-secondary)] hover:text-red-500 p-1 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex justify-end gap-3 sticky bottom-0">
                    <button onClick={onClose} className="px-6 py-2 content-center font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] rounded-xl transition-all">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-[var(--primary-color)] text-white font-black rounded-xl hover:brightness-110 shadow-xl transition-all active:scale-95">
                        Apply Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
