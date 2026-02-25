import { useState, useEffect } from 'react';
import { onboardingService, HiveKeys } from '../../../services/onboardingService';
import { useConfig } from '../../../contexts/ConfigContext';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
    web3WalletService,
    mnemonicStorage,
    addressStorage,
    encryptMnemonic,
    UNLOCK_MESSAGE,
} from '../../../services/web3WalletService';
import { buildHiveWalletTokens } from '../../../services/hiveMetadataService';

interface OnboardingFlowProps {
    isOpen: boolean;
    onClose: () => void;
    creator?: string;
}

type Step = 'username' | 'keys' | 'method' | 'lightning' | 'processing' | 'success';

export function OnboardingFlow({ isOpen, onClose, creator }: OnboardingFlowProps) {
    const [step, setStep] = useState<Step>('username');
    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);
    const [masterPassword, setMasterPassword] = useState('');
    const [derivedKeys, setDerivedKeys] = useState<HiveKeys | null>(null);
    const [savedPassword, setSavedPassword] = useState(false);
    const [actBalance, setActBalance] = useState(0);
    const [creationFee, setCreationFee] = useState('3.000 HIVE');
    const [loading, setLoading] = useState(false);
    const [txId, setTxId] = useState('');
    const [invoice, setInvoice] = useState<any>(null);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [jsonMetadata, setJsonMetadata] = useState('');

    useEffect(() => {
        if (isOpen && creator) {
            onboardingService.getCreatorACTBalance(creator).then(setActBalance);
            onboardingService.getAccountCreationFee().then(setCreationFee);
        }
    }, [isOpen, creator]);

    const handleCheckUsername = async () => {
        if (username.length < 3 || username.length > 16) return;
        setChecking(true);
        try {
            const available = await onboardingService.checkUsernameAvailability(username.toLowerCase());
            setIsAvailable(available);
            if (!available) toast.error('Username is already taken');
        } catch (error) {
            toast.error('Failed to check username');
        } finally {
            setChecking(false);
        }
    };

    const [showStatusCheck, setShowStatusCheck] = useState(false);
    const [checkUser, setCheckUser] = useState('');

    // Load persisted state or URL check on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const checkRequest = urlParams.get('check_onboarding');

        if (checkRequest) {
            setStep('processing');
            setUsername(checkRequest);
            return; // URL check takes precedence
        }

        const persisted = localStorage.getItem('bac_onboarding_state');
        if (persisted) {
            try {
                const { username: pUser, keys: pKeys, step: pStep, master: pMaster, jsonMetadata: pMeta } = JSON.parse(persisted);
                if (pUser && pKeys) {
                    setUsername(pUser);
                    setDerivedKeys(pKeys);
                    setMasterPassword(pMaster);
                    if (pMeta) setJsonMetadata(pMeta);
                    // Only resume if it was a deep step (method, lightning, processing)
                    if (['method', 'lightning', 'processing'].includes(pStep)) {
                        setStep(pStep);
                        toast.success(`Resuming onboarding for @${pUser}`, { id: 'resume' });
                    }
                }
            } catch (e) {
                localStorage.removeItem('bac_onboarding_state');
            }
        }
    }, []);

    const handleManualCheck = async () => {
        if (!checkUser) return;
        setLoading(true);
        try {
            const status = await onboardingService.checkAccountStatus(checkUser.toLowerCase().replace('@', ''));
            if (status.exists) {
                setUsername(status.account.username);
                if (status.created) {
                    setTxId(status.account.hiveTxId || 'confirmed');
                    setStep('success');
                } else {
                    setStep('processing');
                }
                setShowStatusCheck(false);
            } else {
                toast.error('Account not found in our onboarding records.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Persist state when critical fields change
    useEffect(() => {
        if (username && derivedKeys && step !== 'success') {
            localStorage.setItem('bac_onboarding_state', JSON.stringify({
                username,
                keys: derivedKeys,
                step,
                master: masterPassword,
                jsonMetadata
            }));
        } else if (step === 'success') {
            localStorage.removeItem('bac_onboarding_state');
        }
    }, [username, derivedKeys, step, masterPassword, jsonMetadata]);

    // Fast polling when in lightning/processing step
    useEffect(() => {
        let interval: any;
        if ((step === 'lightning' || step === 'processing') && username) {
            interval = setInterval(async () => {
                const status = await onboardingService.checkAccountStatus(username);
                if (status.created) {
                    setTxId(status.account?.hiveTxId || 'confirmed');
                    setStep('success');
                    clearInterval(interval);
                } else if (status.status === 'paid' || status.status === 'processing') {
                    if (step === 'lightning') {
                        setStep('processing');
                    }
                }
            }, 3000); // Faster polling for Head Blocks
        }
        return () => clearInterval(interval);
    }, [step, username]);

    const [validationError, setValidationError] = useState<string | null>(null);

    // Debounced username check with strict Hive rules
    useEffect(() => {
        const validateHiveName = (name: string): string | null => {
            if (name.length > 16) return 'Name too long (max 16 chars)';
            if (name.length < 3) return 'Name too short (min 3 chars)';

            const segments = name.split('.');
            for (const segment of segments) {
                if (segment.length < 3) return `Segment "${segment}" too short (min 3 chars)`;
                if (!/^[a-z]/.test(segment)) return `Segment "${segment}" must start with a letter`;
                if (!/^[a-z0-9-]+$/.test(segment)) return `Segment "${segment}" contains invalid characters`;
                if (segment.endsWith('-')) return `Segment "${segment}" cannot end with a hyphen`;
            }
            return null;
        };

        const timer = setTimeout(() => {
            if (!username) {
                setValidationError(null);
                setIsAvailable(null);
                return;
            }

            const error = validateHiveName(username.toLowerCase());
            if (error) {
                setValidationError(error);
                setIsAvailable(false);
            } else {
                setValidationError(null);
                handleCheckUsername();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [username]);

    if (!isOpen) return null;


    const handleGenerateKeys = async () => {
        const pass = onboardingService.generateMasterPassword();
        const keys = onboardingService.generateKeys(username.toLowerCase(), pass);
        setMasterPassword(pass);
        setDerivedKeys(keys);
        setStep('keys');
        setShowResumePrompt(false);

        // Stealth Background Web3 Wallet Generation
        try {
            const mnemonic = await web3WalletService.generateMnemonic();
            const derived = await web3WalletService.deriveAddresses(mnemonic);

            // Generate exact Keychain signature locally using the new posting key
            const signature = onboardingService.signUnlockMessageLocally(keys.posting, UNLOCK_MESSAGE);

            // Encrypt and store locally (so dashboard can use it later)
            const { encrypted, salt } = await encryptMnemonic(mnemonic, signature);
            mnemonicStorage.set(username.toLowerCase(), encrypted, salt);

            // Store public addresses locally
            const publicCache: any = {};
            Object.entries(derived).forEach(([chain, data]) => {
                if (chain !== 'mnemonic') {
                    publicCache[chain] = { address: (data as any).address, imageUrl: (data as any).imageUrl };
                }
            });
            addressStorage.set(username.toLowerCase(), publicCache);

            // Build the json_metadata string to be injected into the account_create tx
            const tokens = buildHiveWalletTokens(derived);
            const metadataObj = {
                profile: {
                    about: "Joined via Breakaway Communities",
                    version: 2,
                    tokens: tokens
                }
            };
            setJsonMetadata(JSON.stringify(metadataObj));
        } catch (err) {
            console.error("Failed to generate background Web3 Wallet", err);
            // Non-blocking: we still proceed with Hive account creation
        }
    };

    const handleDownloadKeys = () => {
        if (!derivedKeys) return;

        const content = `HIVE ACCOUNT BACKUP
-------------------
Account: @${username}
Master Password: ${masterPassword}

PRIVATE KEYS (DO NOT SHARE!)
---------------------------
Owner:   ${derivedKeys.owner}
Active:  ${derivedKeys.active}
Posting: ${derivedKeys.posting}
Memo:    ${derivedKeys.memo}

PUBLIC KEYS
-----------
Owner:   ${derivedKeys.ownerPubkey}
Active:  ${derivedKeys.activePubkey}
Posting: ${derivedKeys.postingPubkey}
Memo:    ${derivedKeys.memoPubkey}

-------------------
KEEP THIS SECURE! If you lose this password or your keys, you lose access to your account forever.
-------------------`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hive_keys_${username}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setSavedPassword(true);
    };

    const handleCreateWithHIVE = async () => {
        if (!creator || !derivedKeys) return;
        setLoading(true);
        setStep('processing');
        const result = await onboardingService.createAccountWithPayment(creator, username.toLowerCase(), derivedKeys, creationFee, jsonMetadata);
        if (result.success) {
            setTxId(result.txId || '');
            setStep('success');
            toast.success('Account created successfully!');
        } else {
            setStep('method');
            toast.error(result.error || 'Failed to create account');
        }
        setLoading(false);
    };

    const handleCreateWithToken = async () => {
        if (!creator || !derivedKeys) return;
        setLoading(true);
        setStep('processing');
        const result = await onboardingService.createAccountWithToken(creator, username.toLowerCase(), derivedKeys, jsonMetadata);
        if (result.success) {
            setTxId(result.txId || '');
            setStep('success');
            toast.success('Account created successfully!');
        } else {
            setStep('method');
            toast.error(result.error || 'Failed to create account');
        }
        setLoading(false);
    };

    const { config: dynamicConfig } = useConfig();

    const handleCreateWithSats = async () => {
        if (!username || !derivedKeys) return;
        setLoading(true);
        setShowResumePrompt(false);
        try {
            // Use dedicated bac.onboard account for automated fulfillment
            const beneficiary = 'bac.onboard';
            // Use dynamic onboarding sats fee from config
            const satsToPay = dynamicConfig?.onboardingSats || 50;
            const invoiceData = await onboardingService.getInvoice(beneficiary, username, satsToPay);
            await onboardingService.submitLightningRequest(username, derivedKeys, invoiceData, jsonMetadata);
            setInvoice(invoiceData);
            setStep('lightning');
        } catch (error: any) {
            const errorMessage = error?.response?.data?.error || error?.message || (typeof error === 'object' && error.error) || 'Failed to start Lightning process';
            toast.error(errorMessage);
            if (errorMessage.toLowerCase().includes('already registered')) {
                setShowResumePrompt(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCopyInvoice = () => {
        if (invoice?.payment_request) {
            navigator.clipboard.writeText(invoice.payment_request);
            toast.success('Invoice copied to clipboard');
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'username':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                                {showStatusCheck ? 'Check Progress' : 'Give them a name'}
                            </h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">
                                {showStatusCheck
                                    ? 'Enter the username to check its registration status.'
                                    : 'Choose a unique Hive username for the new account.'}
                            </p>
                        </div>

                        {!showStatusCheck ? (
                            <>
                                <div className="relative group">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[var(--text-secondary)] font-semibold">@</span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={username}
                                        onChange={(e) => {
                                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9-.]/g, '');
                                            if (val.length <= 20) {
                                                setUsername(val);
                                                setIsAvailable(null);
                                            }
                                        }}
                                        placeholder="new-username"
                                        className={`w-full pl-12 pr-5 py-4 bg-[var(--bg-card)] border rounded-2xl text-[var(--text-primary)] focus:ring-4 transition-all outline-none text-lg shadow-sm ${validationError ? 'border-red-500 focus:ring-red-500/10' : 'border-[var(--border-color)] focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)]'}`}
                                    />
                                    {checking && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />}
                                </div>
                                <div className="min-h-[24px] ml-2">
                                    {validationError && (
                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter flex items-center gap-1.5">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {validationError}
                                        </p>
                                    )}
                                    {!validationError && username.length > 0 && username.length < 3 && (
                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">Min 3 characters required</p>
                                    )}
                                    {!validationError && checking && (
                                        <p className="text-xs font-bold text-[var(--primary-color)] flex items-center gap-1.5 animate-pulse">
                                            <span className="w-1.5 h-1.5 bg-[var(--primary-color)] rounded-full animate-bounce" />
                                            Verifying availability...
                                        </p>
                                    )}
                                    {!validationError && isAvailable === true && !checking && (
                                        <p className="text-xs font-bold text-green-500 flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            @{username} is available!
                                        </p>
                                    )}
                                    {!validationError && isAvailable === false && !checking && username.length >= 3 && (
                                        <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Username already taken
                                        </p>
                                    )}
                                </div>
                                <button
                                    disabled={!isAvailable || !!validationError || checking}
                                    onClick={handleGenerateKeys}
                                    className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[var(--primary-color)]/25"
                                >
                                    Generate Secure Keys
                                </button>
                                <div className="text-center">
                                    <button
                                        onClick={() => setShowStatusCheck(true)}
                                        className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors"
                                    >
                                        Already paid? Check status here
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="relative group">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[var(--text-secondary)] font-semibold">@</span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={checkUser}
                                        onChange={(e) => setCheckUser(e.target.value.toLowerCase())}
                                        placeholder="existing-username"
                                        className="w-full pl-12 pr-5 py-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--primary-color)]/10 focus:border-[var(--primary-color)] transition-all outline-none text-lg shadow-sm"
                                    />
                                </div>
                                <button
                                    disabled={loading || !checkUser}
                                    onClick={handleManualCheck}
                                    className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[var(--primary-color)]/25 flex items-center justify-center gap-2"
                                >
                                    {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    Verify Status
                                </button>
                                <div className="text-center">
                                    <button
                                        onClick={() => setShowStatusCheck(false)}
                                        className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors"
                                    >
                                        ← Back to new signup
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                );
            case 'keys':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-red-500">Backup your password</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">This is the ONLY way to access the account. Hive is decentralized; there is no "Forgot Password" button.</p>
                        </div>
                        <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl break-all">
                            <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2 opacity-70">Master Password</p>
                            <p className="text-lg font-mono text-[var(--text-primary)] selection:bg-red-500/20">{masterPassword}</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDownloadKeys}
                                className="w-full py-4 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-2xl hover:bg-[var(--bg-canvas)] transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download as Text File
                            </button>
                            <button
                                disabled={!savedPassword}
                                onClick={() => setStep('method')}
                                className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[var(--primary-color)]/25"
                            >
                                I've Saved My Password
                            </button>
                        </div>
                    </div>
                );
            case 'method':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Choose onboarding method</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">How would you like to pay for the account creation?</p>
                        </div>
                        <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {creator && (
                                <>
                                    <button
                                        onClick={handleCreateWithHIVE}
                                        disabled={loading}
                                        className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl hover:border-[var(--primary-color)] text-left transition-all group disabled:opacity-50"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-[var(--text-primary)]">Pay with HIVE</h4>
                                            <span className="px-3 py-1 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-lg text-xs font-black">{creationFee}</span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">Create the account by paying the Hive network fee directly from your wallet.</p>
                                    </button>
                                    <button
                                        disabled={actBalance === 0 || loading}
                                        onClick={handleCreateWithToken}
                                        className={`p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl text-left transition-all ${actBalance > 0 && !loading ? 'hover:border-purple-500' : 'opacity-40 cursor-not-allowed'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-[var(--text-primary)]">Account Token</h4>
                                            <span className="px-3 py-1 bg-purple-500/10 text-purple-500 rounded-lg text-xs font-black">{actBalance} Available</span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">Use a claimed account token for instant, fee-less creation.</p>
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleCreateWithSats}
                                disabled={loading}
                                className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl hover:border-orange-500 text-left transition-all group disabled:opacity-50 relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-[var(--text-primary)]">Pay with BTC (Lightning)</h4>
                                        {loading && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
                                    </div>
                                    <span className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-lg text-xs font-black">Fast & Global</span>
                                </div>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    {loading ? 'Generating Lightning invoice...' : 'Pay with any Bitcoin Lightning wallet. Perfect for guest users or those without HIVE liquid balance.'}
                                </p>
                            </button>
                        </div>
                    </div>
                );
            case 'lightning':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-orange-500">Scan to Pay</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">Send precisely <strong className="text-orange-500">{invoice?.amount} SATS</strong> to create <strong className="text-[var(--primary-color)]">@{username}</strong></p>
                        </div>
                        <div className="flex justify-center p-6 bg-white rounded-[2rem] shadow-inner">
                            <QRCodeSVG value={invoice?.payment_request || ''} size={200} />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleCopyInvoice}
                                className="w-full py-3 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-bold rounded-2xl hover:bg-[var(--bg-canvas)] transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                Copy Lightning Invoice
                            </button>
                            <div className="flex items-center justify-center gap-2 py-2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                                <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Waiting for payment...</span>
                            </div>
                            <button
                                onClick={() => setStep('method')}
                                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-semibold"
                            >
                                ← Go Back
                            </button>
                        </div>
                    </div>
                );
            case 'processing':
                return (
                    <div className="py-20 flex flex-col items-center justify-center space-y-8">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-[var(--primary-color)]/10 border-t-[var(--primary-color)] rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-3xl">🐝</div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-[var(--text-primary)]">Creating @{username}</h3>
                            <p className="text-sm text-[var(--text-secondary)] mt-2">Broadcasting to the Hive blockchain...</p>
                        </div>
                    </div>
                );
            case 'success':
                return (
                    <div className="py-12 flex flex-col items-center justify-center space-y-8">
                        <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center text-5xl">✅</div>
                        <div className="text-center">
                            <h3 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Success!</h3>
                            <p className="text-[var(--text-secondary)] mt-2">Welcome to Hive, <span className="text-[var(--primary-color)] font-bold">@{username}</span>!</p>
                        </div>
                        <div className="w-full p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Transaction ID</p>
                            <p className="text-xs font-mono text-[var(--text-primary)] break-all">{txId}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[var(--primary-color)]/25"
                        >
                            Done
                        </button>
                    </div>
                );
        }
    };

    const handleBack = () => {
        switch (step) {
            case 'keys':
                setStep('username');
                break;
            case 'method':
                setStep('keys');
                break;
            case 'lightning':
                setStep('method');
                break;
            default:
                break;
        }
    };

    const handleClose = () => {
        if (step !== 'username' && step !== 'success') {
            setShowCloseConfirm(true);
        } else {
            if (step === 'success') {
                localStorage.removeItem('bac_onboarding_state');
            }
            onClose();
            setTimeout(() => {
                setStep('username');
                setUsername('');
                setCheckUser('');
                setTxId('');
            }, 300);
        }
    };

    const confirmCloseProcess = () => {
        localStorage.removeItem('bac_onboarding_state');
        setShowCloseConfirm(false);
        onClose();
        setTimeout(() => {
            setStep('username');
            setUsername('');
            setCheckUser('');
            setTxId('');
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={handleClose}>
            <div
                className="w-full max-w-md bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-[2.5rem] shadow-2xl overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {step !== 'processing' && step !== 'success' && (
                    <>
                        {step !== 'username' && (
                            <button onClick={handleBack} className="absolute top-6 left-6 p-2 hover:bg-[var(--bg-card)] rounded-full transition-colors text-[var(--text-secondary)] flex items-center gap-1 group">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        <button onClick={handleClose} className="absolute top-6 right-6 p-2 hover:bg-[var(--bg-card)] rounded-full transition-colors text-[var(--text-secondary)]">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </>
                )}
                <div className="p-10">
                    {renderStep()}
                </div>

                {/* Resume Prompt Modal */}
                {showResumePrompt && (
                    <div className="absolute inset-0 z-[120] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl transform transition-all scale-100 opacity-100">
                            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-center text-[var(--text-primary)] mb-2">Resume Registration?</h3>
                            <p className="text-sm text-center text-[var(--text-secondary)] mb-6">
                                It looks like you started registering <strong className="text-[var(--text-primary)]">@{username}</strong> recently but didn't complete the payment. Would you like to check the status or resume payment?
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        setCheckUser(username);
                                        setShowStatusCheck(true);
                                        setStep('username');
                                        setShowResumePrompt(false);
                                    }}
                                    className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                                >
                                    Yes, Check Status
                                </button>
                                <button
                                    onClick={() => setShowResumePrompt(false)}
                                    className="w-full py-3 bg-transparent border border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-xl hover:bg-[var(--bg-canvas)] transition-colors"
                                >
                                    No, Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Close Confirmation Modal */}
                {showCloseConfirm && (
                    <div className="absolute inset-0 z-[120] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl transform transition-all scale-100 opacity-100">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-center text-[var(--text-primary)] mb-2">Cancel Setup?</h3>
                            <p className="text-sm text-center text-[var(--text-secondary)] mb-6">
                                Are you sure you want to cancel? Your setup progress will be lost and you will need to generate keys again.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={confirmCloseProcess}
                                    className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                >
                                    Yes, Cancel Setup
                                </button>
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="w-full py-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-xl hover:brightness-110 transition-all"
                                >
                                    No, Keep Going
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
