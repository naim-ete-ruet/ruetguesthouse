import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { API_BASE_URL } from '../../config/api';
import {
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    department: 'cse',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registration steps: 'form' -> 'verificationSent'
  const [registrationState, setRegistrationState] = useState('form');
  const [verificationOtp, setVerificationOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (user.role === 'teacher') navigate('/teacher/dashboard', { replace: true });
      else navigate('/student/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear field-specific errors when user modifies input
    if (name === 'email') {
      setEmailError('');
      if (error && error.includes('already registered')) {
        setError('');
      }
    } else {
      if (error && !error.includes('already registered')) {
        setError('');
      }
    }
  };

  // Check email on blur to provide immediate feedback
  const handleEmailBlur = async () => {
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return;

    try {
      const isRegistered = await authService.checkEmailRegistered(cleanEmail);
      if (isRegistered) {
        const msg = "An account have already registered from this email";
        setEmailError(msg);
        setError(msg);
      } else {
        setEmailError('');
        if (error === "An account have already registered from this email") {
          setError('');
        }
      }
    } catch (e) {
      // ignore network glitch on blur
    }
  };

  // Submit initial registration form -> checks duplicate & sends verification email
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setDevOtpHint('');

    const cleanEmail = formData.email.trim().toLowerCase();

    // 1. Validations
    if (!formData.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.rollNo.trim()) {
      setError("Please enter your Roll / ID No.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!formData.mobile.trim()) {
      setError("Please enter your mobile number.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // 2. Strict check: Ensure email is not already registered in Supabase
      const isRegistered = await authService.checkEmailRegistered(cleanEmail);
      if (isRegistered) {
        const msg = "An account have already registered from this email";
        setError(msg);
        setEmailError(msg);
        setIsLoading(false);
        return;
      }

      // 3. Dispatch verification email via backend from workmail.naim@gmail.com
      const response = await fetch(`${API_BASE_URL}/api/auth/send-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: formData.name.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 || data.error?.includes('already registered')) {
          const msg = "An account have already registered from this email";
          setError(msg);
          setEmailError(msg);
        } else {
          setError(data.error || "Failed to send verification email. Please check server.");
        }
        return;
      }

      // If development environment provided a dev code hint
      if (data.devCode) {
        setDevOtpHint(data.devCode);
      }

      // 4. Move to verification state
      setRegistrationState('verificationSent');
      setResendCooldown(30); // 30s countdown before allowing resend
      setOtpSuccessMsg(`Verification code sent to ${cleanEmail}`);
    } catch (err) {
      console.error("Registration request failed:", err);
      setError(err.message || "Failed to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP and complete synchronized Supabase registration
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');

    const cleanOtp = verificationOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = formData.email.trim().toLowerCase();

      // 1. Verify OTP with backend
      const verifyRes = await fetch(`${API_BASE_URL}/api/auth/verify-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setOtpError(verifyData.error || "Invalid or expired verification code.");
        setIsLoading(false);
        return;
      }

      // 2. Synchronize and persist user in Supabase database
      await authService.register({
        name: formData.name,
        rollNo: formData.rollNo,
        department: formData.department,
        email: cleanEmail,
        mobile: formData.mobile,
        password: formData.password
      });

      // 3. Dispatch official registration confirmation email from workmail.naim@gmail.com
      try {
        fetch(`${API_BASE_URL}/api/email/registration-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            name: formData.name,
            rollNo: formData.rollNo,
            department: formData.department,
            mobile: formData.mobile
          })
        }).catch(err => console.warn('Registration confirmation email dispatch notice:', err));
      } catch (emailErr) {
        console.warn('Registration confirmation email non-fatal notice:', emailErr);
      }

      // 4. Automatically log in the verified user
      await login(cleanEmail, formData.password, ['student']);

      // 5. Navigate to student dashboard
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      console.error("Verification error:", err);
      if (err.message && err.message.includes('already registered')) {
        setOtpError("An account have already registered from this email");
      } else {
        setOtpError(err.message || "Failed to complete registration in database.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend verification code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setOtpError('');
    setOtpSuccessMsg('');

    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/auth/send-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: formData.name.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setOtpError(data.error || "Failed to resend code.");
      } else {
        if (data.devCode) setDevOtpHint(data.devCode);
        setOtpSuccessMsg(`New verification code sent to ${cleanEmail}`);
        setResendCooldown(30);
      }
    } catch (err) {
      setOtpError("Network error while resending verification code.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="container flex justify-center items-center py-6 sm:py-10 px-3 sm:px-4" style={{ minHeight: '80vh' }}>
      <div
        className="card shadow-lg animate-fade-in"
        style={{
          maxWidth: '520px',
          width: '100%',
          borderRadius: '16px',
          padding: '1.5rem',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
      >

        {/* ================================================================= */}
        {/* STEP 2: VERIFICATION OTP VIEW */}
        {/* ================================================================= */}
        {registrationState === 'verificationSent' ? (
          <div>
            <button
              type="button"
              onClick={() => {
                setRegistrationState('form');
                setOtpError('');
                setOtpSuccessMsg('');
              }}
              className="flex items-center gap-1.5 text-xs text-muted mb-4 hover:text-primary transition"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeft size={16} /> Edit Registration Details
            </button>

            <div className="text-center mb-5">
              <div
                style={{
                  backgroundColor: 'rgba(79, 70, 229, 0.1)',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--color-primary)'
                }}
              >
                <Mail size={28} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold">Verify Your Email</h2>
              <p className="text-muted text-xs sm:text-sm mt-1">
                Enter the 6-digit verification code sent to:
              </p>
              <p className="font-semibold text-primary text-sm mt-0.5 break-all">
                {formData.email}
              </p>
            </div>

            {/* Sender Notice Box */}
            <div
              className="mb-4 p-3 rounded-lg text-xs leading-relaxed"
              style={{
                backgroundColor: 'rgba(79, 70, 229, 0.05)',
                border: '1px solid rgba(79, 70, 229, 0.2)',
                color: 'var(--color-text)'
              }}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Official Verification Email:</strong> Check your inbox (or spam) for an email from{' '}
                  <span className="text-primary font-medium">RUET guest house : workmail.naim@gmail.com</span>.
                </div>
              </div>
            </div>

            {/* Dev hint banner if local SMTP is offline */}
            {devOtpHint && (
              <div className="mb-4 p-2.5 rounded text-xs text-center" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
                <strong>Local Test Code:</strong> {devOtpHint}
              </div>
            )}

            {/* Success message */}
            {otpSuccessMsg && (
              <div className="mb-4 p-2.5 rounded text-xs flex items-center gap-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid var(--color-success)' }}>
                <CheckCircle size={15} className="flex-shrink-0" />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            {/* Error message */}
            {otpError && (
              <div className="mb-4 p-2.5 rounded text-xs flex items-center gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="form-group mb-4">
                <label className="form-label text-center block text-sm font-semibold mb-2">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={verificationOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationOtp(val);
                    if (otpError) setOtpError('');
                  }}
                  placeholder="Enter 6-digit code"
                  className="form-input text-center font-bold tracking-widest text-2xl"
                  style={{
                    letterSpacing: '0.45em',
                    fontSize: '1.75rem',
                    padding: '0.65rem 0.5rem',
                    borderRadius: '10px'
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full py-2.5 font-medium flex items-center justify-center gap-2"
                disabled={isLoading || verificationOtp.trim().length !== 6}
                style={{ minHeight: '44px' }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Verifying & Synchronizing...</span>
                  </>
                ) : (
                  <span>Verify Email & Complete Registration</span>
                )}
              </button>
            </form>

            <div className="mt-5 text-center flex flex-col items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isResending}
                className="text-primary font-medium flex items-center gap-1.5 hover:underline disabled:opacity-50"
                style={{ background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={13} className={isResending ? 'animate-spin' : ''} />
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Didn\'t receive code? Resend'}
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* STEP 1: INITIAL REGISTRATION FORM */
          /* ================================================================= */
          <>
            <div className="text-center mb-5">
              <h2 className="text-xl sm:text-2xl font-bold">Guest Registration</h2>
              <p className="text-muted text-xs sm:text-sm mt-1">Create an account to book a room</p>
            </div>

            {/* Error Banner - Red Marked */}
            {error && (
              <div
                className="mb-4 p-3 rounded-lg flex items-center gap-2 text-xs sm:text-sm font-semibold animate-fade-in"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--color-danger, #ef4444)',
                  border: '1.5px solid var(--color-danger, #ef4444)'
                }}
              >
                <AlertCircle size={18} className="flex-shrink-0 text-danger" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Full Name */}
              <div className="form-group mb-3">
                <label className="form-label text-xs sm:text-sm" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="form-input w-full"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your Full Name"
                  style={{ fontSize: '16px' }}
                />
              </div>

              {/* Roll / ID No. & Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="form-group mb-0">
                  <label className="form-label text-xs sm:text-sm" htmlFor="rollNo">Roll / ID No.</label>
                  <input
                    id="rollNo"
                    name="rollNo"
                    type="text"
                    className="form-input w-full"
                    required
                    value={formData.rollNo}
                    onChange={handleChange}
                    placeholder="Your Roll No."
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label text-xs sm:text-sm" htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input w-full"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleEmailBlur}
                    placeholder="example@domain.com"
                    style={{
                      fontSize: '16px',
                      borderColor: emailError ? 'var(--color-danger, #ef4444)' : undefined,
                      boxShadow: emailError ? '0 0 0 1px var(--color-danger, #ef4444)' : undefined
                    }}
                  />
                  {emailError && (
                    <span className="text-danger font-medium text-xs mt-1 block leading-tight">
                      {emailError}
                    </span>
                  )}
                </div>
              </div>

              {/* Department & Mobile Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="form-group mb-0">
                  <label className="form-label text-xs sm:text-sm" htmlFor="department">Department</label>
                  <select
                    id="department"
                    name="department"
                    className="form-select w-full"
                    value={formData.department}
                    onChange={handleChange}
                    style={{ fontSize: '16px' }}
                  >
                    <option value="eee">EEE</option>
                    <option value="cse">CSE</option>
                    <option value="ete">ETE</option>
                    <option value="ece">ECE</option>
                    <option value="ce">CE</option>
                    <option value="arch">ARCH</option>
                    <option value="urp">URP</option>
                    <option value="becm">BECM</option>
                    <option value="me">ME</option>
                    <option value="ipe">IPE</option>
                    <option value="mte">MTE</option>
                    <option value="mse">MSE</option>
                    <option value="che">ChE</option>
                    <option value="cme">CME</option>
                  </select>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label text-xs sm:text-sm" htmlFor="mobile">Mobile Number</label>
                  <input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    className="form-input w-full"
                    required
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="Your Mobile Number"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="form-group mb-0">
                  <label className="form-label text-xs sm:text-sm" htmlFor="password">Password</label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input w-full pr-10"
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="At least 8 chars"
                      style={{ fontSize: '16px', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 text-muted hover:text-text transition p-1"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label text-xs sm:text-sm" htmlFor="confirmPassword">Confirm Password</label>
                  <div className="relative flex items-center">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input w-full pr-10"
                      required
                      minLength={8}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter password"
                      style={{ fontSize: '16px', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 text-muted hover:text-text transition p-1"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2 py-2.5 font-semibold text-sm sm:text-base hover-scale flex items-center justify-center gap-2"
                disabled={isLoading}
                style={{ minHeight: '44px' }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Processing Registration...</span>
                  </>
                ) : (
                  <span>Register</span>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-xs sm:text-sm">
              <span className="text-muted">Already have an account? </span>
              <Link to="/login" className="text-primary font-medium hover:underline">
                Login here
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
