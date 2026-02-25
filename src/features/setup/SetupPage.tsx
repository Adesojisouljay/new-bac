import React, { useState } from 'react';
import { useConfig } from '../../contexts/ConfigContext';
import { toast } from 'react-hot-toast';

export function SetupPage() {
    const { config, updateConfig } = useConfig();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        communityName: config?.communityName || '',
        hiveCommunityId: config?.hiveCommunityId || '',
        logoUrl: config?.logoUrl || '',
        primaryColor: config?.primaryColor || '#ff4400',
        onboardingSats: config?.onboardingSats || 100,
        communityDescription: config?.communityDescription || 'A decentralized community powered by Breakaway.',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const success = await updateConfig(formData);
            if (success) {
                toast.success('Community configured successfully!');
            } else {
                toast.error('Failed to save configuration. Please try again.');
            }
        } catch (error) {
            toast.error('An error occurred during setup.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-6">
            <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2.5rem] shadow-2xl p-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
                        Welcome to <span className="text-[var(--primary-color)]">Breakaway</span>
                    </h1>
                    <p className="text-[var(--text-secondary)] text-lg">
                        Let's configure your community in seconds. No code required.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 ml-1">
                                Community Name
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. Hive Tech Talk"
                                value={formData.communityName}
                                onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
                                className="w-full px-5 py-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 ml-1">
                                Community Description (SEO)
                            </label>
                            <textarea
                                placeholder="Describe your community for social sharing and search engines..."
                                value={formData.communityDescription}
                                onChange={(e) => setFormData({ ...formData, communityDescription: e.target.value })}
                                className="w-full px-5 py-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none min-h-[100px] resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 ml-1">
                                Hive Community ID
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. hive-123456"
                                value={formData.hiveCommunityId}
                                onChange={(e) => setFormData({ ...formData, hiveCommunityId: e.target.value.toLowerCase() })}
                                className="w-full px-5 py-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 ml-1">
                                Logo URL (Optional)
                            </label>
                            <input
                                type="url"
                                placeholder="https://example.com/logo.png"
                                value={formData.logoUrl}
                                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                className="w-full px-5 py-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 ml-1">
                                    Brand Color
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="w-14 h-14 p-1 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="flex-1 px-4 py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-sm uppercase"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 ml-1">
                                    Onboarding Fee (Sats)
                                </label>
                                <input
                                    type="number"
                                    value={formData.onboardingSats}
                                    onChange={(e) => setFormData({ ...formData, onboardingSats: parseInt(e.target.value) })}
                                    className="w-full px-5 py-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 bg-[var(--primary-color)] text-white font-black text-lg rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-[var(--primary-color)]/25 flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>Launch Community</span>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">
                    Powered by Breakaway Infrastructure
                </p>
            </div>
        </div>
    );
}
