import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface Beneficiary {
    account: string;
    weight: number; // 0-10000 (e.g. 1000 = 10%)
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
}

export default function AdvancedSettingsModal({ isOpen, onClose, options, onSave }: AdvancedSettingsModalProps) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Advanced Settings</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Reward Selection */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Reward</label>
                        <select
                            value={localOptions.reward}
                            onChange={(e) => setLocalOptions({ ...localOptions, reward: e.target.value as any })}
                            className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                        >
                            <option value="default">Default (50% HBD / 50% HP)</option>
                            <option value="power_up">Power Up (100% HP)</option>
                            <option value="decline">Decline Payout</option>
                        </select>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Set how you want to receive your rewards.
                        </p>
                    </div>

                    {/* Beneficiaries */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Beneficiaries</label>

                        <div className="space-y-3 mb-3">
                            {localOptions.beneficiaries.map((b, i) => (
                                <div key={i} className="flex items-center gap-2 bg-[var(--bg-canvas)] p-2 rounded-lg border border-[var(--border-color)]">
                                    <span className="flex-1 font-medium text-[var(--text-primary)]">@{b.account}</span>
                                    <span className="text-sm text-[var(--text-secondary)]">{b.weight / 100}%</span>
                                    <button onClick={() => removeBeneficiary(i)} className="text-red-500 hover:bg-red-500/10 p-1 rounded">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Username"
                                value={newBeneficiary.account}
                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, account: e.target.value })}
                                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                            />
                            <div className="relative w-24">
                                <input
                                    type="number"
                                    placeholder="%"
                                    min="1"
                                    max="100"
                                    value={newBeneficiary.weight || ''}
                                    onChange={(e) => setNewBeneficiary({ ...newBeneficiary, weight: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-color)] pr-6"
                                />
                                <span className="absolute right-3 top-2.5 text-[var(--text-secondary)] text-sm">%</span>
                            </div>
                            <button
                                onClick={addBeneficiary}
                                disabled={!newBeneficiary.account || newBeneficiary.weight <= 0}
                                className="bg-[var(--primary-color)] text-white p-2 rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Share your rewards with other accounts.
                        </p>
                    </div>

                    {/* Short Description */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Short Description</label>
                        <textarea
                            value={localOptions.description}
                            onChange={(e) => setLocalOptions({ ...localOptions, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-color)] min-h-[100px]"
                            placeholder="Enter a short summary for search engines..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-6 py-2 bg-[var(--primary-color)] text-white font-bold rounded-lg hover:brightness-110 shadow-md">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
