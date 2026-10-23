import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { Eye, XCircle, CreditCard, FileText, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { GuestHouseApplicationPDF } from '../../components/pdf/GuestHouseApplicationPDF';
import { API_BASE_URL } from '../../config/api';

export default function BookingHistory() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dbTimestamp, setDbTimestamp] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Lock body scroll when modal is open so position never shifts
  useEffect(() => {
    if (selectedBooking) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedBooking]);

  useEffect(() => {
    fetchBookings();

    window.addEventListener('indicatorsChanged', fetchBookings);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchBookings);
    };
  }, [user?.id, user?.role, user?.name]);

  const fetchBookings = async () => {
    try {
      const [data, time] = await Promise.all([
        bookingService.getStudentBookings(user),
        bookingService.getDatabaseTime()
      ]);
      setBookings(data);
      if (time) setDbTimestamp(time);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetails = async (booking) => {
    setSelectedBooking(booking);
    try {
      const time = await bookingService.getDatabaseTime();
      if (time) setDbTimestamp(time);
    } catch (e) {
      // ignore
    }
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Only cancelled bookings or expired/past date bookings can be deleted by guest and teacher users
  const canDeleteBooking = (booking) => {
    if (!booking) return false;

    // 1. Cancelled or Rejected bookings
    const isCancelledOrRejected = 
      booking.bookingStatus === 'CANCELLED' ||
      booking.approvalStatus === 'CANCELLED' ||
      booking.approvalStatus === 'REJECTED' ||
      booking.approvalStatus === 'REJECTED_BY_TEACHER';

    if (isCancelledOrRejected) return true;

    // 2. Completed bookings
    if (booking.bookingStatus === 'COMPLETED') return true;

    // 3. Expired date bookings (check-out date is in the past)
    if (booking.checkOutDate || booking.checkInDate) {
      const dateStr = booking.checkOutDate || booking.checkInDate;
      const checkoutDate = new Date(dateStr);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (checkoutDate < todayStart) {
        return true;
      }
    }

    // Applied, pending, or active upcoming bookings cannot be deleted
    return false;
  };

  const handleDeleteBooking = async (id) => {
    const target = bookings.find(b => b.id === id);
    if (target && !canDeleteBooking(target)) {
      alert("Applied or pending bookings cannot be deleted. Only cancelled or expired bookings can be removed.");
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete booking ${id}? This will remove it from the Supabase database.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await bookingService.deleteBooking(id);
      setBookings(prev => prev.filter(b => b.id !== id));
      setSelectedBooking(null);
      showFeedback('success', `Booking ${id} deleted successfully from database.`);
    } catch (err) {
      console.error("Delete booking failed:", err);
      showFeedback('error', err.message || 'Failed to delete booking from database.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = async (id) => {
    const booking = bookings.find(b => b.id === id);
    const isPaid = booking && (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'COMPLETED');

    let confirmMsg = "Are you sure you want to cancel this booking?";
    if (isPaid) {
      confirmMsg = `Are you sure you want to cancel this booking? A refund of ৳${booking.totalAmount} will be processed via SSLCommerz.`;
    }

    if (window.confirm(confirmMsg)) {
      try {
        if (isPaid) {
          let invoiceNumber = null;
          try {
            const txs = await fetch(`${API_BASE_URL}/api/payment/transactions`).then(r => r.json());
            invoiceNumber = txs[id]?.invoiceNumber || txs[id]?.bankTranId;
          } catch (e) {}

          if (!invoiceNumber) {
            const entered = window.prompt(
              "Please enter the SSLCommerz Invoice Number (from your payment OTP page or SSLCommerz sandbox dashboard):",
              ""
            );
            if (entered && entered.trim()) {
              invoiceNumber = entered.trim();
            }
          }

          const res = await bookingService.cancelBookingWithRefund(id, booking.totalAmount, "User cancellation", invoiceNumber);
          alert(res?.message || `Booking cancelled and refund of ৳${booking.totalAmount} initiated via SSLCommerz.`);
          setBookings(bookings.map(b => b.id === id ? { ...b, bookingStatus: 'CANCELLED', paymentStatus: 'REFUNDED' } : b));
        } else {
          await bookingService.updateBookingStatus(id, { bookingStatus: 'CANCELLED' });
          setBookings(bookings.map(b => b.id === id ? { ...b, bookingStatus: 'CANCELLED' } : b));
          alert("Booking cancelled successfully.");
        }
      } catch (err) {
        console.error("Cancel failed:", err);
        alert("Failed to cancel booking. Please try again.");
      }
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'CONFIRMED': return <span className="badge badge-success">Confirmed</span>;
      case 'PENDING': return <span className="badge badge-warning">Pending</span>;
      case 'CANCELLED': return <span className="badge badge-danger">Cancelled</span>;
      case 'COMPLETED': return <span className="badge badge-info">Completed</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">
        {user?.role === 'teacher' ? 'My Applications' : 'Booking History'}
      </h1>

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

      {isLoading ? (
        <div className="text-center py-8">Loading history...</div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="font-bold text-lg">
            {user?.role === 'teacher' ? 'No applications found' : 'No booking history'}
          </h3>
          <p className="text-muted mt-2">
            {user?.role === 'teacher' ? 'You have no applications or bookings recorded yet.' : "You haven't made any bookings yet."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="w-full text-left" style={{ minWidth: '800px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th className="p-3 text-left">Booking ID</th>
                <th className="p-3 text-left">Dates</th>
                <th className="p-3 text-left">Room Type</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Approval</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(booking => (
                <tr key={booking.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="p-3 text-left font-medium text-primary">
                    {booking.id}
                    {booking.applicantName && (
                      <span className="text-muted text-xs block font-normal">{booking.applicantName}</span>
                    )}
                  </td>
                  <td className="p-3 text-left text-sm">
                    {booking.checkInDate} <br />
                    <span className="text-muted text-xs">to {booking.checkOutDate}</span>
                  </td>
                  <td className="p-3 text-left text-sm">
                    {booking.requestedRoomType.replace(/_/g, '-')}
                    {booking.assignedRoom && <span className="font-bold ml-1"> Room {booking.assignedRoom}</span>}
                  </td>
                  <td className="p-3 text-left">৳{booking.totalAmount}</td>
                  <td className="p-3 text-left">
                    <span className={`badge ${booking.approvalStatus === 'APPROVED' ? 'badge-success' : booking.approvalStatus === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {booking.approvalStatus}
                    </span>
                  </td>
                  <td className="p-3 text-left">{getStatusBadge(booking.bookingStatus)}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleOpenDetails(booking)}
                        title="View details or delete"
                      >
                        <Eye size={14} /> Details
                      </button>
                      {booking.paymentStatus === 'COMPLETED' && (
                        <PDFDownloadLink
                          key={`row_${booking.id}_${dbTimestamp ? dbTimestamp.getTime() : 'init'}`}
                          document={<GuestHouseApplicationPDF booking={booking} issueDateTime={dbTimestamp} />}
                          fileName={`booking_${booking.id}.pdf`}
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                          title="Download Application PDF"
                        >
                          {({ loading }) => (
                            <><FileText size={14} /> {loading ? '...' : 'PDF'}</>
                          )}
                        </PDFDownloadLink>
                      )}
                      {(booking.bookingStatus === 'PENDING' || booking.bookingStatus === 'CONFIRMED') && (
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleCancel(booking.id)}
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal rendered via Portal */}
      {selectedBooking && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBooking(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            margin: 0
          }}
        >
          <div 
            className="card animate-fade-in" 
            style={{ 
              width: '100%', 
              maxWidth: '620px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold">Booking Details</h2>
              <button 
                onClick={() => setSelectedBooking(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div><strong className="text-muted block">Booking ID</strong> <span className="font-semibold text-primary">{selectedBooking.id}</span></div>
                <div><strong className="text-muted block">Status</strong> {getStatusBadge(selectedBooking.bookingStatus)}</div>
                <div><strong className="text-muted block">Applicant Name</strong> {selectedBooking.applicantName}</div>
                <div><strong className="text-muted block">Mobile Number</strong> {selectedBooking.mobileNumber}</div>
                <div><strong className="text-muted block">Check-in</strong> {selectedBooking.checkInDate} {selectedBooking.checkInTime}</div>
                <div><strong className="text-muted block">Check-out</strong> {selectedBooking.checkOutDate} {selectedBooking.checkOutTime}</div>
                <div><strong className="text-muted block">Room Type</strong> {selectedBooking.requestedRoomType.replace(/_/g, ' ')}</div>
                <div><strong className="text-muted block">Total Days</strong> {selectedBooking.totalDays}</div>
                <div><strong className="text-muted block">Total Amount</strong> ৳{selectedBooking.totalAmount}</div>
                <div><strong className="text-muted block">Assigned Room</strong> {selectedBooking.assignedRoom ? `Room ${selectedBooking.assignedRoom}` : 'Pending Allocation'}</div>
              </div>

              <div>
                <strong className="text-muted block mb-2 border-bottom pb-1" style={{ borderBottom: '1px solid var(--color-border)' }}>Guest Information</strong>
                {selectedBooking.guests && selectedBooking.guests.length > 0 ? (
                  selectedBooking.guests.map((g, i) => (
                    <div key={i} className="text-sm mb-2 p-2 rounded" style={{ backgroundColor: 'var(--color-background)' }}>
                      <strong>{g.name}</strong> ({g.relationship}) - Mobile: {g.mobile}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted">No additional guests listed.</p>
                )}
              </div>
            </div>

            {/* Modal Footer with Delete Option and Actions */}
            <div className={`mt-6 flex flex-col sm:flex-row ${canDeleteBooking(selectedBooking) ? 'justify-between' : 'justify-end'} items-center gap-3 pt-4`} style={{ borderTop: '1px solid var(--color-border)' }}>
              {canDeleteBooking(selectedBooking) && (
                <div>
                  <button 
                    type="button"
                    className="btn btn-danger flex items-center gap-1.5 text-sm py-2 px-3.5"
                    onClick={() => handleDeleteBooking(selectedBooking.id)}
                    disabled={isDeleting}
                    title="Permanently remove this booking from database"
                  >
                    <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Booking'}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {selectedBooking.approvalStatus === 'PENDING_PAYMENT' && selectedBooking.paymentStatus === 'PENDING' && selectedBooking.bookingStatus !== 'CANCELLED' && (
                  <Link 
                    to={user?.role === 'teacher' ? `/teacher/payment` : `/student/payment`}
                    className="btn btn-success"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CreditCard size={16} /> Pay Now
                  </Link>
                )}
                
                {selectedBooking.bookingStatus !== 'CANCELLED' && selectedBooking.approvalStatus !== 'REJECTED' && (
                  <PDFDownloadLink 
                    key={`modal_${selectedBooking.id}_${dbTimestamp ? dbTimestamp.getTime() : 'init'}`}
                    document={<GuestHouseApplicationPDF booking={selectedBooking} issueDateTime={dbTimestamp} />} 
                    fileName={`booking_${selectedBooking.id}.pdf`}
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {({ loading }) => 
                      loading ? 'Generating PDF...' : <><FileText size={16} /> Download Application PDF</>
                    }
                  </PDFDownloadLink>
                )}

                <button 
                  type="button"
                  className="btn btn-secondary text-sm py-2 px-4" 
                  onClick={() => setSelectedBooking(null)}
                  disabled={isDeleting}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
