import React, { useEffect, useRef, useState } from 'react';
import './Otp.css';
import { apiFetch } from '../../lib/api';

export default function Otp() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('An OTP code has been sent to your email');
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (inputsRef.current[0]) inputsRef.current[0].focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return; // allow only a single digit or empty
    setError('');
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && inputsRef.current[index - 1]) {
      const prevIndex = index - 1;
      inputsRef.current[prevIndex].focus();
      setDigits((prev) => {
        const copy = [...prev];
        copy[prevIndex] = '';
        return copy;
      });
    }
    if (e.key === 'ArrowLeft' && inputsRef.current[index - 1]) {
      inputsRef.current[index - 1].focus();
    }
    if (e.key === 'ArrowRight' && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = pasted.split('');
    while (next.length < 6) next.push('');
    setDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    if (inputsRef.current[focusIndex]) inputsRef.current[focusIndex].focus();
  };

  const onVerify = (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    const purpose = sessionStorage.getItem('otpPurpose');
    const email = sessionStorage.getItem('otpEmail');
    if (purpose === 'register') {
      apiFetch('/auth/register/verify', { method: 'POST', body: JSON.stringify({ email, code }) })
        .then(() => { window.location.href = '/'; })
        .catch((err) => setError(err.message || 'Invalid or expired OTP'));
      return;
    }
    if (purpose === 'register_vendor') {
      apiFetch('/auth/register/vendor/verify', { method: 'POST', body: JSON.stringify({ email, code }) })
        .then(() => { window.location.href = '/vendor/submitted'; })
        .catch((err) => setError(err.message || 'Invalid or expired OTP'));
      return;
    }
    if (purpose === 'resubmit_vendor') {
      apiFetch('/auth/vendor/resubmit/verify', { method: 'POST', body: JSON.stringify({ email, code }) })
        .then(() => { window.location.href = '/vendor/submitted'; })
        .catch((err) => setError(err.message || 'Invalid or expired OTP'));
      return;
    }
    if (purpose === 'reset' || purpose === 'change_password') {
      apiFetch('/auth/forgot/verify', { method: 'POST', body: JSON.stringify({ email, code }) })
        .then(() => { sessionStorage.setItem('otpCode', code); window.location.href = '/reset-password'; })
        .catch((err) => setError(err.message || 'Invalid or expired OTP'));
      return;
    }
    setError('Invalid context. Please start again.');
  };

  const onResend = () => {
    if (resendCooldown > 0) return;
    const purpose = sessionStorage.getItem('otpPurpose');
    const email = sessionStorage.getItem('otpEmail');
    // Backend resend currently supports 'reset' (not 'change_password').
    // 'change_password' uses the same reset OTP flow on the server.
    const resendPurpose = purpose === 'change_password' ? 'reset' : purpose;
    apiFetch('/auth/otp/resend', { method: 'POST', body: JSON.stringify({ email, purpose: resendPurpose }) })
      .then(() => {
        setInfo('A new OTP has been sent to your email');
        setResendCooldown(30);
      })
      .catch((err) => {
        setInfo('Could not resend OTP. Please try again shortly.');
      });
  };

  return (
    <div className="otp-page">
      <div className="otp-hero" />
      <div className="otp-panel">
        <div className="otp-card">
          <h2 className="otp-title">Enter OTP</h2>
          <p className="otp-subtitle">{info}</p>
          <form onSubmit={onVerify}>
            <div className="otp-inputs" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  className="otp-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                />
              ))}
            </div>
            {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
            <div className="otp-actions">
              <button type="button" className="link-button" onClick={onResend} disabled={resendCooldown > 0}>
                {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
              </button>
            </div>
            <button className="otp-verify" type="submit">Verify</button>
          </form>
        </div>
      </div>
    </div>
  );
}


