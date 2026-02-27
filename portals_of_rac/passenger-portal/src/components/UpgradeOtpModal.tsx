// passenger-portal/src/components/UpgradeOtpModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import '../styles/components/UpgradeOtpModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface UpgradeOtpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    action: 'accept' | 'deny';
    offerId: string;
    berth?: string;
    pnr: string | null;
}

type Step = 'identity' | 'otp' | 'processing' | 'result';

const UpgradeOtpModal: React.FC<UpgradeOtpModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    action,
    offerId,
    berth,
    pnr: initialPnr,
}) => {
    const [step, setStep] = useState<Step>('identity');
    const [irctcId, setIrctcId] = useState('');
    const [pnr, setPnr] = useState(initialPnr || '');
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [maskedEmail, setMaskedEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpTimer, setOtpTimer] = useState(300); // 5 minutes
    const [canResend, setCanResend] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [resultSuccess, setResultSuccess] = useState(false);

    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Pre-fill IRCTC ID from localStorage
    useEffect(() => {
        if (isOpen) {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                setIrctcId(user.IRCTC_ID || user.irctcId || '');
            }
            if (initialPnr) {
                setPnr(initialPnr);
            }
        }
    }, [isOpen, initialPnr]);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setStep('identity');
            setOtpDigits(['', '', '', '', '', '']);
            setError('');
            setLoading(false);
            setCanResend(false);
            setResultMessage('');
            setResultSuccess(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [isOpen]);

    // OTP countdown timer
    useEffect(() => {
        if (step === 'otp') {
            setOtpTimer(300);
            setCanResend(false);
            timerRef.current = setInterval(() => {
                setOtpTimer(prev => {
                    if (prev <= 1) {
                        setCanResend(true);
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
            };
        }
    }, [step]);

    const handleSendOtp = async () => {
        setError('');
        if (!irctcId.trim() || !pnr.trim()) {
            setError('Please enter both IRCTC ID and PNR Number');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/passenger/send-upgrade-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: irctcId.trim(),
                    pnr: pnr.trim(),
                    purpose: `upgrade offer ${action}`
                })
            });

            const data = await response.json();

            if (data.success) {
                setMaskedEmail(data.message || '');
                setStep('otp');
                // Focus first OTP input
                setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
            } else {
                setError(data.message || 'Failed to send OTP');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1);
        setOtpDigits(newDigits);

        // Auto-focus next input
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newDigits = [...otpDigits];
        for (let i = 0; i < pastedData.length; i++) {
            newDigits[i] = pastedData[i];
        }
        setOtpDigits(newDigits);
        // Focus the input after the last pasted digit
        const focusIdx = Math.min(pastedData.length, 5);
        otpInputRefs.current[focusIdx]?.focus();
    };

    const handleVerifyAndProcess = async () => {
        const otp = otpDigits.join('');
        if (otp.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setError('');
        setStep('processing');

        try {
            const response = await fetch(`${API_URL}/passenger/verify-upgrade-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: irctcId.trim(),
                    pnr: pnr.trim(),
                    otp,
                    action,
                    offerId,
                    berth
                })
            });

            const data = await response.json();

            if (data.success) {
                setResultSuccess(true);
                setResultMessage(
                    action === 'accept'
                        ? 'Upgrade accepted! Your new berth has been assigned.'
                        : 'Upgrade declined. You will not receive further offers.'
                );
                setStep('result');
                // Auto-close after 2 seconds and notify parent
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2500);
            } else {
                // OTP verification failed or action failed
                setResultSuccess(false);
                setResultMessage(data.message || 'Verification failed');
                setStep('result');
            }
        } catch (err) {
            setResultSuccess(false);
            setResultMessage('Network error. Please try again.');
            setStep('result');
        }
    };

    const handleResendOtp = async () => {
        setError('');
        setOtpDigits(['', '', '', '', '', '']);
        setCanResend(false);
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/passenger/send-upgrade-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: irctcId.trim(),
                    pnr: pnr.trim(),
                    purpose: `upgrade offer ${action}`
                })
            });

            const data = await response.json();
            if (data.success) {
                setOtpTimer(300);
                timerRef.current = setInterval(() => {
                    setOtpTimer(prev => {
                        if (prev <= 1) {
                            setCanResend(true);
                            if (timerRef.current) clearInterval(timerRef.current);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
                setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
            } else {
                setError(data.message || 'Failed to resend OTP');
            }
        } catch (err) {
            setError('Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const otpFull = otpDigits.every(d => d !== '');

    return (
        <div className="otp-modal-overlay" onClick={onClose}>
            <div className="otp-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="otp-modal-header">
                    <h2>
                        🔐 Verify Identity
                        <span className={`action-badge ${action}`}>
                            {action === 'accept' ? '✅ Accept' : '❌ Decline'}
                        </span>
                    </h2>
                    <button className="otp-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Step Indicator */}
                <div className="otp-steps">
                    <div className={`otp-step ${step === 'identity' ? 'active' : (step !== 'identity' ? 'completed' : '')}`}>
                        <span className="otp-step-number">
                            {step !== 'identity' ? '✓' : '1'}
                        </span>
                        <span>Identity</span>
                    </div>
                    <div className={`otp-step-connector ${step !== 'identity' ? 'completed' : ''}`} />
                    <div className={`otp-step ${step === 'otp' ? 'active' : (['processing', 'result'].includes(step) ? 'completed' : '')}`}>
                        <span className="otp-step-number">
                            {['processing', 'result'].includes(step) ? '✓' : '2'}
                        </span>
                        <span>OTP</span>
                    </div>
                    <div className={`otp-step-connector ${['processing', 'result'].includes(step) ? 'completed' : ''}`} />
                    <div className={`otp-step ${step === 'result' ? (resultSuccess ? 'completed' : 'active') : (step === 'processing' ? 'active' : '')}`}>
                        <span className="otp-step-number">
                            {step === 'result' && resultSuccess ? '✓' : '3'}
                        </span>
                        <span>Confirm</span>
                    </div>
                </div>

                {/* Body */}
                <div className="otp-modal-body">
                    {/* Step 1: Identity Verification */}
                    {step === 'identity' && (
                        <div className="identity-form">
                            <div className="otp-input-group">
                                <label>🆔 IRCTC ID</label>
                                <input
                                    type="text"
                                    value={irctcId}
                                    onChange={e => setIrctcId(e.target.value.toUpperCase())}
                                    placeholder="e.g. IR_0001"
                                    autoFocus
                                />
                            </div>
                            <div className="otp-input-group">
                                <label>🎫 PNR Number</label>
                                <input
                                    type="text"
                                    value={pnr}
                                    onChange={e => setPnr(e.target.value)}
                                    placeholder="e.g. 1234567890"
                                />
                            </div>
                            {error && <div className="otp-error">{error}</div>}
                        </div>
                    )}

                    {/* Step 2: OTP Input */}
                    {step === 'otp' && (
                        <div>
                            <div className="otp-sent-info">
                                <div className="email-sent-icon">📧</div>
                                <p>{maskedEmail}</p>
                                <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    Enter the 6-digit code to {action === 'accept' ? 'accept' : 'decline'} the upgrade
                                </p>
                            </div>
                            <div className="otp-code-inputs" onPaste={handleOtpPaste}>
                                {otpDigits.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={el => { otpInputRefs.current[idx] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                                        className={digit ? 'filled' : ''}
                                        autoFocus={idx === 0}
                                    />
                                ))}
                            </div>
                            <div className="otp-timer">
                                {otpTimer > 0 ? (
                                    <span>
                                        OTP expires in <span className="time">
                                            {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}
                                        </span>
                                    </span>
                                ) : (
                                    <span>OTP expired.</span>
                                )}
                                {' '}
                                <button
                                    className="otp-resend-btn"
                                    onClick={handleResendOtp}
                                    disabled={!canResend || loading}
                                >
                                    Resend OTP
                                </button>
                            </div>
                            {error && <div className="otp-error">{error}</div>}
                        </div>
                    )}

                    {/* Step 3: Processing */}
                    {step === 'processing' && (
                        <div className="otp-processing">
                            <div className="processing-spinner" />
                            <p>Verifying OTP and {action === 'accept' ? 'accepting' : 'declining'} upgrade...</p>
                        </div>
                    )}

                    {/* Result */}
                    {step === 'result' && (
                        <div className="otp-result">
                            <div className="result-icon">
                                {resultSuccess ? '✅' : '❌'}
                            </div>
                            <h3 className={resultSuccess ? 'success' : 'error'}>
                                {resultSuccess ? 'Verified & Confirmed!' : 'Verification Failed'}
                            </h3>
                            <p>{resultMessage}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(step === 'identity' || step === 'otp') && (
                    <div className="otp-modal-footer">
                        <button className="otp-btn otp-btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        {step === 'identity' && (
                            <button
                                className="otp-btn otp-btn-primary"
                                onClick={handleSendOtp}
                                disabled={loading || !irctcId.trim() || !pnr.trim()}
                            >
                                {loading ? 'Sending OTP...' : 'Send OTP →'}
                            </button>
                        )}
                        {step === 'otp' && (
                            <button
                                className={`otp-btn otp-btn-primary ${action === 'accept' ? 'accept-btn' : 'deny-btn'}`}
                                onClick={handleVerifyAndProcess}
                                disabled={!otpFull}
                            >
                                {action === 'accept' ? '✅ Verify & Accept' : '❌ Verify & Decline'}
                            </button>
                        )}
                    </div>
                )}

                {/* Result footer */}
                {step === 'result' && !resultSuccess && (
                    <div className="otp-modal-footer">
                        <button className="otp-btn otp-btn-secondary" onClick={onClose}>
                            Close
                        </button>
                        <button
                            className="otp-btn otp-btn-primary"
                            onClick={() => {
                                setStep('otp');
                                setOtpDigits(['', '', '', '', '', '']);
                                setError('');
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpgradeOtpModal;
