import { useState, useEffect } from 'react';
import { bookingService } from '../../services/bookingService';
import { roomService } from '../../services/roomService';
import { supabase } from '../../config/supabaseClient';
import { Users, Calendar, DoorOpen, CreditCard, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    pendingRequests: 0,
    approvedBookings: 0,
    pendingPayments: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const rooms = await roomService.getAllRooms();
        const bookings = await bookingService.getAllBookings();

        setStats({
          totalRooms: rooms.length,
          availableRooms: rooms.filter(r => r.status === 'available').length,
          occupiedRooms: rooms.filter(r => r.status === 'occupied').length,
          pendingRequests: bookings.filter(b => b.approvalStatus === 'PENDING_ADMIN_APPROVAL' && b.bookingStatus !== 'CANCELLED').length,
          approvedBookings: bookings.filter(b => b.approvalStatus === 'APPROVED' && b.bookingStatus !== 'CANCELLED').length,
          pendingPayments: bookings.filter(b => b.paymentStatus === 'PENDING' && b.bookingStatus !== 'CANCELLED' && b.approvalStatus !== 'CANCELLED' && b.approvalStatus !== 'REJECTED').length
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();

    window.addEventListener('indicatorsChanged', fetchStats);
    window.addEventListener('roomsChanged', fetchStats);

    const channel = supabase
      .channel('realtime_admin_dashboard_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      window.removeEventListener('indicatorsChanged', fetchStats);
      window.removeEventListener('roomsChanged', fetchStats);
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium">Pending Requests</p>
            <p className="text-2xl font-bold mt-1 text-warning">{stats.pendingRequests}</p>
          </div>
          <div className="p-3 rounded-full bg-warning bg-opacity-10 text-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
            <Clock size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium">Available Rooms</p>
            <p className="text-2xl font-bold mt-1 text-success">{stats.availableRooms}</p>
          </div>
          <div className="p-3 rounded-full bg-success bg-opacity-10 text-success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
            <DoorOpen size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium">Occupied Rooms</p>
            <p className="text-2xl font-bold mt-1 text-danger">{stats.occupiedRooms}</p>
          </div>
          <div className="p-3 rounded-full bg-danger bg-opacity-10 text-danger" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
            <DoorOpen size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium">Pending Payments</p>
            <p className="text-2xl font-bold mt-1 text-warning">{stats.pendingPayments}</p>
          </div>
          <div className="p-3 rounded-full bg-warning bg-opacity-10 text-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
            <CreditCard size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Quick Links</h2>
          <div className="flex flex-col gap-2">
            <Link to="/admin/bookings" className="btn btn-secondary w-full justify-start">Manage Bookings</Link>
            <Link to="/admin/rooms" className="btn btn-secondary w-full justify-start">Manage Rooms</Link>
            <Link to="/admin/payments" className="btn btn-secondary w-full justify-start">Manage Payments</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
