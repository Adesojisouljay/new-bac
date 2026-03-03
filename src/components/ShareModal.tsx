import React, { useState } from 'react';
import { X, Copy, Check, Twitter, Linkedin, MessageCircle, Share2 } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, url, title }) => {
    const [copied, setCopied] = useState(false);
    const { showNotification } = useNotification();

    if (!isOpen) return null;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        showNotification("Link copied to clipboard!", 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const sharePlatforms = [
        {
            name: 'Twitter',
            icon: <Twitter size={20} />,
            color: 'bg-[#1DA1F2]',
            url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
        },
        {
            name: 'WhatsApp',
            icon: <MessageCircle size={20} />,
            color: 'bg-[#25D366]',
            url: `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
        },
        {
            name: 'LinkedIn',
            icon: <Linkedin size={20} />,
            color: 'bg-[#0077B5]',
            url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        },
        {
            name: 'Reddit',
            icon: <div className="font-bold">r/</div>,
            color: 'bg-[#FF4500]',
            url: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
        },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
                onClick={onClose}
            />
            <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in">
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-canvas)]/50">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Share2 size={18} className="text-[var(--primary-color)]" />
                        Share Post
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--bg-canvas)] rounded-full transition-colors text-[var(--text-secondary)]"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Copy Link Section */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold">Copy Link</label>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-secondary)] truncate">
                                {url}
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className={`p-2.5 rounded-xl transition-all border ${copied ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-[var(--primary-color)] border-transparent text-white hover:opacity-90 active:scale-95'}`}
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Social Grid */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold">Social Platforms</label>
                        <div className="grid grid-cols-2 gap-3">
                            {sharePlatforms.map(platform => (
                                <a
                                    key={platform.name}
                                    href={platform.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-canvas)] hover:shadow-md transition-all group border border-[var(--border-color)] hover:border-[var(--primary-color)]/30"
                                >
                                    <div className={`w-8 h-8 rounded-lg ${platform.color} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                                        {platform.icon}
                                    </div>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">{platform.name}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="text-[10px] text-center text-[var(--text-secondary)] italic opacity-60">
                        Tip: You can also copy/paste to Discord or Slack!
                    </div>
                </div>
            </div>
        </div>
    );
};
