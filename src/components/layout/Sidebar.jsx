import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { notificationService } from '../../services/notificationService';
import { Home, Calendar, Clock, CreditCard, Bell, Settings, Users, DoorOpen, MessageSquare, Coffee } from 'lucide-react';

export default function Sidebar({ isOpen, closeSidebar }) {
  const { user } = useAuth();
  const location = useLocation();
  const [indicators, setIndicators] = useState({
    notifications: false,
    payment: false,
    teacherApplications: false,
    adminBookings: false,
    adminDining: false,
    adminPayments: false,
    adminComplaints: false
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchIndicators = async () => {
      try {
        const unreadNotifCount = await notificationService.getUnreadCount(user.id, user.role);
        const hasUnreadNotifications = unreadNotifCount > 0;

        if (user.role === 'admin') {
          const allBookings = await bookingService.getAllBookings();
          const pendingBookings = allBookings.some(b => b.approvalStatus === 'PENDING_ADMIN_APPROVAL');
          
          const { mealService } = await import('../../services/mealService');
          const allMeals = await mealService.getAllMeals();
          const pendingMeals = allMeals.some(m => m.status === 'PENDING');

          const { complaintService } = await import('../../services/complaintService');
          const allComplaints = await complaintService.getAllComplaints();
          const pendingComplaints = allComplaints.some(c => c.status === 'Open');

          setIndicators(prev => ({
            ...prev,
            notifications: hasUnreadNotifications,
            adminBookings: pendingBookings,
            adminDining: pendingMeals,
            adminComplaints: pendingComplaints,
            adminPayments: allBookings.some(b => b.paymentStatus === 'PENDING' && b.bookingStatus !== 'CANCELLED' && b.approvalStatus !== 'CANCELLED' && b.approvalStatus !== 'REJECTED')
          }));
        } else {
          // Guest / Teacher
          const userBookings = await bookingService.getStudentBookings(user);
          const hasDuePayment = userBookings.some(b => 
            b.paymentStatus === 'PENDING' && 
            b.approvalStatus === 'PENDING_PAYMENT' && 
            b.bookingStatus !== 'CANCELLED'
          );
          
          let hasPendingTeacherApprovals = false;
          if (user.role === 'teacher') {
            const allBookings = await bookingService.getAllBookings();
            hasPendingTeacherApprovals = allBookings.some(b => 
              b.approvingTeacherId === user.id && b.approvalStatus === 'PENDING_TEACHER_APPROVAL' && b.bookingStatus !== 'CANCELLED'
            );
          }

          setIndicators(prev => ({ 
            ...prev, 
            notifications: hasUnreadNotifications,
            payment: hasDuePayment,
            teacherApplications: hasPendingTeacherApprovals 
          }));
        }
      } catch (err) {
        console.error("Failed to fetch sidebar indicators", err);
      }
    };
    
    fetchIndicators();
    
    // Listen to custom events for instant updates
    window.addEventListener('indicatorsChanged', fetchIndicators);
    window.addEventListener('notificationsChanged', fetchIndicators);

    const interval = setInterval(fetchIndicators, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('indicatorsChanged', fetchIndicators);
      window.removeEventListener('notificationsChanged', fetchIndicators);
    };
  }, [user, location.pathname]);

  if (!user) return null;

  const getBadge = (label) => {
    if (label === 'Notifications' && indicators.notifications) return true;
    if ((label === 'Payment' || label === 'Payments') && user.role !== 'admin' && indicators.payment) return true;
    if (user.role === 'teacher' && label === 'Student Applications' && indicators.teacherApplications) return true;
    
    if (user.role === 'admin') {
      if (label === 'Bookings' && indicators.adminBookings) return true;
      if (label === 'Dining' && indicators.adminDining) return true;
      if (label === 'Payments' && indicators.adminPayments) return true;
      if (label === 'Complaints' && indicators.adminComplaints) return true;
    }
    return false;
  };

  const studentLinks = [
    { to: '/student/dashboard', icon: <Home size={20} />, label: 'Dashboard' },
    { to: '/student/rooms', icon: <DoorOpen size={20} />, label: 'Book a Room' },
    { to: '/student/meals', icon: <Coffee size={20} />, label: 'Dining' },
    { to: '/student/history', icon: <Clock size={20} />, label: 'History' },
    { to: '/student/payment', icon: <CreditCard size={20} />, label: 'Payments' },
    { to: '/student/notifications', icon: <Bell size={20} />, label: 'Notifications' },
    { to: '/student/complaints', icon: <MessageSquare size={20} />, label: 'Complaints' },
    { to: '/student/profile', icon: <Settings size={20} />, label: 'Profile' }
  ];

  const adminLinks = [
    { to: '/admin/dashboard', icon: <Home size={20} />, label: 'Dashboard' },
    { to: '/admin/bookings', icon: <Calendar size={20} />, label: 'Bookings' },
    { to: '/admin/rooms', icon: <DoorOpen size={20} />, label: 'Rooms' },
    { to: '/admin/meals', icon: <Coffee size={20} />, label: 'Dining' },
    { to: '/admin/payments', icon: <CreditCard size={20} />, label: 'Payments' },
    { to: '/admin/users', icon: <Users size={20} />, label: 'Users' },
    { to: '/admin/notifications', icon: <Bell size={20} />, label: 'Notifications' },
    { to: '/admin/complaints', icon: <MessageSquare size={20} />, label: 'Complaints' },
    { to: '/admin/profile', icon: <Settings size={20} />, label: 'Profile' }
  ];

  const teacherLinks = [
    { to: '/teacher/dashboard', icon: <Home size={20} />, label: 'Dashboard' },
    { to: '/teacher/applications', icon: <Users size={20} />, label: 'Student Applications' },
    { to: '/teacher/rooms', icon: <Calendar size={20} />, label: 'Apply for Guest House' },
    { to: '/teacher/meals', icon: <Coffee size={20} />, label: 'Dining' },
    { to: '/teacher/history', icon: <Clock size={20} />, label: 'My Applications' },
    { to: '/teacher/notifications', icon: <Bell size={20} />, label: 'Notifications' },
    { to: '/teacher/complaints', icon: <MessageSquare size={20} />, label: 'Complaints' },
    { to: '/teacher/payment', icon: <CreditCard size={20} />, label: 'Payment' },
    { to: '/teacher/profile', icon: <Settings size={20} />, label: 'Profile' }
  ];

  const links = user.role === 'admin' ? adminLinks : user.role === 'teacher' ? teacherLinks : studentLinks;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          onClick={closeSidebar}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 45
          }}
          className="md-hidden"
        ></div>
      )}

      {/* Sidebar */}
      <aside style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: 'min(260px, 82vw)',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform var(--transition-normal)',
        zIndex: 50,
        overflowY: 'auto'
      }} className="sidebar">
        <nav style={{ padding: 'var(--spacing-4) 0' }}>
          <div style={{ padding: '0 var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">
              {user.role === 'admin' ? 'Admin Portal' : user.role === 'teacher' ? 'Teacher Portal' : 'Guest Portal'}
            </p>
          </div>
          <ul style={{ listStyle: 'none' }}>
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => window.innerWidth < 768 && closeSidebar()}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {link.icon}
                    <span>{link.label}</span>
                  </div>
                  {getBadge(link.label) && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#ef4444', // Red dot
                      borderRadius: '50%',
                      flexShrink: 0
                    }}></span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Styles for responsive layout applied via global css or inline */}
      <style>{`
        .sidebar {
          top: 58px;
        }
        @media (min-width: 768px) {
          .sidebar { 
            transform: translateX(0) !important; 
            top: 68px !important;
            width: 250px !important;
          }
          .md-hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
