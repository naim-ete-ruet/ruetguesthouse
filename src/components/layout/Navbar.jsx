import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Menu, LogOut, User } from 'lucide-react';

export default function Navbar({ toggleSidebar }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  
  const userDropdownRef = useRef(null);
  const loginDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (loginDropdownRef.current && !loginDropdownRef.current.contains(event.target)) {
        setLoginDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar flex justify-between items-center" style={{ 
      padding: 'var(--spacing-4) var(--spacing-6)', 
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div className="flex items-center gap-4">
        {user && (
          <button className="md-hidden btn btn-secondary" onClick={toggleSidebar} style={{ padding: '0.5rem' }}>
            <Menu size={20} />
          </button>
        )}
        <Link to="/" className="flex items-center gap-2">
          {/* RUET Logo */}
          <img src="/images/ruet-logo.jpg" alt="RUET Logo" style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
          <span className="font-bold text-lg hidden md:block" style={{ color: 'var(--color-primary)' }}>
            RUET Guest House
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={toggleTheme} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }}>
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {user ? (
          <div style={{ position: 'relative' }} ref={userDropdownRef}>
            <button 
              className="flex items-center gap-2 btn btn-secondary hover-scale"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <User size={18} />
              <span className="hidden md:block">{user.name}</span>
            </button>

            {dropdownOpen && (
              <div className="animate-fade-in" style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '0.5rem',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                width: '200px',
                overflow: 'hidden',
                zIndex: 50
              }}>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>{user.email}</p>
                </div>
                <Link to={user.role === 'admin' ? '/admin/profile' : user.role === 'teacher' ? '/teacher/profile' : '/student/profile'} 
                      className="dropdown-link" 
                      onClick={() => setDropdownOpen(false)}>
                  Profile
                </Link>
                <button 
                  onClick={handleLogout}
                  className="dropdown-link text-danger flex items-center gap-2"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div style={{ position: 'relative' }} ref={loginDropdownRef}>
                <button 
                  className="btn btn-secondary hover-scale flex items-center gap-2"
                  onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                >
                  <User size={18} />
                  <span>Login</span>
                </button>
                
                {loginDropdownOpen && (
                  <div className="animate-fade-in" style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '0.5rem',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '180px',
                    overflow: 'hidden',
                    zIndex: 50
                  }}>
                    <Link to="/login" className="dropdown-link" onClick={() => setLoginDropdownOpen(false)}>Guest Login</Link>
                    <Link to="/teacher/login" className="dropdown-link" onClick={() => setLoginDropdownOpen(false)}>Teacher Login</Link>
                    <Link to="/admin/login" className="dropdown-link" onClick={() => setLoginDropdownOpen(false)}>Admin Login</Link>
                  </div>
                )}
              </div>
              <Link to="/register" className="btn btn-primary hover-scale">Register</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
