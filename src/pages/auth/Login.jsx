import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function Login({ isAdmin = false, isTeacher = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [resetState, setResetState] = useState('none'); // 'none', 'email', 'otp', 'newPassword'
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState({ type: '', text: '' });

  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (user.role === 'teacher') navigate('/teacher/dashboard', { replace: true });
      else navigate('/student/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const allowedRoles = isAdmin ? ['admin'] : isTeacher ? ['teacher'] : ['student'];
      const user = await login(email, password, allowedRoles);
      
      // Navigate based on role
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'teacher') navigate('/teacher/dashboard');
      else navigate('/student/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForgotPasswordFlow = () => {
    setResetState('none');
    setResetEmail('');
    setOtp('');
    setNewPassword('');
    setResetMessage({ type: '', text: '' });
  };

  const openForgotPassword = () => {
    setResetState('email');
    setResetEmail('');
    setOtp('');
    setNewPassword('');
    setResetMessage({ type: '', text: '' });
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setResetMessage({ type: '', text: '' });
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setResetState('otp');
        setOtp('');
        setNewPassword('');
        setResetMessage({ type: 'success', text: data.message || `OTP sent to ${resetEmail}. Check your inbox or spam.` });
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Failed to send OTP.' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'Cannot connect to backend server. Please make sure server is running.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setResetMessage({ type: '', text: '' });
    if (!otp || otp.trim().length !== 6) {
      setResetMessage({ type: 'error', text: 'Please enter the 6-digit OTP code.' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), otp: otp.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setResetState('newPassword');
        setNewPassword('');
        setResetMessage({ type: 'success', text: 'OTP verified! Enter your new password.' });
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Invalid OTP code. Please check and try again.' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'Failed to verify OTP with server.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage({ type: '', text: '' });
    if (newPassword.length < 6) {
      setResetMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), otp: otp.trim(), newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        resetForgotPasswordFlow();
        setError('');
        alert("Password reset successfully! You can now login with your new password.");
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Failed to reset password.' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'Failed to connect to the server.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex justify-center items-center" style={{ minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        
        {/* ================= FORGOT PASSWORD FLOW ================= */}
        {resetState !== 'none' ? (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Reset Password</h2>
              <p className="text-muted text-sm mt-2">
                {resetState === 'email' && "Enter your RUET email to receive an OTP"}
                {resetState === 'otp' && "Enter the 6-digit OTP sent to your email"}
                {resetState === 'newPassword' && "Create a new password"}
              </p>
            </div>

            {resetMessage.text && (
              <div className="mb-4 p-3 rounded" style={{ 
                backgroundColor: resetMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                color: resetMessage.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)', 
                border: `1px solid ${resetMessage.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'}` 
              }}>
                {resetMessage.text}
              </div>
            )}

            {resetState === 'email' && (
              <form onSubmit={handleSendOtp}>
                <div className="form-group">
                  <label className="form-label" htmlFor="resetEmail">Registered Email</label>
                  <input 
                    id="resetEmail" type="email" className="form-input" 
                    value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@example.com" required
                    autoComplete="off"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full mt-4" disabled={isLoading}>
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            )}

            {resetState === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label className="form-label" htmlFor="otp">Enter 6-digit OTP</label>
                  <input 
                    id="otp" 
                    type="text" 
                    className="form-input text-center font-bold" 
                    value={otp} 
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456" 
                    required 
                    maxLength="6"
                    autoComplete="off"
                    style={{ letterSpacing: '6px', fontSize: '1.25rem', textAlign: 'center' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full mt-4" disabled={isLoading || otp.length !== 6}>
                  {isLoading ? 'Verifying OTP...' : 'Verify OTP'}
                </button>
                <div className="mt-4 text-center">
                  <button 
                    type="button" 
                    onClick={handleSendOtp} 
                    disabled={isLoading}
                    className="text-primary text-sm font-medium" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Didn't receive code? Resend OTP
                  </button>
                </div>
              </form>
            )}

            {resetState === 'newPassword' && (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label className="form-label" htmlFor="newPassword">New Password</label>
                  <input 
                    id="newPassword" type="password" className="form-input" 
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required minLength="6"
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full mt-4" disabled={isLoading}>
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <button 
                onClick={resetForgotPasswordFlow} 
                className="btn btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
          /* ================= STANDARD LOGIN FLOW ================= */
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">
                {isAdmin ? 'Admin Login' : isTeacher ? 'Teacher Login' : 'Guest Login'}
              </h2>
              <p className="text-muted text-sm mt-2">
                {isAdmin ? 'Login to manage the guest house' : isTeacher ? 'Login to manage departmental bookings' : 'Login to book a room'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input 
                  id="email"
                  type="email" 
                  className="form-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div className="flex justify-between items-center mb-1">
                  <label className="form-label" style={{ marginBottom: 0 }} htmlFor="password">Password</label>
                  <button 
                    type="button" 
                    onClick={openForgotPassword}
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="password"
                    type={showPassword ? "text" : "password"} 
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary w-full mt-4"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {!isAdmin && !isTeacher && (
              <div className="mt-6 text-center text-sm flex flex-col gap-2">
                <div>
                  <span className="text-muted">Don't have an account? </span>
                  <Link to="/register" className="text-primary font-medium">Register here</Link>
                </div>
                <div>
                  <span className="text-muted">Teacher portal? </span>
                  <Link to="/teacher/login" className="text-primary font-medium">Teacher Login</Link>
                </div>
              </div>
            )}
            
            {(isAdmin || isTeacher) && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted">Guest portal? </span>
                <Link to="/login" className="text-primary font-medium">Guest Login</Link>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
