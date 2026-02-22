import { useState } from 'react';

interface CopyButtonProps {
    text: string;
    size?: 'sm' | 'md';
}

export function CopyButton({ text, size = 'md' }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
    const btnSize = size === 'sm' ? 'p-1' : 'p-1.5';

    return (
        <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            className={`${btnSize} rounded-lg transition-all ${copied
                    ? 'text-green-500 bg-green-500/10'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
                }`}
        >
            {copied ? (
                <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            )}
        </button>
    );
}
