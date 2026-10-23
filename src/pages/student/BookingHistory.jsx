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
  const [isCancelling, setIsCancelling] = useState(false);
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
      setIsCancelling(true);
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
          if (selectedBooking && selectedBooking.id === id) {
            setSelectedBooking(prev => ({ ...prev, bookingStatus: 'CANCELLED', paymentStatus: 'REFUNDED' }));
          }
        } else {
          await bookingService.updateBookingStatus(id, { bookingStatus: 'CANCELLED' });
          setBookings(bookings.map(b => b.id === id ? { ...b, bookingStatus: 'CANCELLED' } : b));
          if (selectedBooking && selectedBooking.id === id) {
            setSelectedBooking(prev => ({ ...prev, bookingStatus: 'CANCELLED' }));
          }
          alert("Booking cancelled successfully.");
        }
      } catch (err) {
        console.error("Cancel failed:", err);
        alert("Failed to cancel booking. Please try again.");
      } finally {
        setIsCancelling(false);
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
                    <div className="flex justify-center">
                      <button 
                        className="btn btn-secondary hover-scale" 
                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleOpenDetails(booking)}
                        title="View booking details and actions"
                      >
                        <Eye size={14} /> Details
                      </button>
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
                <div>
                  <strong className="text-muted block">Approval Status</strong> 
                  <span className={`badge ${selectedBooking.approvalStatus === 'APPROVED' ? 'badge-success' : selectedBooking.approvalStatus?.includes('REJECTED') ? 'badge-danger' : 'badge-warning'}`}>
                    {selectedBooking.approvalStatus || 'PENDING'}
                  </span>
                </div>
                <div>
                  <strong className="text-muted block">Payment Status</strong> 
                  <span className={`badge ${selectedBooking.paymentStatus === 'PAID' || selectedBooking.paymentStatus === 'COMPLETED' ? 'badge-success' : selectedBooking.paymentStatus === 'REFUNDED' ? 'badge-info' : 'badge-warning'}`}>
                    {selectedBooking.paymentStatus || 'PENDING'}
                  </span>
                </div>
                <div><strong className="text-muted block">Applicant Name</strong> {selectedBooking.applicantName}</div>
                <div><strong className="text-muted block">Mobile Number</strong> {selectedBooking.mobileNumber}</div>
                <div><strong className="text-muted block">Check-in</strong> {selectedBooking.checkInDate} {selectedBooking.checkInTime}</div>
                <div><strong className="text-muted block">Check-out</strong> {selectedBooking.checkOutDate} {selectedBooking.checkOutTime}</div>
                <div><strong className="text-muted block">Room Type</strong> {selectedBooking.requestedRoomType.replace(/_/g, ' ')}</div>
                <div><strong className="text-muted block">Total Days</strong> {selectedBooking.totalDays}</div>
                <div><strong className="text-muted block">Total Amount</strong> ৳{selectedBooking.totalAmount}</div>
                <div><strong className="text-muted block">Assigned Room</strong> {selectedBooking.assignedRoom ? `Room ${selectedBooking.assignedRoom}` : 'Pending Allocation'}</div>
                {selectedBooking.rejectionReason && (
                  <div className="col-span-1 sm:col-span-2 p-2.5 rounded text-sm mt-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)' }}>
                    <strong className="text-danger block font-medium">Rejection Reason:</strong>
                    <span>{selectedBooking.rejectionReason}</span>
                  </div>
                )}
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

            {/* Modal Footer with Cancel, Delete, Payment, PDF, and Close Actions */}
            {(() => {
              const canCancel = (selectedBooking.bookingStatus === 'PENDING' || selectedBooking.bookingStatus === 'CONFIRMED') && 
                                selectedBooking.bookingStatus !== 'CANCELLED' && 
                                !selectedBooking.approvalStatus?.includes('REJECTED');
              const canDelete = canDeleteBooking(selectedBooking);

              return (
                <div 
                  className={`mt-6 flex flex-col sm:flex-row ${(canCancel || canDelete) ? 'justify-between' : 'justify-end'} items-stretch sm:items-center gap-3 pt-4`} 
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  {/* Destructive options (Cancel / Delete) */}
                  {(canCancel || canDelete) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {canCancel && (
                        <button 
                          type="button"
                          className="btn btn-danger flex items-center justify-center gap-1.5 text-sm py-2 px-3.5"
                          onClick={() => handleCancel(selectedBooking.id)}
                          disabled={isCancelling || isDeleting}
                          title="Cancel this booking"
                        >
                          <XCircle size={16} /> {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      )}

                      {canDelete && (
                        <button 
                          type="button"
                          className="btn btn-danger flex items-center justify-center gap-1.5 text-sm py-2 px-3.5"
                          onClick={() => handleDeleteBooking(selectedBooking.id)}
                          disabled={isDeleting || isCancelling}
                          title="Permanently remove this booking from database"
                        >
                          <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Record'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Primary & Navigation actions (Pay Now / Download PDF / Close) */}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedBooking.approvalStatus === 'PENDING_PAYMENT' && selectedBooking.paymentStatus === 'PENDING' && selectedBooking.bookingStatus !== 'CANCELLED' && (
                      <Link 
                        to={user?.role === 'teacher' ? `/teacher/payment` : `/student/payment`}
                        className="btn btn-success flex items-center justify-center gap-1.5 text-sm py-2 px-3.5"
                        style={{ textDecoration: 'none' }}
                      >
                        <CreditCard size={16} /> Pay Now
                      </Link>
                    )}
                    
                    {selectedBooking.bookingStatus !== 'CANCELLED' && !selectedBooking.approvalStatus?.includes('REJECTED') && (
                      <PDFDownloadLink 
                        key={`modal_${selectedBooking.id}_${dbTimestamp ? dbTimestamp.getTime() : 'init'}`}
                        document={<GuestHouseApplicationPDF booking={selectedBooking} issueDateTime={dbTimestamp} />} 
                        fileName={`booking_${selectedBooking.id}.pdf`}
                        className="btn btn-primary flex items-center justify-center gap-1.5 text-sm py-2 px-3.5"
                        style={{ textDecoration: 'none' }}
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
                      disabled={isDeleting || isCancelling}
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
