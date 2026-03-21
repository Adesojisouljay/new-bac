import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export interface HiveMarkdownProps {
    content: string;
    className?: string;
    isProse?: boolean;
    components?: any; // For custom component overrides
}

const CodeBlockRenderer = ({ children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    
    // Safely extract text nodes mathematically from the deep React tree
    const extractText = (node: any): string => {
        if (!node) return '';
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node.props && node.props.children) {
            return extractText(node.props.children);
        }
        return '';
    };

    const textToCopy = extractText(children);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-6 rounded-2xl overflow-hidden shadow-xl border border-[var(--border-color)]/30 ring-1 ring-white/5 bg-[#1e2329] group relative">
            <div className="pl-4 pr-1 py-1.5 bg-[#2c323c] flex items-center justify-between border-b border-black/20">
                <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Copy to clipboard"
                >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span className="text-xs font-semibold hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <div className="p-4 overflow-x-auto custom-scrollbar">
                <pre className="text-sm font-mono text-[#d1d5db] leading-relaxed m-0" {...props}>
                    {children}
                </pre>
            </div>
        </div>
    );
};

const HiveMarkdown: React.FC<HiveMarkdownProps> = ({ content, className = '', components, isProse = true }) => {

    // Pre-process Hive body to handle common Hive-specific cases safely line-by-line
    const preprocessContent = (raw: string) => {
        if (!raw) return '';
        let processed = raw.replace(/\r\n/g, '\n');

        // 1. Fix multiline markdown link breaks: `![alt]\n(url)` -> `![alt](url)`
        processed = processed.replace(/\]\s*\n+\s*\(/g, '](');

        // 2. Fix trailing whitespace/newlines inside markdown link parentheses: `[alt](url \n )` -> `[alt](url)`
        processed = processed.replace(/\]\(\s*([^\s\)]+)\s*\n+\s*\)/g, ']($1)');

        // 3. Ensure HTML block elements have blank lines around them so Markdown is parsed inside them
        processed = processed.replace(/(<\/?(?:center|div|section|article)[^>]*>)/gi, '\n\n$1\n\n');

        const seenEmbedIds = new Set<string>();
        const lines = processed.split('\n');

        let insideCodeBlock = false;

        const newLines = lines.map(line => {
            let currentLine = line;

            // Track if we are inside a fenced markdown code block
            if (currentLine.trim().startsWith('```')) {
                insideCodeBlock = !insideCodeBlock;
                return currentLine;
            }

            // Skip all internal regex replacements if inside a code block
            if (insideCodeBlock) {
                return currentLine;
            }

            // Handle @username mentions
            currentLine = currentLine.replace(/(^|\s)@([a-z0-9.-]+[a-z0-9])/gi, (match, space, username) => {
                if (username.length >= 3 && username.length <= 16) {
                    return `${space}[@${username}](/profile/${username})`;
                }
                return match;
            });

            // Handle raw URLs (auto-embed or auto-link)
            const urlRegex = /(^|[\s>\n])(https?:\/\/[^\s<"'\(\)\]]+)/gi;
            currentLine = currentLine.replace(urlRegex, (_match, prefix, rawUrl) => {
                let trailingPunctuation = '';
                const url = rawUrl.replace(/[.,!?;:]+$/, (punct: string) => {
                    trailingPunctuation = punct;
                    return '';
                });

                let replacement = '';

                // 1. Images
                if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)) {
                    replacement = `![image](${url})`;
                } 
                // 2. Videos
                else {
                    const ytId = getYouTubeId(url);
                    const tsId = getThreeSpeakId(url);
                    const embedId = ytId || tsId;

                    if (embedId) {
                        if (!seenEmbedIds.has(embedId)) {
                            seenEmbedIds.add(embedId);
                            replacement = `[embedded-video](${url})`;
                        } else {
                            replacement = `[${url}](${url})`;
                        }
                    } 
                    // 3. Audio
                    else if (/\.(mp3|wav|ogg|m4a)(\?.*)?$/i.test(url)) {
                        if (!seenEmbedIds.has(url)) {
                            seenEmbedIds.add(url);
                            replacement = `[embedded-audio](${url})`;
                        } else {
                            replacement = `[${url}](${url})`;
                        }
                    } 
                    // 4. Fallback link
                    else {
                        replacement = `[${url}](${url})`;
                    }
                }

                return `${prefix}${replacement}${trailingPunctuation}`;
            });

            return currentLine;
        });

        return newLines.join('\n');
    };

    const processedContent = preprocessContent(content);

    // YouTube handling
    function getYouTubeId(url: string) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // 3Speak handling
    function getThreeSpeakId(url: string) {
        const regex = /(?:3speak\.tv\/watch\?v=|3speak\.tv\/embed\?v=|play\.3speak\.tv\/watch\?v=)([\w-]+\/[\w-]+)/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // Audio handling
    const isAudioUrl = (url: string) => {
        return /\.(mp3|wav|ogg|m4a)$/i.test(url);
    };

    const renderers = {
        p: ({ children }: any) => <p className="mb-6 leading-relaxed last:mb-0">{children}</p>,
        h1: ({ children }: any) => <h1 className="text-3xl font-bold mt-10 mb-6 text-[var(--text-primary)]">{children}</h1>,
        h2: ({ children }: any) => <h2 className="text-2xl font-bold mt-8 mb-4 text-[var(--text-primary)]">{children}</h2>,
        h3: ({ children }: any) => <h3 className="text-xl font-bold mt-6 mb-3 text-[var(--text-primary)]">{children}</h3>,
        ul: ({ children }: any) => <ul className="list-disc ml-6 mb-6 space-y-2">{children}</ul>,
        ol: ({ children }: any) => <ol className="list-decimal ml-6 mb-6 space-y-2">{children}</ol>,
        li: ({ children }: any) => <li className="text-[var(--text-primary)]">{children}</li>,
        blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-[var(--primary-color)] pl-4 py-2 my-6 italic bg-[var(--bg-canvas)] rounded-r-lg">
                {children}
            </blockquote>
        ),
        a: ({ href, children, ...props }: any) => {
            if (!href) return <a {...props}>{children}</a>;

            // Only embed if we specifically tagged it as an embed in the preprocessor
            const isEmbed = children?.toString() === 'embedded-video' || children?.toString() === 'embedded-audio';

            // Check for YouTube
            const ytId = getYouTubeId(href);
            if (ytId && isEmbed) {
                return (
                    <div className="video-container my-8 rounded-2xl shadow-2xl bg-black ring-1 ring-white/10 group aspect-video">
                        <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="speak-iframe w-full h-full"
                        />
                    </div>
                );
            }

            // Check for 3Speak
            const tsId = getThreeSpeakId(href);
            if (tsId && isEmbed) {
                return (
                    <div className="video-container my-8 rounded-2xl shadow-2xl bg-black ring-1 ring-white/10 group mx-auto max-w-full overflow-hidden">
                        {/* We use a flexible height container to avoid forcing portrait videos into landscape ratios */}
                        <div className="flex justify-center items-center bg-black min-h-[300px] md:min-h-[450px] relative">
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://play.3speak.tv/watch?v=${tsId}&mode=iframe`}
                                frameBorder="0"
                                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="speak-iframe absolute inset-0 w-full h-full"
                                style={{ objectFit: 'contain' }}
                            />
                        </div>
                    </div>
                );
            }

            // Check for Audio
            if (isAudioUrl(href) && isEmbed) {
                return (
                    <div className="my-6 bg-[var(--bg-canvas)] p-6 rounded-2xl border border-[var(--border-color)] shadow-xl ring-1 ring-white/5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-[var(--primary-color)]/10 rounded-lg">
                                <span className="text-[var(--primary-color)] font-bold text-xs uppercase tracking-widest">Audio</span>
                            </div>
                        </div>
                        <audio controls className="w-full">
                            <source src={href} />
                            Your browser does not support the audio element.
                        </audio>
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--primary-color)] mt-3 inline-block hover:underline font-bold">
                            Source Link
                        </a>
                    </div>
                );
            }

            return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline font-bold transition-all" {...props}>
                    {children}
                </a>
            );
        },
        img: ({ src, alt, ...props }: any) => {
            return (
                <div className="my-8 group relative rounded-2xl overflow-hidden">
                    <img
                        src={src}
                        alt={alt || ''}
                        className="rounded-2xl shadow-xl border border-[var(--border-color)] max-w-full h-auto mx-auto group-hover:scale-[1.01] transition-all bg-[var(--bg-canvas)]"
                        loading="lazy"
                        {...props}
                    />
                </div>
            );
        },
        pre: CodeBlockRenderer,
        code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const text = String(children || '').replace(/\n$/, '');
            
            // Auto-link URLs wrapped in backticks (e.g. `https://api.fake.openhive.network`)
            if (inline && /^https?:\/\/[^\s]+$/.test(text)) {
                return (
                    <a href={text} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline font-bold transition-all bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)]/30 break-all text-[0.85em] font-mono">
                        {text}
                    </a>
                );
            }
            if (!inline) {
                return (
                    <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match ? match[1] : 'text'}
                        PreTag="div"
                        CodeTag="span"
                        customStyle={{
                            background: 'transparent',
                            padding: 0,
                            margin: 0,
                            fontSize: '0.875rem'
                        }}
                        {...props}
                    >
                        {text}
                    </SyntaxHighlighter>
                );
            }
            // Standard inline code ticks
            return (
                <code className={`bg-[var(--bg-card)] px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-[var(--border-color)]/30 text-[var(--text-secondary)] ${className || ''}`} {...props}>
                    {children}
                </code>
            );
        }
    };

    const mergedComponents = {
        ...renderers,
        ...(components || {})
    };

    return (
        <div className={`hive-markdown-content overflow-hidden ${isProse ? 'prose-lg dark:prose-invert max-w-none' : ''} ${className}`}>
            <style dangerouslySetInnerHTML={{
                __html: `
                .hive-markdown-content center {
                    display: block;
                    text-align: center;
                    margin: 1.5rem 0;
                }
                .hive-markdown-content .pull-left {
                    float: left;
                    margin-right: 1.5rem;
                    margin-bottom: 1rem;
                    max-width: 45%;
                }
                .hive-markdown-content .pull-right {
                    float: right;
                    margin-left: 1.5rem;
                    margin-bottom: 1rem;
                    max-width: 45%;
                }
                .hive-markdown-content .text-justify {
                    text-align: justify;
                }
                .hive-markdown-content .phish-warning {
                    display: none;
                }
                .hive-markdown-content hr {
                    margin: 2rem 0;
                    border-color: var(--border-color);
                    opacity: 0.3;
                }
                /* Robust Video Scaling Fix */
                .hive-markdown-content iframe {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: contain !important;
                    border: none !important;
                    background: black !important;
                    display: block !important;
                }
                .hive-markdown-content .video-container {
                    position: relative;
                    width: 100%;
                    background: black;
                    overflow: hidden;
                }
                /* Prevent duplicates if they have special classes from other renderers */
                .hive-markdown-content a[href*="3speak.tv"] img,
                .hive-markdown-content a[href*="youtube.com"] img {
                    display: none;
                }
            `}} />
            <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={mergedComponents}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
};

export default HiveMarkdown;
