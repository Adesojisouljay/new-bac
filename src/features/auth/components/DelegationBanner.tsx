import React, { useState, useEffect } from 'react';
import { authService, accountManager } from '../services/authService';
import { QRCodeSVG } from 'qrcode.react';
import { useCommunity } from '../../community/context/CommunityContext';

export const DelegationBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [needsTokenOnly, setNeedsTokenOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasQR, setHasQR] = useState<string | null>(null);
    const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    const [debugForced, setDebugForced] = useState(false);

    const { config } = useCommunity();
    const communityId = config?.id || 'global';

    useEffect(() => {
        (window as any).forceShowDelegationBanner = () => {
            console.log("Forcing delegation banner visibility...");
            setDebugForced(true);
            setIsVisible(true);
        };
    }, []);

    const [activeUser, setActiveUser] = useState<string | null>(accountManager.getActive());

    useEffect(() => {
        const handleStorageChange = () => {
            const current = accountManager.getActive();
            if (current !== activeUser) {
                console.log("DelegationBanner: Storage change detected, new user:", current);
                setActiveUser(current);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Also listen for custom login events if the app emits them
        const interval = setInterval(handleStorageChange, 500);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [activeUser]);

    useEffect(() => {
        const checkStatus = async () => {
            console.log("DelegationBanner: Checking status for", activeUser);
            if (!activeUser) {
                setIsVisible(false);
                return;
            }

            // Check if dismissed for this session
            const dismissed = sessionStorage.getItem(`delegation_dismissed_${activeUser}`);
            console.log("DelegationBanner: Dismissed state:", dismissed);
            if (dismissed) {
                setIsVisible(false);
                return;
            }

            if (debugForced) {
                setIsVisible(true);
                return;
            }

            try {
                const isDelegated = await authService.checkDelegation(activeUser);
                const hasToken = !!localStorage.getItem('breakaway_token');
                console.log("DelegationBanner: Status - isDelegated:", isDelegated, "hasToken:", hasToken);

                setNeedsTokenOnly(isDelegated && !hasToken);
                // Show if either is missing
                setIsVisible(!isDelegated || !hasToken);
            } catch (err) {
                console.error("Failed to check delegation status:", err);
            }
        };

        checkStatus();
    }, [activeUser, debugForced]);

    const handleEnableNow = async () => {
        if (!activeUser) return;
        setLoading(true);
        setError(null);

        try {
            const method = localStorage.getItem('hive_auth_method') as 'keychain' | 'hiveauth' || 'keychain';
            const community = communityId;

            if (needsTokenOnly) {
                console.log("DelegationBanner: Delegation already active, requesting points token only...");
                const { pointsService } = await import('../../../services/pointsService');
                const pResult = await pointsService.loginToPointsBackend(
                    activeUser,
                    community,
                    method,
                    undefined,
                    (data: { qr: string; uuid: string }) => {
                        console.log("DelegationBanner: Received Points Auth QR");
                        setHasQR(data.qr);
                        if (isMobile && data.qr) {
                            window.location.href = data.qr;
                        }
                    }
                );
                if (pResult) {
                    setIsVisible(false);
                    sessionStorage.setItem(`delegation_dismissed_${activeUser}`, 'true');
                    return;
                } else {
                    setError("Failed to authorize points system.");
                    return;
                }
            }

            console.log("DelegationBanner: Starting delegation with method:", method);
            let existingSession = null;

            if (method === 'hiveauth') {
                const stored = localStorage.getItem('hive_auth_session');
                if (stored) {
                    existingSession = JSON.parse(stored);
                }
            }

            const result = await authService.authorizeRelay(
                activeUser,
                method,
                (data: { qr: string; uuid: string }) => {
                    console.log("DelegationBanner: Received QR/Challenge");
                    setHasQR(data.qr);
                    if (isMobile && data.qr) {
                        window.location.href = data.qr;
                    }
                },
                existingSession
            );

            console.log("DelegationBanner: Authorization result:", result);

            if (result.success) {
                console.log("DelegationBanner: Authorization successful, finalizing...");
                setIsVisible(false);
                // Mark as dismissed so it doesn't pop up again immediately if state hasn't synced
                sessionStorage.setItem(`delegation_dismissed_${activeUser}`, 'true');

                // Immediately get a points token so relay works without logout/login
                try {
                    const { pointsService } = await import('../../../services/pointsService');
                    const community = communityId;
                    console.log("DelegationBanner: Requesting points token for relay...");
                    await pointsService.loginToPointsBackend(activeUser, community, method);
                } catch (pe) {
                    console.error("DelegationBanner: Failed to acquire points token:", pe);
                }
            } else {
                setError(result.error || "Authorization failed");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        if (activeUser) {
            sessionStorage.setItem(`delegation_dismissed_${activeUser}`, 'true');
        }
        setIsVisible(false);
    };

    if (!isVisible || !activeUser) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="relative bg-[var(--bg-card)] border-2 border-[var(--primary-color)]/30 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 backdrop-blur-xl bg-opacity-95">
                {/* Close Button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded-full transition-all"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Icon/Visual */}
                    <div className="hidden md:flex w-16 h-16 bg-[var(--primary-color)]/10 rounded-2xl items-center justify-center text-[var(--primary-color)] flex-shrink-0 animate-pulse">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-2">
                        <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center justify-center md:justify-start gap-2">
                            {needsTokenOnly ? "Last Step: Authorize Points" : "Enable One-Tap Posting"} 🚀
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {needsTokenOnly
                                ? "Delegation complete! Now just one final 'Verify Key' prompt to authorize your reward points."
                                : "Grant breakaway.app posting authority once, then post and vote instantly without any more prompts."
                            }
                        </p>
                    </div>

                    {/* Actions */}
                    {!hasQR ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={handleEnableNow}
                                disabled={loading}
                                className="w-full sm:w-auto px-8 py-3.5 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--primary-color)]/20 flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {needsTokenOnly ? "Authorize Points" : "Enable Now"}
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="w-full sm:w-auto px-6 py-3.5 bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold rounded-2xl hover:text-[var(--text-primary)] transition-all"
                            >
                                Not Now
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                            <div className="p-3 bg-white rounded-2xl shadow-xl">
                                <QRCodeSVG value={hasQR} size={120} level="H" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-[var(--primary-color)] mb-1">Awaiting Approval</p>
                                <button onClick={() => setHasQR(null)} className="text-[10px] text-[var(--text-secondary)] hover:underline">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs text-center animate-in slide-in-from-top-2">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
