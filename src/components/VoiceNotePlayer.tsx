import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceNotePlayerProps {
    src: string;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Use Web Audio API to decode the audio and get the real duration,
    // bypassing the broken WebM metadata from MediaRecorder.
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setDuration(null);

        fetch(src)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const ctx = new AudioContext();
                return ctx.decodeAudioData(buffer).then(audioBuffer => {
                    if (!cancelled) {
                        setDuration(audioBuffer.duration);
                        setIsLoading(false);
                    }
                    ctx.close();
                });
            })
            .catch(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [src]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
    }, [isPlaying]);

    const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime ?? 0);
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audio.currentTime = ratio * duration;
    };

    const progress = duration ? (currentTime / duration) * 100 : 0;
    const displayDuration = duration ?? 0;

    return (
        <div className="flex items-center gap-3 py-2 px-1 min-w-[220px]">
            {/* Hidden native audio element for actual playback */}
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Play / Pause Button */}
            <button
                onClick={togglePlay}
                disabled={isLoading}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/20 hover:bg-white/30 active:scale-95 transition-all disabled:opacity-50"
                aria-label={isPlaying ? 'Pause' : 'Play'}
            >
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                    // Pause icon
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    // Play icon
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white ml-0.5">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </button>

            {/* Progress + time */}
            <div className="flex-1 flex flex-col gap-1">
                {/* Progress bar */}
                <div
                    className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer relative overflow-hidden"
                    onClick={handleSeek}
                >
                    <div
                        className="h-full bg-white/80 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                {/* Time */}
                <div className="flex justify-between text-[10px] text-white/60">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(displayDuration)}</span>
                </div>
            </div>
        </div>
    );
};
