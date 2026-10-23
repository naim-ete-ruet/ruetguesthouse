import { useState, useEffect } from 'react';
import { bookingService } from '../../services/bookingService';
import { roomService } from '../../services/roomService';
import { Eye, Check, X, Search, Filter, XCircle, DoorOpen, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

const parseDateTime = (dateStr, timeStr, defaultTime = '12:00') => {
  if (!dateStr) return null;
  const cleanDate = dateStr.trim().split('T')[0];
  let hours = 12;
  let minutes = 0;
  
  if (timeStr && typeof timeStr === 'string') {
    const rawTime = timeStr.trim().toLowerCase();
    const isPM = rawTime.includes('pm');
    const isAM = rawTime.includes('am');
    const cleanTime = rawTime.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');
    if (parts.length >= 1) {
      hours = parseInt(parts[0], 10) || 0;
      if (parts.length >= 2) {
        minutes = parseInt(parts[1], 10) || 0;
      }
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }
  } else if (defaultTime) {
    const parts = defaultTime.split(':');
    hours = parseInt(parts[0], 10) || 12;
    minutes = parseInt(parts[1], 10) || 0;
  }
  
  const d = new Date(cleanDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const isBookingExpired = (booking) => {
  if (!booking) return false;
  if (
    booking.bookingStatus === 'COMPLETED' ||
    booking.bookingStatus === 'CANCELLED' ||
    booking.approvalStatus === 'CANCELLED' ||
    booking.approvalStatus === 'REJECTED' ||
    booking.approvalStatus === 'REJECTED_BY_TEACHER'
  ) {
    return true;
  }

  const dateStr = booking.checkOutDate || booking.checkInDate;
  if (dateStr) {
    const timeStr = booking.checkOutTime || '12:00';
    const checkoutDateTime = parseDateTime(dateStr, timeStr);
    if (checkoutDateTime && new Date() >= checkoutDateTime) {
      return true;
    }
  }
  return false;
};

export default function ManageBookings() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, PENDING, APPROVED, CANCELLED
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBookings();
    window.addEventListener('indicatorsChanged', fetchBookings);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchBookings);
    };
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const data = await bookingService.getAllBookings();
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    if (window.confirm(`Are you sure you want to ${action.toLowerCase()} this booking?`)) {
      try {
        const bookingTarget = bookings.find(b => b.id === id);
        const isPaid = bookingTarget && (bookingTarget.paymentStatus === 'PAID' || bookingTarget.paymentStatus === 'COMPLETED');

        if (action === 'REJECT') {
          if (isPaid) {
            let invoiceNumber = null;
            try {
              const txs = await fetch(`${API_BASE_URL}/api/payment/transactions`).then(r => r.json());
              invoiceNumber = txs[id]?.invoiceNumber || txs[id]?.bankTranId;
            } catch (e) {}

            if (!invoiceNumber) {
              const entered = window.prompt(
                "Enter SSLCommerz Invoice Number for refund (or leave blank if automatic):",
                ""
              );
              if (entered && entered.trim()) invoiceNumber = entered.trim();
            }

            const res = await bookingService.cancelBookingWithRefund(id, bookingTarget.totalAmount, "Rejected by Admin", invoiceNumber);
            alert(res?.message || "Booking rejected and refund processed with SSLCommerz.");
          } else {
            await bookingService.updateBookingStatus(id, { approvalStatus: 'REJECTED', bookingStatus: 'CANCELLED' });
            alert("Booking rejected.");
          }

          if (bookingTarget?.assignedRoom) {
            await roomService.updateRoomStatus(bookingTarget.assignedRoom, 'available');
          }

          const update = { 
            approvalStatus: 'REJECTED', 
            bookingStatus: 'CANCELLED', 
            paymentStatus: isPaid ? 'REFUNDED' : bookingTarget?.paymentStatus 
          };
          setBookings(bookings.map(b => b.id === id ? { ...b, ...update } : b));
          if (selectedBooking && selectedBooking.id === id) {
            setSelectedBooking({ ...selectedBooking, ...update });
          }
        } else {
          const update = { approvalStatus: 'APPROVED' };
          await bookingService.updateBookingStatus(id, update);
          
          if (bookingTarget?.assignedRoom) {
            await roomService.syncRoomAvailability();
          }

          setBookings(bookings.map(b => b.id === id ? { ...b, ...update } : b));
          if (selectedBooking && selectedBooking.id === id) {
            setSelectedBooking({ ...selectedBooking, ...update });
          }
        }
      } catch (err) {
        console.error("Action failed", err);
      }
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!window.confirm(`Are you sure you want to permanently delete booking ${id} from the database? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await bookingService.deleteBooking(id);
      setBookings(prev => prev.filter(b => b.id !== id));
      setSelectedBooking(null);
      alert(`Booking ${id} was successfully deleted from the database.`);
      await roomService.syncRoomAvailability();
    } catch (err) {
      console.error("Failed to delete booking:", err);
      alert(err.message || "Failed to delete booking from database.");
    } finally {
      setIsDeleting(false);
    }
  };


  const filteredBookings = bookings.filter(b => {
    if (filter === 'ALL') return true;
    if (filter === 'REJECTED') {
      return b.approvalStatus === 'REJECTED' || b.approvalStatus === 'CANCELLED' || b.bookingStatus === 'CANCELLED';
    }
    if (filter === 'PENDING_APPROVAL') {
      return b.approvalStatus === 'PENDING_APPROVAL' && b.bookingStatus !== 'CANCELLED' && b.paymentStatus !== 'REFUNDED';
    }
    return b.approvalStatus === filter;
  });

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">Manage Bookings</h1>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input type="text" placeholder="Search by ID or Name..." className="form-input w-full" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="text-muted flex-shrink-0" size={20} />
          <select className="form-select w-full sm:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Bookings</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected / Cancelled</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">Booking ID</th>
              <th className="p-3">Applicant</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Room No.</th>
              <th className="p-3">Approval</th>
              <th className="p-3">Payment</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="text-center p-4">Loading...</td></tr>
            ) : filteredBookings.map(booking => {
              const isRefundedOrCancelled = booking.bookingStatus === 'CANCELLED' || 
                                           booking.paymentStatus === 'REFUNDED' || 
                                           booking.approvalStatus === 'CANCELLED';
              return (
                <tr key={booking.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="p-3 font-medium text-primary">{booking.id}</td>
                  <td className="p-3 text-sm">
                    <div className="font-medium">{booking.applicantName}</div>
                    <div className="mt-1">
                      {booking.isTeacherBooking || (booking.designation && booking.designation.toLowerCase().includes('teacher')) ? (
                        <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#A855F7' }}>Teacher</span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'transparent', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>Student</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm whitespace-nowrap">
                    {booking.checkInDate ? (
                      booking.checkOutDate ? (
                        `${booking.checkInDate.replace(/-/g, '/')} - ${booking.checkOutDate.replace(/-/g, '/')}`
                      ) : booking.checkInDate.replace(/-/g, '/')
                    ) : 'N/A'}
                  </td>
                  <td className="p-3 text-sm font-medium">
                    {booking.assignedRoom ? (
                      <span className="text-primary">{booking.assignedRoom}</span>
                    ) : (
                      <span className="text-muted">Not assigned</span>
                    )}
                  </td>
                  <td className="p-3">
                    {isRefundedOrCancelled ? (
                      <span className="badge badge-danger">CANCELLED</span>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`badge ${booking.approvalStatus === 'APPROVED' ? 'badge-success' : booking.approvalStatus === 'PENDING_APPROVAL' ? 'badge-warning' : 'badge-danger'}`}>
                          {booking.approvalStatus.replace(/_/g, ' ')}
                        </span>
                        {isBookingExpired(booking) && (
                          <span className="badge" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#6B7280' }}>
                            EXPIRED
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`badge ${booking.paymentStatus === 'PAID' || booking.paymentStatus === 'COMPLETED' ? 'badge-success' : booking.paymentStatus === 'REFUNDED' ? 'badge-danger' : 'badge-warning'}`}>
                      {booking.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center flex-wrap gap-2">
                      <button 
                        onClick={() => setSelectedBooking(booking)}
                        className="btn btn-success" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        <Eye size={14} /> Details
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {selectedBooking && (() => {
        const isModalRefundedOrCancelled = selectedBooking.bookingStatus === 'CANCELLED' || 
                                           selectedBooking.paymentStatus === 'REFUNDED' || 
                                           selectedBooking.approvalStatus === 'CANCELLED';
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <h2 className="text-xl font-bold">Booking Details: {selectedBooking.id}</h2>
                <button 
                  onClick={() => setSelectedBooking(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
                >
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Applicant Name</strong> {selectedBooking.applicantName}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Mobile Number</strong> {selectedBooking.mobileNumber}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Designation</strong> {selectedBooking.designation}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Department</strong> {selectedBooking.department}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Stay Purpose</strong> {selectedBooking.stayPurpose}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Check-in</strong> {selectedBooking.checkInDate} at {selectedBooking.checkInTime}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Check-out</strong> {selectedBooking.checkOutDate} at {selectedBooking.checkOutTime}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Room Type</strong> {selectedBooking.requestedRoomType.replace(/_/g, ' ')}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Assigned Room</strong> {selectedBooking.assignedRoom ? <span className="font-bold text-primary">{selectedBooking.assignedRoom}</span> : 'Pending Allocation'}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Total Days</strong> {selectedBooking.totalDays}</div>
                  <div><strong className="text-muted block text-xs uppercase mb-1">Total Amount</strong> ৳{selectedBooking.totalAmount}</div>
                </div>

                <div>
                  <strong className="text-muted block text-xs uppercase mb-2">Guest Information</strong>
                  {selectedBooking.guests && selectedBooking.guests.map((g, i) => (
                    <div key={i} className="text-sm mb-2 p-3 rounded border" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="font-bold mb-1">{g.name} <span className="text-muted font-normal">({g.relationship})</span></div>
                      <div className="flex gap-4">
                        <span>NID: {g.nid || 'N/A'}</span>
                        <span>Mobile: {g.mobile || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  {isModalRefundedOrCancelled && (
                    <span className="badge badge-danger text-xs font-semibold">
                      Booking Cancelled & Refunded (No approval action permitted)
                    </span>
                  )}
                  {isBookingExpired(selectedBooking) && (
                    <span className="badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#6B7280', fontSize: '0.75rem' }}>
                      Stay Expired
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {selectedBooking.approvalStatus === 'PENDING_APPROVAL' && !isModalRefundedOrCancelled && (
                    <>
                      <button onClick={() => { handleAction(selectedBooking.id, 'APPROVE'); setSelectedBooking(null); }} className="btn btn-success" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>Approve</button>
                      <button onClick={() => { handleAction(selectedBooking.id, 'REJECT'); setSelectedBooking(null); }} className="btn btn-danger">Reject</button>
                    </>
                  )}

                  {isBookingExpired(selectedBooking) && (
                    <button
                      onClick={() => handleDeleteBooking(selectedBooking.id)}
                      disabled={isDeleting}
                      className="btn btn-danger flex items-center gap-1.5"
                      style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                      title="Permanently delete this expired booking from the database"
                    >
                      <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Booking'}
                    </button>
                  )}

                  <button className="btn btn-secondary" onClick={() => setSelectedBooking(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}
