import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface HiveMarkdownProps {
    content: string;
    className?: string;
    components?: any;
    isProse?: boolean;
}

const HiveMarkdown: React.FC<HiveMarkdownProps> = ({ content, className = '', components, isProse = true }) => {

    // Pre-process Hive body to handle common Hive-specific cases safely line-by-line
    const preprocessContent = (raw: string) => {
        if (!raw) return '';
        let processed = raw.replace(/\r\n/g, '\n');

        const seenEmbedIds = new Set<string>();
        const lines = processed.split('\n');

        const newLines = lines.map(line => {
            const trimmed = line.trim();
            // Handle standalone URLs or Markdown links (optionally wrapped in <center> tags)
            // Group 1: Optional <center>, Group 2: Markdown Label (optional), Group 3: URL, Group 4: Optional </center>
            const standaloneMatch = trimmed.match(/^(?:<center>)?\s*(?:\[(.*?)\])?\(?(https?:\/\/[^\s\(\)\[\]"']+)\)?\s*(?:<\/center>)?$/i);

            if (standaloneMatch) {
                const url = standaloneMatch[2];
                const isCenter = trimmed.toLowerCase().startsWith('<center>');

                let replacement = '';
                // 1. Images
                if (/\.(png|jpe?g|gif|webp|svg)$/i.test(url)) {
                    replacement = `![image](${url})`;
                }
                // 2. Videos (YouTube, 3Speak)
                else if (/(youtube\.com|youtu\.be|3speak\.tv|play\.3speak\.tv)/i.test(url)) {
                    const ytId = getYouTubeId(url);
                    const tsId = getThreeSpeakId(url);
                    const embedId = ytId || tsId;

                    // Deduplicate: Only embed the first instance of a video ID
                    if (embedId && !seenEmbedIds.has(embedId)) {
                        seenEmbedIds.add(embedId);
                        replacement = `[embedded-video](${url})`;
                    }
                }
                // 3. Audio files
                else if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) {
                    if (!seenEmbedIds.has(url)) {
                        seenEmbedIds.add(url);
                        replacement = `[embedded-audio](${url})`;
                    }
                }

                if (replacement) {
                    return isCenter ? `<center>${replacement}</center>` : replacement;
                }
            }
            return line;
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
