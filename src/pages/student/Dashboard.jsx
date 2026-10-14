import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { Calendar, Clock, CreditCard, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [latestBooking, setLatestBooking] = useState(null);
  const [stats, setStats] = useState({ totalBookings: 0, pendingPayments: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const bookings = await bookingService.getStudentBookings(user.id);
        if (bookings.length > 0) {
          setLatestBooking(bookings[0]);
        }
        setStats({
          totalBookings: bookings.length,
          pendingPayments: bookings.filter(b => b.approvalStatus === 'PENDING_PAYMENT' && b.paymentStatus === 'PENDING' && b.bookingStatus !== 'CANCELLED').length
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    window.addEventListener('indicatorsChanged', fetchDashboardData);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchDashboardData);
    };
  }, [user.id]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Welcome back, {user.name}</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium">Total Bookings</p>
            <p className="text-2xl font-bold mt-1">{stats.totalBookings}</p>
          </div>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--color-primary)' }}>
            <Calendar size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium">Pending Payments</p>
            <p className="text-2xl font-bold mt-1 text-warning">{stats.pendingPayments}</p>
          </div>
          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--color-warning)' }}>
            <CreditCard size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current/Latest Booking */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4">Current Booking</h2>
          {latestBooking ? (
            <div className="card hover-scale animate-stagger-3">
              <div className="flex justify-between items-start mb-4 border-bottom pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{latestBooking.id}</span>
                    <span className={`badge ${latestBooking.bookingStatus === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`}>
                      {latestBooking.bookingStatus}
                    </span>
                  </div>
                  <p className="text-muted text-sm">
                    {latestBooking.checkInDate} to {latestBooking.checkOutDate} ({latestBooking.totalDays} nights)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">Amount</p>
                  <p className="font-bold text-lg">৳{latestBooking.totalAmount}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted mb-1 uppercase tracking-wider">Room</p>
                  <p className="font-medium">{latestBooking.assignedRoom || 'Pending Assignment'}</p>
                  <p className="text-sm text-muted">{latestBooking.requestedRoomType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1 uppercase tracking-wider">Approval & Payment</p>
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-sm">
                      {latestBooking.approvalStatus === 'APPROVED' ? <CheckCircle size={14} className="text-success" /> : <Clock size={14} className="text-warning" />}
                      Approval: {latestBooking.approvalStatus.replace(/_/g, ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      {(latestBooking.paymentStatus === 'PAID' || latestBooking.paymentStatus === 'COMPLETED') ? <CheckCircle size={14} className="text-success" /> : <AlertTriangle size={14} className="text-warning" />}
                      Payment: {latestBooking.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deadline Card */}
              {latestBooking.approvalStatus === 'PENDING_PAYMENT' && latestBooking.paymentStatus === 'PENDING' && latestBooking.bookingStatus !== 'CANCELLED' && (
                <div className="p-3 rounded mb-4 flex justify-between items-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)' }}>
                  <div>
                    <p className="text-sm font-bold text-warning flex items-center gap-1">
                      <Clock size={16} /> Payment required to confirm booking
                    </p>
                    <p className="text-xs text-warning mt-1">
                      {latestBooking.requestedRoomType === 'TYPE_3' ? 'Deadline: 2 hours' : 'Deadline: 5 minutes'}
                    </p>
                  </div>
                  <Link to="/student/payment" className="btn btn-primary" style={{ backgroundColor: 'var(--color-warning)' }}>Pay Now</Link>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Link to="/student/history" className="text-primary text-sm font-medium flex items-center gap-1">
                  View full details <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="card hover-scale animate-stagger-3 text-center py-12">
              <div style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Calendar size={32} className="text-muted" />
              </div>
              <h3 className="font-bold text-lg mb-2">No active bookings</h3>
              <p className="text-muted mb-4">You haven't made any bookings yet.</p>
              <Link to="/student/rooms" className="btn btn-primary">Book a Room</Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="animate-stagger-4">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="flex flex-col gap-3">
            <Link to="/student/rooms" className="card flex items-center gap-3 p-4 hover:border-primary transition hover-scale" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ backgroundColor: 'rgba(30, 58, 138, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--color-primary)' }}>
                <Calendar size={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold">Book a Room</h4>
                <p className="text-xs text-muted">Create a new reservation</p>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Link>
            
            <Link to="/student/rooms" className="card flex items-center gap-3 p-4 hover:border-primary transition hover-scale" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--color-success)' }}>
                <CheckCircle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold">Check Availability</h4>
                <p className="text-xs text-muted">See available rooms</p>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
