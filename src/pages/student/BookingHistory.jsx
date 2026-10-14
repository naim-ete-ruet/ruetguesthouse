import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { Eye, XCircle, CreditCard, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { GuestHouseApplicationPDF } from '../../components/pdf/GuestHouseApplicationPDF';
import { API_BASE_URL } from '../../config/api';

export default function BookingHistory() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await bookingService.getStudentBookings(user.id);
        setBookings(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();

    window.addEventListener('indicatorsChanged', fetchBookings);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchBookings);
    };
  }, [user.id]);

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
      <h1 className="text-2xl font-bold mb-6">Booking History</h1>

      {isLoading ? (
        <div className="text-center py-8">Loading history...</div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="font-bold text-lg">No booking history</h3>
          <p className="text-muted mt-2">You haven't made any bookings yet.</p>
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
                  <td className="p-3 text-left font-medium text-primary">{booking.id}</td>
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
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <Eye size={14} /> Details
                      </button>
                      {(booking.bookingStatus === 'PENDING' || booking.bookingStatus === 'CONFIRMED') && (
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
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

      {/* Details Modal */}
      {selectedBooking && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold">Booking Details</h2>
              <button 
                onClick={() => setSelectedBooking(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong className="text-muted block">Booking ID</strong> {selectedBooking.id}</div>
                <div><strong className="text-muted block">Status</strong> {getStatusBadge(selectedBooking.bookingStatus)}</div>
                <div><strong className="text-muted block">Applicant Name</strong> {selectedBooking.applicantName}</div>
                <div><strong className="text-muted block">Mobile Number</strong> {selectedBooking.mobileNumber}</div>
                <div><strong className="text-muted block">Check-in</strong> {selectedBooking.checkInDate} {selectedBooking.checkInTime}</div>
                <div><strong className="text-muted block">Check-out</strong> {selectedBooking.checkOutDate} {selectedBooking.checkOutTime}</div>
                <div><strong className="text-muted block">Room Type</strong> {selectedBooking.requestedRoomType.replace(/_/g, ' ')}</div>
                <div><strong className="text-muted block">Total Days</strong> {selectedBooking.totalDays}</div>
                <div><strong className="text-muted block">Total Amount</strong> ৳{selectedBooking.totalAmount}</div>
                <div><strong className="text-muted block">Assigned Room</strong> {selectedBooking.assignedRoom || 'Pending Allocation'}</div>
              </div>

              <div>
                <strong className="text-muted block mb-2 border-bottom pb-1" style={{ borderBottom: '1px solid var(--color-border)' }}>Guest Information</strong>
                {selectedBooking.guests && selectedBooking.guests.map((g, i) => (
                  <div key={i} className="text-sm mb-2 p-2 rounded" style={{ backgroundColor: 'var(--color-background)' }}>
                    <strong>{g.name}</strong> ({g.relationship}) - Mobile: {g.mobile}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              {selectedBooking.approvalStatus === 'PENDING_PAYMENT' && selectedBooking.paymentStatus === 'PENDING' && selectedBooking.bookingStatus !== 'CANCELLED' && (
                <Link 
                  to={user?.role === 'teacher' ? `/teacher/payment` : `/student/payment`}
                  className="btn btn-success"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CreditCard size={16} /> Pay Now
                </Link>
              )}
              
              {(selectedBooking.bookingStatus === 'CONFIRMED' || selectedBooking.paymentStatus === 'COMPLETED' || selectedBooking.paymentStatus === 'PAID') && (
                <PDFDownloadLink 
                  document={<GuestHouseApplicationPDF booking={selectedBooking} />} 
                  fileName={`booking_${selectedBooking.id}.pdf`}
                  className="btn btn-primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {({ loading }) => 
                    loading ? 'Generating PDF...' : <><FileText size={16} /> Download PDF</>
                  }
                </PDFDownloadLink>
              )}

              <button className="btn btn-secondary" onClick={() => setSelectedBooking(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
