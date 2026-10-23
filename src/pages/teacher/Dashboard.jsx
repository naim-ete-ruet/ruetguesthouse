import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { Link } from 'react-router-dom';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    myTotal: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const bookings = await bookingService.getStudentBookings(user);
        const allBookings = await bookingService.getAllBookings();
        
        const teacherBookings = allBookings.filter(b => {
          if (b.approvingTeacherId !== user.id) return false;
          if (b.userId === user.id) return false;
          return true;
        });

        setStats({
          total: teacherBookings.length,
          pending: teacherBookings.filter(b => b.approvalStatus === 'PENDING_TEACHER_APPROVAL' && b.bookingStatus !== 'CANCELLED').length,
          approved: teacherBookings.filter(b => ['PENDING_PAYMENT', 'PENDING_ADMIN_APPROVAL', 'APPROVED'].includes(b.approvalStatus) && b.bookingStatus !== 'CANCELLED').length,
          rejected: teacherBookings.filter(b => b.approvalStatus === 'REJECTED_BY_TEACHER').length,
          myTotal: bookings.length
        });
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();

    window.addEventListener('indicatorsChanged', fetchStats);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchStats);
    };
  }, [user]);

  if (isLoading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="container">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted text-sm sm:text-base">Welcome, {user.name} ({user.department?.toUpperCase() || 'Dept'})</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <Link to="/teacher/applications" className="btn btn-primary flex-1 sm:flex-none text-center">Review Applications</Link>
          <Link to="/teacher/rooms" className="btn btn-secondary flex-1 sm:flex-none text-center">Apply for Guest House</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="card flex items-center p-4 sm:p-6 gap-4 border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
            <FileText size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-muted text-sm font-medium">Assigned Applications</p>
            <h3 className="text-2xl font-bold">{stats.total}</h3>
          </div>
        </div>
        
        <div className="card flex items-center p-6 gap-4 border-l-4" style={{ borderLeftColor: 'var(--color-warning)' }}>
          <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <Clock size={24} className="text-warning" />
          </div>
          <div>
            <p className="text-muted text-sm font-medium">Pending Approvals</p>
            <h3 className="text-2xl font-bold">{stats.pending}</h3>
          </div>
        </div>
        
        <div className="card flex items-center p-6 gap-4 border-l-4" style={{ borderLeftColor: 'var(--color-success)' }}>
          <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <CheckCircle size={24} className="text-success" />
          </div>
          <div>
            <p className="text-muted text-sm font-medium">Approved</p>
            <h3 className="text-2xl font-bold">{stats.approved}</h3>
          </div>
        </div>

        <div className="card flex items-center p-6 gap-4 border-l-4" style={{ borderLeftColor: 'var(--color-danger)' }}>
          <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <XCircle size={24} className="text-danger" />
          </div>
          <div>
            <p className="text-muted text-sm font-medium">Rejected</p>
            <h3 className="text-2xl font-bold">{stats.rejected}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Quick Links</h2>
          <div className="flex flex-col gap-2">
            <Link to="/teacher/applications" className="btn btn-secondary w-full justify-start">Assigned Applications</Link>
            <Link to="/teacher/history" className="btn btn-secondary w-full justify-start">My Applications ({stats.myTotal || 0})</Link>
            <Link to="/teacher/notifications" className="btn btn-secondary w-full justify-start">Notifications</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
