import { useState, useEffect } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Notifications() {
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem(`notifications_${user?.id}`);
    if (saved) return JSON.parse(saved);
    
    return [
    {
      id: 1,
      type: 'success',
      title: 'Booking Approved',
      message: 'Your booking BKG-2026-001 has been approved. Please complete the payment within 2 hours.',
      timestamp: '2 hours ago',
      read: false
    },
    {
      id: 2,
      type: 'info',
      title: 'Booking Submitted',
      message: 'Your booking request has been submitted and is pending teacher approval.',
      timestamp: '1 day ago',
      read: true
    },
    {
      id: 25,
      type: 'success',
      title: 'Teacher Approval Received',
      message: 'Your department teacher has approved your booking. Please proceed to payment.',
      timestamp: '1 hour ago',
      read: false
    },    {
      id: 3,
      type: 'warning',
      title: 'Payment Deadline Approaching',
      message: 'You have 30 minutes left to complete payment for BKG-2026-001.',
      timestamp: '5 mins ago',
      read: false
    }
  ]});

  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifications));
      const hasUnread = notifications.some(n => !n.read);
      localStorage.setItem(`hasUnread_${user.id}`, hasUnread ? 'true' : 'false');
      
      // Dispatch custom event so Sidebar updates instantly
      window.dispatchEvent(new Event('indicatorsChanged'));
    }
  }, [notifications, user]);

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getIconContainer = (type) => {
    switch (type) {
      case 'success': return (
        <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
          <CheckCircle size={24} />
        </div>
      );
      case 'warning': return (
        <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
          <AlertTriangle size={24} />
        </div>
      );
      default: return (
        <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--color-primary)' }}>
          <Info size={24} />
        </div>
      );
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell /> Notifications
        </h1>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead} 
            className="btn"
            style={{ 
              padding: '0.4rem 0.8rem', 
              fontSize: '0.85rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {notifications.map((notif, index) => (
          <div 
            key={notif.id} 
            className={`card p-5 flex gap-4 transition hover-scale`}
            style={{ 
              animation: `fadeIn 0.5s ease forwards ${(index + 1) * 0.1}s`,
              opacity: 0,
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: 'var(--color-surface)',
              border: notif.read ? '1px solid var(--color-border)' : '1px solid var(--color-primary-light)',
              boxShadow: notif.read ? 'var(--shadow-sm)' : 'var(--shadow-md)'
            }}
          >
            {/* Unread Indicator Bar */}
            {!notif.read && (
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'linear-gradient(to bottom, var(--color-primary), #818CF8)' }} />
            )}

            {getIconContainer(notif.type)}
            
            <div className="flex-1 flex flex-col justify-center">
              <div className="mb-1">
                <h4 className="font-bold text-lg" style={{ color: notif.read ? 'var(--color-text)' : 'var(--color-text)' }}>
                  {notif.title}
                  <span className="text-xs text-muted font-medium font-normal">&nbsp;&nbsp;({notif.timestamp})</span>
                  {!notif.read && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', marginLeft: '8px', verticalAlign: 'middle' }}></span>}
                </h4>
              </div>
              <p className="text-sm text-muted mb-2" style={{ lineHeight: '1.5' }}>{notif.message}</p>
              
              {!notif.read && (
                <div className="mt-2">
                  <button 
                    onClick={() => markAsRead(notif.id)}
                    className="text-xs font-semibold"
                    style={{ 
                      padding: '4px 12px', 
                      borderRadius: 'var(--radius-full)', 
                      backgroundColor: 'var(--color-primary)', 
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    Mark as Read
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
