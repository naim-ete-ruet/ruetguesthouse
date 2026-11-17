import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { bookingService, sortBookingsNewestFirst } from '../../services/bookingService';
import { roomService } from '../../services/roomService';
import { Eye, SlidersHorizontal, Check, X, Search, Filter, XCircle, DoorOpen, Trash2 } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../../config/api';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBookings();
    window.addEventListener('indicatorsChanged', fetchBookings);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchBookings);
    };
  }, []);

  // Lock body scroll when modal is open so window never shifts or scrolls
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

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const data = await bookingService.getAllBookings({ portal: 'admin' });
      setBookings(sortBookingsNewestFirst(data));
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
              const txs = await apiFetch('/api/payment/transactions').then(r => r.json());
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

          // Dispatch Admin Rejection Notification email from workmail.naim@gmail.com
          try {
            apiFetch('/api/email/admin-rejection-notice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookingId: id,
                guestEmail: bookingTarget?.applicantEmail || bookingTarget?.email || bookingTarget?.users?.email,
                guestName: bookingTarget?.applicantName || 'Guest',
                rejectionReason: 'Room capacity unavailable or official university reservation',
                refundStatus: isPaid ? 'REFUNDED' : 'NOT_APPLICABLE',
                totalAmount: bookingTarget?.totalAmount
              })
            }).catch(e => console.warn('Admin rejection email dispatch notice:', e));
          } catch (e) {}

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

          // Dispatch Admin Approval Notification email from workmail.naim@gmail.com
          try {
            apiFetch('/api/email/admin-approval-notice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookingId: id,
                guestEmail: bookingTarget?.applicantEmail || bookingTarget?.email || bookingTarget?.users?.email,
                guestName: bookingTarget?.applicantName || 'Guest',
                assignedRoom: bookingTarget?.assignedRoom,
                requestedRoomType: bookingTarget?.requestedRoomType,
                checkInDate: bookingTarget?.checkInDate,
                checkOutDate: bookingTarget?.checkOutDate,
                totalAmount: bookingTarget?.totalAmount
              })
            }).catch(e => console.warn('Admin approval email dispatch notice:', e));
          } catch (e) {}

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
    if (!window.confirm(`Are you sure you want to remove booking ${id} from the Admin portal? (The guest will still retain their booking record in their portal)`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await bookingService.deleteBookingForPortal(id, 'admin', null);
      setBookings(prev => prev.filter(b => b.id !== id));
      setSelectedBooking(null);
      alert(`Booking ${id} was removed from the Admin portal.`);
      await roomService.syncRoomAvailability();
    } catch (err) {
      console.error("Failed to delete booking:", err);
      alert(err.message || "Failed to remove booking.");
    } finally {
      setIsDeleting(false);
    }
  };


  const formatPlacedDateTime = (d) => {
    if (!d) return 'N/A';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${y}/${m}/${day} ${hours}:${minutes} ${ampm}`;
  };

  const filteredBookings = sortBookingsNewestFirst(bookings.filter(b => {
    let matchesFilter = true;
    if (filter === 'REJECTED') {
      matchesFilter = b.approvalStatus === 'REJECTED' || b.approvalStatus === 'CANCELLED' || b.bookingStatus === 'CANCELLED';
    } else if (filter === 'PENDING_APPROVAL') {
      matchesFilter = b.approvalStatus === 'PENDING_APPROVAL' && b.bookingStatus !== 'CANCELLED' && b.paymentStatus !== 'REFUNDED';
    } else if (filter !== 'ALL') {
      matchesFilter = b.approvalStatus === filter;
    }

    if (!matchesFilter) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (b.id || '').toLowerCase().includes(q) ||
      (b.applicantName || '').toLowerCase().includes(q) ||
      (b.department || '').toLowerCase().includes(q) ||
      (b.mobileNumber || '').toLowerCase().includes(q) ||
      (b.assignedRoom || '').toLowerCase().includes(q) ||
      (b.checkInDate || '').toLowerCase().includes(q)
    );
  }));

  return (
    <div className="container">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manage Bookings</h1>
        <p className="text-muted text-sm">Review, approve, or reject guest bookings</p>
        <div className="notice-box-green">
          <SlidersHorizontal size={15} className="flex-shrink-0" />
          <span>To Review Application Approval / Rejection Click the Option Button</span>
        </div>
      </div>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input 
            type="text" 
            placeholder="Search by ID, Name, Room, or Date..." 
            className="form-input w-full" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
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

      <div className="card table-responsive" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">#</th>
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
              <tr><td colSpan="8" className="text-center p-4">Loading...</td></tr>
            ) : filteredBookings.map((booking, index) => {
              const isRefundedOrCancelled = booking.bookingStatus === 'CANCELLED' || 
                                           booking.paymentStatus === 'REFUNDED' || 
                                           booking.approvalStatus === 'CANCELLED';
              return (
                <tr key={booking.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="p-3 text-muted font-mono text-sm">{index + 1}</td>
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
                  <td className="p-3 text-sm font-semibold">
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
                  <td className="p-3">
                    {isRefundedOrCancelled ? (
                      <span className="badge badge-danger">CANCELLED</span>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`badge ${booking.approvalStatus === 'APPROVED' ? 'badge-success' : booking.approvalStatus === 'PENDING_APPROVAL' ? 'badge-warning' : 'badge-danger'}`}>
                          {(booking.approvalStatus || 'PENDING').replace(/_/g, ' ')}
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
                        className="btn btn-option hover-scale" 
                        title="View booking options and details"
                      >
                        <SlidersHorizontal size={14} /> Option
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Details Modal rendered via createPortal at exact middle position */}
      {selectedBooking && typeof document !== 'undefined' && createPortal(
        (() => {
          const isModalRefundedOrCancelled = selectedBooking.bookingStatus === 'CANCELLED' || 
                                             selectedBooking.paymentStatus === 'REFUNDED' || 
                                             selectedBooking.approvalStatus === 'CANCELLED';
          return (
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
                padding: '1rem',
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
                  WebkitOverflowScrolling: 'touch',
                  borderRadius: '16px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  padding: '1.25rem'
                }}
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold">Booking Details: <span className="text-primary">{selectedBooking.id}</span></h2>
                    <span className={`badge ${selectedBooking.approvalStatus === 'APPROVED' ? 'badge-success' : selectedBooking.approvalStatus === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {(selectedBooking.approvalStatus || 'PENDING').replace(/_/g, ' ')}
                    </span>
                    <span className={`badge ${selectedBooking.paymentStatus === 'PAID' || selectedBooking.paymentStatus === 'COMPLETED' ? 'badge-success' : selectedBooking.paymentStatus === 'REFUNDED' ? 'badge-danger' : 'badge-warning'}`}>
                      {selectedBooking.paymentStatus}
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
                      <div><span className="text-muted block text-xs">Designation:</span> <span className="text-text">{selectedBooking.designation || 'Guest'}</span></div>
                      <div><span className="text-muted block text-xs">Department:</span> <span className="text-text">{selectedBooking.department || 'N/A'}</span></div>
                      <div className="col-span-2"><span className="text-muted block text-xs">Stay Purpose:</span> <span className="text-text">{selectedBooking.stayPurpose || 'Official / Guest'}</span></div>
                    </div>
                  </div>

                  {/* Card 2: Stay & Room Allocation */}
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                    <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Stay & Room Details</div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                      <div className="col-span-2">
                        <span className="text-muted block text-xs">Booking Placed At:</span>
                        <strong className="text-text">{formatPlacedDateTime(selectedBooking.createdAt)}</strong>
                      </div>
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

                {/* Footer Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isModalRefundedOrCancelled && (
                      <span className="badge badge-danger text-xs font-semibold">
                        Cancelled / Refunded
                      </span>
                    )}
                    {isBookingExpired(selectedBooking) && (
                      <span className="badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#6B7280', fontSize: '0.72rem' }}>
                        Stay Expired
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                    {selectedBooking.approvalStatus === 'PENDING_APPROVAL' && !isModalRefundedOrCancelled && (
                      <>
                        <button 
                          onClick={() => { handleAction(selectedBooking.id, 'APPROVE'); setSelectedBooking(null); }} 
                          className="btn btn-success text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1" 
                          style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button 
                          onClick={() => { handleAction(selectedBooking.id, 'REJECT'); setSelectedBooking(null); }} 
                          className="btn btn-danger text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                        >
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}

                    {isBookingExpired(selectedBooking) && (
                      <button
                        onClick={() => handleDeleteBooking(selectedBooking.id)}
                        disabled={isDeleting}
                        className="btn btn-danger text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                        title="Permanently delete this expired booking"
                      >
                        <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    )}

                    <button 
                      className="btn btn-secondary text-xs sm:text-sm py-1.5 px-4" 
                      onClick={() => setSelectedBooking(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}


    </div>
  );
}
