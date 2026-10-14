import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

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
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationState, setRegistrationState] = useState('form');
  
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Create user without auto-login yet
      await authService.register({
        name: formData.name,
        rollNo: formData.rollNo,
        department: formData.department,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password
      });
      // Show verification step
      setRegistrationState('verificationSent');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setIsLoading(true);
    try {
      // Email verification logic would go here
      await login(formData.email, formData.password);
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex justify-center items-center py-8" style={{ minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
        
        {registrationState === 'verificationSent' ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Verify Your Email</h2>
            <div className="p-4 rounded mb-6" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid var(--color-success)' }}>
              A verification link has been sent to <strong>{formData.email}</strong>.
            </div>
            <p className="text-muted text-sm mb-6">
              Please check your inbox and click the link to verify your account and complete registration.
            </p>
            <div className="p-4 rounded mb-4" style={{ backgroundColor: 'var(--color-background)' }}>
              <button 
                onClick={handleVerifyEmail}
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Verifying...' : 'Verify Email & Login'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Guest Registration</h2>
              <p className="text-muted text-sm mt-2">Create an account to book a room</p>
            </div>

        {error && (
          <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input 
              id="name" name="name" type="text" className="form-input" required
              value={formData.name} onChange={handleChange} placeholder="e.g. Mohammad Naim"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="rollNo">Roll / ID No.</label>
              <input 
                id="rollNo" name="rollNo" type="text" className="form-input" required
                value={formData.rollNo} onChange={handleChange} placeholder="e.g. 2204024"
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input 
                id="email" name="email" type="email" className="form-input" required
                value={formData.email} onChange={handleChange} placeholder="name@example.com"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="department">Department</label>
              <select id="department" name="department" className="form-select" value={formData.department} onChange={handleChange}>
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
              <label className="form-label" htmlFor="mobile">Mobile Number</label>
              <input 
                id="mobile" name="mobile" type="tel" className="form-input" required
                value={formData.mobile} onChange={handleChange} placeholder="e.g. 017XXXXXXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input 
                id="password" name="password" type="password" className="form-input" required
                value={formData.password} onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input 
                id="confirmPassword" name="confirmPassword" type="password" className="form-input" required
                value={formData.confirmPassword} onChange={handleChange}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full mt-4"
            disabled={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted">Already have an account? </span>
          <Link to="/login" className="text-primary font-medium">Login here</Link>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
