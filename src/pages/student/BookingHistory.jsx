import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService, sortBookingsNewestFirst } from '../../services/bookingService';
import { Eye, SlidersHorizontal, XCircle, CreditCard, FileText, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
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
      setBookings(sortBookingsNewestFirst(data));
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

  const isBookingExpired = (b) => {
    if (!b) return false;
    const dateStr = b.checkOutDate || b.checkInDate;
    if (!dateStr) return false;
    const checkoutDate = new Date(dateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return checkoutDate < todayStart;
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
                <th className="p-3 text-left">Room No.</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Approval</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortBookingsNewestFirst(bookings).map(booking => (
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
                  <td className="p-3 text-left text-sm font-semibold">
                    {booking.assignedRoom ? (
                      <span className="text-primary">
                        {booking.assignedRoom.toLowerCase().startsWith('room') 
                          ? booking.assignedRoom 
                          : `Room ${booking.assignedRoom}`}
                      </span>
                    ) : (
                      <span className="text-muted font-normal text-xs">Not assigned</span>
                    )}
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
                        className="btn btn-option hover-scale" 
                        onClick={() => handleOpenDetails(booking)}
                        title="View booking options and details"
                      >
                        <SlidersHorizontal size={14} /> Option
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
              maxWidth: '720px', 
              maxHeight: '92vh', 
              overflowY: 'auto',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '1.25rem'
            }}
          >
            {/* Header matching Image 1 */}
            <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold">Booking Details: <span className="text-primary">{selectedBooking.id}</span></h2>
                <span className={`badge ${selectedBooking.approvalStatus === 'APPROVED' ? 'badge-success' : selectedBooking.approvalStatus?.includes('REJECTED') ? 'badge-danger' : 'badge-warning'}`}>
                  {(selectedBooking.approvalStatus || 'PENDING').replace(/_/g, ' ')}
                </span>
                <span className={`badge ${selectedBooking.paymentStatus === 'PAID' || selectedBooking.paymentStatus === 'COMPLETED' ? 'badge-success' : selectedBooking.paymentStatus === 'REFUNDED' ? 'badge-danger' : 'badge-warning'}`}>
                  {selectedBooking.paymentStatus || 'PENDING'}
                </span>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded-full hover:bg-gray-100 transition"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2 Balanced Side-by-Side Cards (Stack on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs sm:text-sm">
              {/* Card 1: Applicant Details */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Applicant Details</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div><span className="text-muted block text-xs">Name:</span> <strong className="text-text">{selectedBooking.applicantName}</strong></div>
                  <div><span className="text-muted block text-xs">Mobile:</span> <strong className="text-text">{selectedBooking.mobileNumber}</strong></div>
                  <div><span className="text-muted block text-xs">Designation:</span> <span className="text-text">{selectedBooking.designation || 'Student / Guest'}</span></div>
                  <div><span className="text-muted block text-xs">Department:</span> <span className="text-text">{selectedBooking.department || 'N/A'}</span></div>
                  <div className="col-span-2"><span className="text-muted block text-xs">Stay Purpose:</span> <span className="text-text">{selectedBooking.stayPurpose || 'Official / Guest'}</span></div>
                </div>
              </div>

              {/* Card 2: Stay & Room Details */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Stay & Room Details</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div>
                    <span className="text-muted block text-xs">Check-in:</span>
                    <strong className="text-text">{selectedBooking.checkInDate}</strong> <span className="text-xs text-muted">({selectedBooking.checkInTime})</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Check-out:</span>
                    <strong className="text-text">{selectedBooking.checkOutDate}</strong> <span className="text-xs text-muted">({selectedBooking.checkOutTime})</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Room No:</span>
                    <strong className="text-primary font-bold">
                      {selectedBooking.assignedRoom 
                        ? (selectedBooking.assignedRoom.toLowerCase().startsWith('room') ? selectedBooking.assignedRoom : `Room ${selectedBooking.assignedRoom}`)
                        : 'Pending Allocation'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Room Type:</span>
                    <span className="text-text">{(selectedBooking.requestedRoomType || 'Standard Room').replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Duration:</span>
                    <span className="text-text">{selectedBooking.totalDays} Night(s)</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Total Amount:</span>
                    <strong className="text-success font-bold text-sm sm:text-base">৳{selectedBooking.totalAmount}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Rejection Reason (if any) */}
            {selectedBooking.rejectionReason && (
              <div className="p-2.5 rounded border border-danger mb-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                <strong className="text-danger block text-xs font-semibold mb-1">Rejection Reason:</strong>
                <p className="text-xs sm:text-sm">{selectedBooking.rejectionReason}</p>
              </div>
            )}

            {/* Guest Information */}
            <div className="p-2.5 rounded-lg text-xs sm:text-sm border mb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-xs uppercase font-bold text-muted mb-1.5 tracking-wider">Guest Information</div>
              {selectedBooking.guests && selectedBooking.guests.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {selectedBooking.guests.map((g, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-1 py-1 px-2 rounded" style={{ backgroundColor: 'var(--color-background)' }}>
                      <div>
                        <strong>{g.name}</strong> <span className="text-muted text-xs">({g.relationship || 'Guest'})</span>
                      </div>
                      <div className="text-xs text-muted flex gap-3">
                        <span>NID: <strong className="text-text">{g.nid || 'N/A'}</strong></span>
                        <span>Mobile: <strong className="text-text">{g.mobile || 'N/A'}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">No additional guests listed with this booking.</p>
              )}
            </div>

            {/* Modal Footer with Cancel, Delete, Payment, PDF, and Close Actions */}
            {(() => {
              const canCancel = (selectedBooking.bookingStatus === 'PENDING' || selectedBooking.bookingStatus === 'CONFIRMED') && 
                                selectedBooking.bookingStatus !== 'CANCELLED' && 
                                !selectedBooking.approvalStatus?.includes('REJECTED');
              const canDelete = canDeleteBooking(selectedBooking);
              const isExpired = isBookingExpired(selectedBooking);
              const isCancelledOrRefunded = selectedBooking.bookingStatus === 'CANCELLED' || selectedBooking.paymentStatus === 'REFUNDED';

              return (
                <div 
                  className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2" 
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  {/* Left tags / status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isCancelledOrRefunded && (
                      <span className="badge badge-danger text-xs font-semibold">
                        Cancelled / Refunded
                      </span>
                    )}
                    {isExpired && (
                      <span className="badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#6B7280', fontSize: '0.72rem' }}>
                        Stay Expired
                      </span>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                    {canCancel && (
                      <button 
                        type="button"
                        className="btn btn-danger text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                        onClick={() => handleCancel(selectedBooking.id)}
                        disabled={isCancelling || isDeleting}
                        title="Cancel this booking"
                      >
                        <XCircle size={14} /> {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                    )}

                    {canDelete && (
                      <button 
                        type="button"
                        className="btn btn-danger text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                        onClick={() => handleDeleteBooking(selectedBooking.id)}
                        disabled={isDeleting || isCancelling}
                        title="Permanently remove this booking from database"
                      >
                        <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete Record'}
                      </button>
                    )}

                    {selectedBooking.approvalStatus === 'PENDING_PAYMENT' && selectedBooking.paymentStatus === 'PENDING' && selectedBooking.bookingStatus !== 'CANCELLED' && (
                      <Link 
                        to={user?.role === 'teacher' ? `/teacher/payment` : `/student/payment`}
                        className="btn btn-success text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                        style={{ textDecoration: 'none' }}
                      >
                        <CreditCard size={14} /> Pay Now
                      </Link>
                    )}
                    
                    {selectedBooking.bookingStatus !== 'CANCELLED' && !selectedBooking.approvalStatus?.includes('REJECTED') && (
                      <PDFDownloadLink 
                        key={`modal_${selectedBooking.id}_${dbTimestamp ? dbTimestamp.getTime() : 'init'}`}
                        document={<GuestHouseApplicationPDF booking={selectedBooking} issueDateTime={dbTimestamp} />} 
                        fileName={`booking_${selectedBooking.id}.pdf`}
                        className="btn btn-primary text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                        style={{ textDecoration: 'none' }}
                      >
                        {({ loading }) => 
                          loading ? 'Generating...' : <><FileText size={14} /> Download Application PDF</>
                        }
                      </PDFDownloadLink>
                    )}

                    <button 
                      type="button"
                      className="btn btn-secondary text-xs sm:text-sm py-1.5 px-4" 
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
