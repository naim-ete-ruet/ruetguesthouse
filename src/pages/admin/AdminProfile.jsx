import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { Shield, Mail, Phone, Lock, Edit3, Save, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function AdminProfile() {
  const { user } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  
  const [profileData, setProfileData] = useState({
    name: user?.name || 'Administrator',
    email: user?.email || 'admin@example.com',
    mobile: user?.mobile || '01700000001',
    role: 'Administrator',
    department: 'Guest House Management'
  });

  const handleSave = () => {
    setIsEditing(false);
    alert("Admin profile details updated successfully!");
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert("New passwords do not match!");
      return;
    }
    if (passwordForm.new.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      await authService.changePassword(user.id, passwordForm.current, passwordForm.new);
      setIsChangingPassword(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      alert("Password changed successfully! Next time you login, use your new password.");
    } catch (err) {
      alert(err.message || "Failed to change password. Please check your current password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <h1 className="text-2xl font-bold mb-6">Admin Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Avatar and basic info */}
        <div className="md:col-span-1">
          <div className="card text-center mb-6">
            <div style={{
              width: '120px', height: '120px', margin: '0 auto 16px', borderRadius: '50%',
              backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={64} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-xl font-bold text-primary">{profileData.name}</h2>
            <p className="text-muted text-sm mt-1">{profileData.department}</p>
            <div className="badge badge-primary mt-3">Super Admin</div>
          </div>

          <div className="card border-l-4" style={{ borderLeft: '4px solid var(--color-success)' }}>
            <h3 className="font-bold mb-3 flex items-center gap-2"><CheckCircle size={18} className="text-success" /> System Status</h3>
            <p className="text-sm text-muted">All systems are operational. You have full administrative privileges.</p>
          </div>
        </div>

        {/* Right Col: Details and Edit Form */}
        <div className="md:col-span-2">
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-6 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="font-bold text-lg">Administrator Information</h3>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                  <Edit3 size={16} /> Edit Profile
                </button>
              ) : (
                <button onClick={handleSave} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                  <Save size={16} /> Save Changes
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Shield size={16} /> Full Name</label>
                {isEditing ? (
                  <input type="text" className="form-input" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.name}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Mail size={16} /> Admin Email</label>
                {isEditing ? (
                  <input type="email" className="form-input" value={profileData.email} disabled title="Admin email cannot be changed" style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.email}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Phone size={16} /> Support Mobile</label>
                {isEditing ? (
                  <input type="text" className="form-input" value={profileData.mobile} onChange={e => setProfileData({...profileData, mobile: e.target.value})} />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.mobile}</div>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Shield size={16} /> Role Access</label>
                <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.role}</div>
              </div>
            </div>
          </div>

          <div className="card border-l-4" style={{ borderLeft: '4px solid var(--color-warning)' }}>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Lock size={20} className="text-warning" /> Security Settings</h3>
            
            {!isChangingPassword ? (
              <>
                <p className="text-sm text-muted mb-4">Update your admin portal password. This uses the synchronized authentication service.</p>
                <div className="flex items-center gap-4">
                  <button className="btn btn-secondary" onClick={() => setIsChangingPassword(true)}>Change Password</button>
                  <button 
                    className="text-primary text-sm font-medium" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={async () => {
                      try {
                        alert('Sending password reset link...');
                        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: profileData.email })
                        });
                        const data = await response.json();
                        if (response.ok) {
                          alert(`Success: ${data.message}`);
                        } else {
                          alert(`Error: ${data.error}`);
                        }
                      } catch (err) {
                        alert('Failed to connect to the server.');
                      }
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handlePasswordChange} className="animate-fade-in">
                <div className="form-group mb-3">
                  <label className="form-label">Current Admin Password</label>
                  <input type="password" required className="form-input" 
                    value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">New Password</label>
                  <input type="password" required className="form-input" 
                    value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} />
                </div>
                <div className="form-group mb-4">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" required className="form-input" 
                    value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn btn-primary" disabled={isUpdatingPassword} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={isUpdatingPassword} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={() => { setIsChangingPassword(false); setPasswordForm({ current: '', new: '', confirm: '' }); }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
