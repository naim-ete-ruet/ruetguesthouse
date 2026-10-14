import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, Shield } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function PaymentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingBookings, setPendingBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPendingPayments = async () => {
      try {
        const bookings = await bookingService.getStudentBookings(user.id);
        const pending = bookings.filter(b => 
          b.paymentStatus === 'PENDING' && 
          b.approvalStatus === 'PENDING_PAYMENT' && 
          b.bookingStatus !== 'CANCELLED'
        );
        setPendingBookings(pending);
        if (pending.length > 0) setSelectedBooking(pending[0]);
        else setSelectedBooking(null);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPendingPayments();

    window.addEventListener('indicatorsChanged', fetchPendingPayments);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchPendingPayments);
    };
  }, [user.id]);

  const handlePayment = async () => {
    if (!selectedBooking) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedBooking.totalAmount,
          applicant_name: selectedBooking.applicantName || user.name,
          user_id: user.id,
          role: user.role,
          email: user.email,
          mobile: selectedBooking.mobileNumber || user.mobile,
          item_type: 'booking',
          reference_id: selectedBooking.id
        })
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to SSLCOMMERZ Secure Gateway
      } else {
        alert("Payment Gateway Failed to initialize.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Payment Error:", err);
      alert("Failed to connect to secure payment server.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <h1 className="text-2xl font-bold mb-6">Payment</h1>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : pendingBookings.length === 0 ? (
        <div className="card text-center py-12">
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={32} className="text-success" />
          </div>
          <h3 className="font-bold text-lg">No pending payments</h3>
          <p className="text-muted mt-2">All your approved bookings have been paid for.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2">
            <h2 className="text-lg font-bold mb-4">Select Booking to Pay</h2>
            <div className="flex flex-col gap-4 mb-6">
              {pendingBookings.map(booking => (
                <div 
                  key={booking.id} 
                  className="card p-4 cursor-pointer transition"
                  style={{ 
                    borderColor: selectedBooking?.id === booking.id ? 'var(--color-primary)' : 'var(--color-border)',
                    boxShadow: selectedBooking?.id === booking.id ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'var(--shadow-sm)'
                  }}
                  onClick={() => setSelectedBooking(booking)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold">{booking.id}</h4>
                      <p className="text-sm text-muted">{booking.checkInDate} ({booking.totalDays} nights)</p>
                      <p className="text-xs text-warning mt-1 font-bold">
                        {booking.requestedRoomType === 'TYPE_3' ? 'Deadline: 2 hours' : 'Deadline: 5 minutes'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted">Amount</p>
                      <p className="font-bold text-lg">৳{booking.totalAmount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card sticky" style={{ top: '100px' }}>
              <h3 className="font-bold text-lg mb-4 border-bottom pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>Order Summary</h3>
              
              {selectedBooking && (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Booking ID</span>
                    <span className="font-medium">{selectedBooking.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Room No</span>
                    <span className="font-medium font-bold">{selectedBooking.assignedRoom || 'Pending Assignment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Room Type</span>
                    <span className="font-medium">{selectedBooking.requestedRoomType.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Duration</span>
                    <span className="font-medium">{selectedBooking.totalDays} nights</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Rate</span>
                    <span className="font-medium">৳{selectedBooking.totalAmount / selectedBooking.totalDays}</span>
                  </div>
                  
                  <div className="border-top pt-3 mt-2 flex justify-between items-center" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <span className="font-bold">Total Payable</span>
                    <span className="font-bold text-xl text-primary">৳{selectedBooking.totalAmount}</span>
                  </div>

                  <button 
                    className="btn btn-primary w-full mt-6"
                    onClick={handlePayment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Proceed to Secure Payment'}
                  </button>

                  <div className="flex items-center gap-1 justify-center text-xs text-muted mt-4">
                    <Shield size={14} /> <span>Secured by SSLCOMMERZ</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
