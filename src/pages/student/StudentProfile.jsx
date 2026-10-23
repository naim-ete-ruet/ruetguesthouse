import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { bookingService } from '../../services/bookingService';
import { User, Mail, Phone, Book, Lock, Edit3, Save, X, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function StudentProfile() {
  const { user, updateUserProfile } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0 });

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    department: user?.department ? user.department.toUpperCase() : '',
    designation: user?.designation || (user?.role === 'teacher' ? 'Faculty Member' : 'Student'),
    rollNumber: user?.role === 'teacher' ? user?.id : (user?.rollNo || user?.nid || 'N/A')
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        mobile: user.mobile || '',
        department: user.department ? user.department.toUpperCase() : '',
        designation: user.designation || (user.role === 'teacher' ? 'Faculty Member' : 'Student'),
        rollNumber: user.role === 'teacher' ? user.id : (user.rollNo || user.nid || 'N/A')
      });
      
      bookingService.getStudentBookings(user)
        .then(bookings => {
          setStats({
            total: bookings.length,
            active: bookings.filter(b => b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'PENDING').length
          });
        })
        .catch(err => console.error("Failed to load user booking stats:", err));
    }
  }, [user]);

  const showNotification = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!profileData.name.trim()) {
      showNotification('error', 'Full Name is required.');
      return;
    }

    try {
      setIsSaving(true);
      await updateUserProfile({
        name: profileData.name,
        mobile: profileData.mobile,
        department: profileData.department,
        designation: profileData.designation
      });
      setIsEditing(false);
      showNotification('success', 'Profile updated successfully in Supabase database!');
    } catch (err) {
      console.error("Profile update error:", err);
      showNotification('error', err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        mobile: user.mobile || '',
        department: user.department ? user.department.toUpperCase() : '',
        designation: user.designation || (user.role === 'teacher' ? 'Faculty Member' : 'Student'),
        rollNumber: user.role === 'teacher' ? user.id : (user.rollNo || user.nid || 'N/A')
      });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      showNotification('error', "New passwords do not match!");
      return;
    }
    if (passwordForm.new.length < 6) {
      showNotification('error', "Password must be at least 6 characters.");
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      await authService.changePassword(user.id, passwordForm.current, passwordForm.new);
      setIsChangingPassword(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      showNotification('success', "Password updated successfully in Supabase database!");
    } catch (err) {
      showNotification('error', err.message || "Failed to change password. Please check your current password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <h1 className="text-2xl font-bold mb-6">{user?.role === 'teacher' ? 'Teacher Profile' : 'Guest Profile'}</h1>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div 
          className="mb-4 p-3 rounded flex items-center gap-2 animate-fade-in"
          style={{
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
            color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium text-sm">{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Avatar and basic info */}
        <div className="md:col-span-1" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card text-center mb-6">
            <div style={{
              width: '120px', height: '120px', margin: '0 auto 16px', borderRadius: '50%',
              backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <User size={64} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-xl font-bold text-primary">{profileData.name}</h2>
            <p className="text-muted text-sm mt-1">{profileData.department || 'General'}</p>
            <div className="badge badge-primary mt-3">
              {user?.role === 'teacher' ? 'ID' : 'Roll'}: {profileData.rollNumber}
            </div>
          </div>

          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="font-bold mb-4 border-bottom pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>Quick Stats</h3>
            <div className="flex flex-col gap-3 flex-1 justify-around text-sm">
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Total Bookings</span>
                <span className="font-bold text-base">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Active Bookings</span>
                <span className="font-bold text-success text-base">{stats.active}</span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Role Category</span>
                <span className="font-medium">{user?.role === 'teacher' ? 'Faculty Member' : 'Student / Guest'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Account Status</span>
                <span className="badge badge-success">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Details and Edit Form */}
        <div className="md:col-span-2">
          <div className="card mb-6">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-6 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="font-bold text-lg">Personal Information</h3>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                  <Edit3 size={16} /> Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="btn btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    onClick={handleCancelEdit} 
                    disabled={isSaving}
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><User size={16} /> Full Name</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileData.name} 
                    onChange={e => setProfileData({...profileData, name: e.target.value})} 
                    placeholder="Enter full name"
                  />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.name}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Book size={16} /> Department</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileData.department} 
                    onChange={e => setProfileData({...profileData, department: e.target.value})} 
                    placeholder="e.g. ETE, CSE, EEE"
                  />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.department || 'N/A'}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Mail size={16} /> Email Address</label>
                {isEditing ? (
                  <input 
                    type="email" 
                    className="form-input" 
                    value={profileData.email} 
                    disabled 
                    title="Account email address cannot be modified" 
                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} 
                  />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.email}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label text-muted flex items-center gap-2"><Phone size={16} /> Mobile Number</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileData.mobile} 
                    onChange={e => setProfileData({...profileData, mobile: e.target.value})} 
                    placeholder="Enter mobile number"
                  />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.mobile || 'Not set'}</div>
                )}
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label text-muted flex items-center gap-2"><Briefcase size={16} /> Designation</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileData.designation} 
                    onChange={e => setProfileData({...profileData, designation: e.target.value})} 
                    placeholder="e.g. Professor, Lecturer, Student"
                  />
                ) : (
                  <div className="font-medium p-2 bg-gray-50 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>{profileData.designation || 'Student'}</div>
                )}
              </div>
            </div>
          </div>

          <div className="card border-l-4" style={{ borderLeft: '4px solid var(--color-warning)' }}>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Lock size={20} className="text-warning" /> Security Settings</h3>
            
            {!isChangingPassword ? (
              <>
                <p className="text-sm text-muted mb-4">Update your password to keep your account secure.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn btn-secondary" onClick={() => setIsChangingPassword(true)}>Change Password</button>
                  <button 
                    className="text-primary text-sm font-medium" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={async () => {
                      try {
                        showNotification('success', 'Sending password reset link...');
                        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: profileData.email })
                        });
                        const data = await response.json();
                        if (response.ok) {
                          showNotification('success', data.message || 'Password reset link sent to your email.');
                        } else {
                          showNotification('error', data.error || 'Failed to send reset link.');
                        }
                      } catch (err) {
                        showNotification('error', 'Failed to connect to the server.');
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
                  <label className="form-label">Current Password</label>
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
