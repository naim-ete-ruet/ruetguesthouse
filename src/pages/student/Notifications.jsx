import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle, AlertCircle, Trash2, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { supabase } from '../../config/supabaseClient';
import { Link } from 'react-router-dom';

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await notificationService.getUserNotifications(user.id, user.role);
    setNotifications(data || []);
    setLoading(false);
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener('notificationsChanged', handleUpdate);
    window.addEventListener('indicatorsChanged', handleUpdate);

    // Supabase Realtime channel for instant cross-device updates
    const channel = supabase
      .channel('realtime_user_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      window.removeEventListener('notificationsChanged', handleUpdate);
      window.removeEventListener('indicatorsChanged', handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  const handleMarkAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await notificationService.markAllAsRead(user.id, user.role);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    setDeletingId(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    await notificationService.deleteNotification(id);
    setDeletingId(null);
  };

  const handleClearAll = async () => {
    if (!user?.id) return;
    if (window.confirm('Are you sure you want to delete all notifications from your account? This action cannot be undone.')) {
      setNotifications([]);
      await notificationService.deleteAllNotifications(user.id, user.role);
    }
  };

  const getIconContainer = (type) => {
    switch (type) {
      case 'success':
        return (
          <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
            <CheckCircle size={22} />
          </div>
        );
      case 'warning':
        return (
          <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
            <AlertTriangle size={22} />
          </div>
        );
      case 'danger':
      case 'error':
        return (
          <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
            <AlertCircle size={22} />
          </div>
        );
      default:
        return (
          <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--color-primary)' }}>
            <Info size={22} />
          </div>
        );
    }
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted">
            Stay updated with your bookings, approvals, and portal updates.
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                onClick={handleMarkAllAsRead}
                className="btn btn-outline flex items-center gap-1.5"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                title="Mark all notifications as read"
              >
                <CheckCheck size={16} /> Mark all read
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="btn btn-outline text-danger flex items-center gap-1.5"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              title="Delete all notifications permanently from database"
            >
              <Trash2 size={16} /> Clear all
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="card p-8 text-center text-muted">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
          <p>Loading notifications from database...</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div className="card p-12 text-center" style={{ backgroundColor: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(79, 70, 229, 0.08)', color: 'var(--color-primary)' }}>
            <Bell size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-1">No notifications</h3>
          <p className="text-sm text-muted max-w-sm mx-auto">
            You don't have any notifications right now. When you make a booking, receive teacher approvals, or submit a complaint, updates will appear here.
          </p>
        </div>
      ) : (
        /* Notifications List */
        <div className="flex flex-col gap-3">
          {notifications.map((notif, index) => {
            const isUnread = !notif.is_read;
            return (
              <div
                key={notif.id}
                className="card p-4 flex gap-4 transition hover-scale relative"
                style={{
                  animation: `fadeIn 0.3s ease forwards ${(index + 1) * 0.05}s`,
                  backgroundColor: 'var(--color-surface)',
                  border: isUnread ? '1px solid var(--color-primary-light, #c7d2fe)' : '1px solid var(--color-border)',
                  boxShadow: isUnread ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  opacity: deletingId === notif.id ? 0.4 : 1
                }}
              >
                {/* Left accent bar for unread */}
                {isUnread && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      background: 'var(--color-primary)',
                      borderTopLeftRadius: 'var(--radius-md, 8px)',
                      borderBottomLeftRadius: 'var(--radius-md, 8px)'
                    }}
                  />
                )}

                {getIconContainer(notif.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-semibold text-base flex items-center gap-2 flex-wrap">
                      <span>{notif.title}</span>
                      {isUnread && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)'
                          }}
                        />
                      )}
                    </h4>
                    <span className="text-xs text-muted flex-shrink-0">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>

                  <p className="text-sm text-muted mb-2 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    {(() => {
                      let targetLink = notif.link;
                      if (targetLink === '/admin/dining') targetLink = '/admin/meals';
                      if (targetLink === '/student/dining') targetLink = '/student/meals';
                      if (targetLink === '/teacher/dining') targetLink = '/teacher/meals';
                      if (!targetLink && notif.title?.toLowerCase().includes('meal')) targetLink = '/admin/meals';

                      return targetLink ? (
                        <Link
                          to={targetLink}
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          View details →
                        </Link>
                      ) : null;
                    })()}

                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-xs text-muted hover:text-primary transition"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Mark as read
                      </button>
                    )}

                    {/* Delete single notification button */}
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      className="text-xs text-muted hover:text-danger transition ml-auto flex items-center gap-1"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                      title="Delete this notification from database"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
