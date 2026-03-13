import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCommunity } from '../../community/context/CommunityContext';
import { UnifiedDataService } from '../../../services/unified';
import { transactionService } from '../../wallet/services/transactionService';
import { useNotification } from '../../../contexts/NotificationContext';
import { CommunitySelector } from '../../community/components/CommunitySelector';
import { Capacitor } from '@capacitor/core';

export default function SettingsPage() {
    const { username: rawUsername } = useParams();
    const username = rawUsername?.startsWith('@') ? rawUsername.substring(1) : rawUsername;
    const { themeMode, toggleTheme } = useCommunity();
    const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'keys'>('profile');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { showNotification } = useNotification();

    // Profile Form State
    const [formData, setFormData] = useState({
        name: '',
        about: '',
        location: '',
        website: '',
        profile_image: '',
        cover_image: ''
    });

    const [currentUser] = useState<string | null>(localStorage.getItem('hive_user'));

    // QR Code for HiveAuth
    const [authWaitData, setAuthWaitData] = useState<{ qr: string, uuid: string } | null>(null);


    useEffect(() => {
        if (username) {
            loadProfile();
        }
    }, [username]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const data = await UnifiedDataService.getProfile(username!);
            if (data && data.metadata && data.metadata.profile) {
                const p = data.metadata.profile;
                setFormData({
                    name: p.name || '',
                    about: p.about || '',
                    location: (p as any).location || '', // Cast to any as location might be missing in type but present in data
                    website: p.website || '',
                    profile_image: p.profile_image || '',
                    cover_image: p.cover_image || ''
                });
            }
        } catch (e) {
            console.error("Failed to load profile", e);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        if (!currentUser || currentUser !== username) {
            showNotification("You can only edit your own profile.", 'warning');
            return;
        }

        setSaving(true);
        setAuthWaitData(null);

        try {
            const result = await transactionService.broadcast({
                type: 'profile_update',
                username: currentUser,
                profile: formData
            }, (challenge) => {
                setAuthWaitData(challenge);
            });

            if (result.success) {
                showNotification("Profile updated successfully! It may take a few moments to reflect.", 'success');
                setAuthWaitData(null);
            } else {
                showNotification("Failed to update profile: " + result.error, 'error');
                setAuthWaitData(null);
            }
        } catch (e: any) {
            showNotification("Error: " + e.message, 'error');
            setAuthWaitData(null);
        } finally {
            setSaving(false);
        }
    };

    if (!currentUser || currentUser !== username) {
        return (
            <div className="max-w-4xl mx-auto py-12 text-center text-[var(--text-secondary)]">
                You must be logged in as @{username} to view this page.
            </div>
        );
    }

    if (loading) {
        return <div className="p-12 text-center text-[var(--text-secondary)]">Loading settings...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <h1 className="text-3xl font-bold mb-8 text-[var(--text-primary)]">Settings</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="space-y-2">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'profile'
                            ? 'bg-[var(--primary-color)] text-white'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                            }`}
                    >
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('preferences')}
                        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'preferences'
                            ? 'bg-[var(--primary-color)] text-white'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                            }`}
                    >
                        Preferences
                    </button>
                    <button
                        onClick={() => setActiveTab('keys')}
                        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'keys'
                            ? 'bg-[var(--primary-color)] text-white'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                            }`}
                    >
                        Keys & Permissions
                    </button>
                    <button
                        onClick={() => setActiveTab('setup' as any)}
                        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab as any === 'setup'
                            ? 'bg-[var(--primary-color)] text-white'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                            }`}
                    >
                        App Setup
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-3">
                    {/* QR Code Modal Overlay for HAS */}
                    {authWaitData && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                            <div className="bg-[var(--bg-card)] p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-[var(--border-color)]">
                                <h3 className="text-xl font-bold mb-4">Confirm on Mobile</h3>
                                <div className="bg-white p-4 rounded-xl inline-block mb-4">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(authWaitData.qr)}`}
                                        alt="Scan to sign"
                                        className="w-48 h-48"
                                    />
                                </div>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Scan this with your Hive Keychain mobile app to approve the profile update.
                                </p>
                                <button
                                    onClick={() => setAuthWaitData(null)}
                                    className="mt-6 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Display Name */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                        placeholder="Display Name"
                                    />
                                </div>
                                {/* About */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">About</label>
                                    <input
                                        type="text"
                                        name="about"
                                        value={formData.about}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                        placeholder="Short bio..."
                                    />
                                </div>
                                {/* Profile Image */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Profile Image URL</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="profile_image"
                                            value={formData.profile_image}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                            placeholder="https://..."
                                        />
                                        {formData.profile_image && <img src={formData.profile_image} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-[var(--border-color)]" />}
                                    </div>
                                </div>
                                {/* Cover Image */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Cover Image URL</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="cover_image"
                                            value={formData.cover_image}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                            placeholder="https://..."
                                        />
                                        {formData.cover_image && <img src={formData.cover_image} alt="Preview" className="w-10 h-10 rounded-md object-cover border border-[var(--border-color)]" />}
                                    </div>
                                </div>
                                {/* Website */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Website</label>
                                    <input
                                        type="text"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                        placeholder="https://yourwebsite.com"
                                    />
                                </div>
                                {/* Location */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Location</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                        placeholder="City, Country"
                                    />
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:brightness-110 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Update Profile'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PREFERENCES TAB */}
                    {activeTab === 'preferences' && (
                        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Notification Alerts</h3>
                                    <select className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] appearance-none cursor-pointer">
                                        <option>Off</option>
                                        <option>On (All)</option>
                                        <option>Essential Only</option>
                                    </select>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Currency</h3>
                                    <select className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] appearance-none cursor-pointer">
                                        <option>Hive Dollar (HBD)</option>
                                        <option>USD</option>
                                        <option>EUR</option>
                                    </select>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Language</h3>
                                    <select className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] appearance-none cursor-pointer">
                                        <option>English</option>
                                        <option disabled>Spanish (Coming Soon)</option>
                                    </select>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Theme Settings</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-between">
                                            <span>{themeMode === 'dark' ? 'Night mode' : 'Day mode'}</span>
                                            <button
                                                onClick={toggleTheme}
                                                className="text-[var(--primary-color)] font-bold text-sm hover:underline"
                                            >
                                                Switch
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">NSFW Content</h3>
                                    <select className="w-full px-4 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] appearance-none cursor-pointer">
                                        <option>Hidden</option>
                                        <option>Shown</option>
                                        <option>Warn</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'keys' && (
                        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8">
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="md:w-1/3 text-center">
                                    <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-50 text-blue-500 rounded-full mb-4">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--text-primary)]">Keys & Permissions</h3>
                                </div>
                                <div className="md:w-2/3 space-y-4">
                                    <p className="text-[var(--text-secondary)] leading-relaxed">
                                        We cannot manage your keys directly. Please use your wallet provider (Hive Keychain, PeakLock, etc.) to manage your private keys and authorities.
                                    </p>

                                    <div className="flex gap-4 pt-4">
                                        <a href="https://hive-keychain.com" target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:brightness-110">
                                            Manage in Keychain
                                        </a>
                                        <a href="https://peakd.com" target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
                                            Manage Authorities
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* APP SETUP TAB (COMMUNITY SELECTOR) */}
                    {(activeTab as any) === 'setup' && (
                        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8">
                            <div className="max-w-xl">
                                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Switch Community</h3>
                                <p className="text-[var(--text-secondary)] mb-8">
                                    You are currently using the <strong>{Capacitor.isNativePlatform() ? 'Native App' : 'Web App'}</strong>.
                                    By default, it loads the Global instance, but you can search for and select a specific community to set as your default view.
                                </p>

                                <CommunitySelector />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
