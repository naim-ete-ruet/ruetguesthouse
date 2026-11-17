import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, Shield, RefreshCw, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../../config/api';

function PaymentCountdown({ booking, onExpire }) {
  const isType3 = booking.requestedRoomType === 'TYPE_3';
  const deadlineMs = isType3 ? 2 * 60 * 60 * 1000 : 5 * 60 * 1000;

  const calculateRemaining = useCallback(() => {
    let deadlineTime = 0;
    if (booking.paymentDeadline) {
      deadlineTime = new Date(booking.paymentDeadline).getTime();
    } else {
      const storageKey = `ruet_payment_start_${booking.id}`;
      let start = localStorage.getItem(storageKey);
      if (!start) {
        start = String(Date.now());
        localStorage.setItem(storageKey, start);
      }
      deadlineTime = Number(start) + deadlineMs;
    }
    return Math.max(0, deadlineTime - Date.now());
  }, [booking, deadlineMs]);

  const [remainingMs, setRemainingMs] = useState(calculateRemaining);

  useEffect(() => {
    const timer = setInterval(() => {
      const rem = calculateRemaining();
      setRemainingMs(rem);
      if (rem <= 0) {
        clearInterval(timer);
        if (onExpire) onExpire(booking.id);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateRemaining, booking.id, onExpire]);

  if (remainingMs <= 0) {
    return (
      <span className="text-xs font-bold text-danger flex items-center gap-1 mt-1">
        <AlertCircle size={14} /> Time Expired (Room Released)
      </span>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const timeString = hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = remainingMs < 60000; // Less than 1 minute

  return (
    <span 
      className="text-xs font-bold flex items-center gap-1 mt-1" 
      style={{ color: isUrgent ? '#ef4444' : '#d97706' }}
    >
      <Clock size={14} className={isUrgent ? 'animate-pulse' : ''} />
      <span>Time Remaining: {timeString}</span>
    </span>
  );
}

export default function PaymentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingBookings, setPendingBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiredIds, setExpiredIds] = useState(new Set());

  const fetchPendingPayments = useCallback(async () => {
    try {
      const bookings = await bookingService.getStudentBookings(user);
      
      const pending = bookings.filter(b => 
        b.paymentStatus === 'PENDING' && 
        b.approvalStatus === 'PENDING_PAYMENT' && 
        b.bookingStatus !== 'CANCELLED'
      );

      setPendingBookings(pending);
      if (pending.length > 0) {
        setSelectedBooking(prev => {
          if (prev && pending.some(p => p.id === prev.id)) {
            return pending.find(p => p.id === prev.id);
          }
          return pending[0];
        });
      } else {
        setSelectedBooking(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPendingPayments();

    window.addEventListener('indicatorsChanged', fetchPendingPayments);
    window.addEventListener('roomsChanged', fetchPendingPayments);
    return () => {
      window.removeEventListener('indicatorsChanged', fetchPendingPayments);
      window.removeEventListener('roomsChanged', fetchPendingPayments);
    };
  }, [fetchPendingPayments]);

  const handleBookingExpired = useCallback((id) => {
    setExpiredIds(prev => new Set([...prev, id]));
    bookingService.expireBooking(id).then(() => {
      fetchPendingPayments();
    }).catch(() => {});
  }, [fetchPendingPayments]);

  const isSelectedExpired = selectedBooking ? expiredIds.has(selectedBooking.id) : false;

  const handlePayment = async () => {
    if (!selectedBooking || isSelectedExpired) return;
    setIsProcessing(true);
    
    try {
      const response = await apiFetch('/api/payment/init', {
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
          reference_id: selectedBooking.id,
          client_url: window.location.origin
        })
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to SSLCOMMERZ Secure Gateway
      } else {
        alert("Payment Gateway Failed to initialize: " + (data.error || "Please check credentials"));
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Payment Error:", err);
      alert("Failed to connect to secure payment server. Please verify your connection or try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <h1 className="text-2xl font-bold mb-6">Payment</h1>

      {isLoading ? (
        <div className="text-center py-8">Loading pending payments...</div>
      ) : pendingBookings.length === 0 ? (
        <div className="card text-center py-12">
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={32} className="text-success" />
          </div>
          <h3 className="font-bold text-lg">No pending payments</h3>
          <p className="text-muted mt-2">All your approved bookings have been paid for or none are awaiting payment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2">
            <h2 className="text-lg font-bold mb-4">Select Booking to Pay</h2>
            <div className="flex flex-col gap-4 mb-6">
              {pendingBookings.map(booking => {
                const isExpired = expiredIds.has(booking.id);
                const isSelected = selectedBooking?.id === booking.id;

                return (
                  <div 
                    key={booking.id} 
                    className="card p-4 cursor-pointer transition"
                    style={{ 
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'var(--shadow-sm)',
                      opacity: isExpired ? 0.6 : 1
                    }}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <h4 className="font-bold">{booking.id}</h4>
                        <p className="text-sm text-muted">{booking.checkInDate} ({booking.totalDays} nights)</p>
                        <p className="text-xs text-muted mt-0.5">
                          Room: <strong className="text-primary">{booking.assignedRoom || 'Assigned Room'}</strong>
                        </p>
                        <PaymentCountdown booking={booking} onExpire={handleBookingExpired} />
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <p className="text-xs sm:text-sm text-muted">Amount</p>
                        <p className="font-bold text-base sm:text-lg">৳{booking.totalAmount}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="card md:sticky" style={{ top: '90px' }}>
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
                    <span className="font-medium">{(selectedBooking.requestedRoomType || 'Standard Room').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Duration</span>
                    <span className="font-medium">{selectedBooking.totalDays || 1} nights</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Rate</span>
                    <span className="font-medium">
                      ৳{selectedBooking.totalDays > 0 ? Math.round(selectedBooking.totalAmount / selectedBooking.totalDays) : selectedBooking.totalAmount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded text-xs" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)' }}>
                    <div className="font-bold text-warning mb-1 flex items-center gap-1">
                      <Clock size={13} /> Payment Window:
                    </div>
                    <PaymentCountdown booking={selectedBooking} onExpire={handleBookingExpired} />
                    <p className="text-muted text-[11px] mt-1">
                      * If payment is not completed before the timer expires, the room will be automatically released.
                    </p>
                  </div>
                  
                  <div className="border-top pt-3 mt-2 flex justify-between items-center" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <span className="font-bold">Total Payable</span>
                    <span className="font-bold text-xl text-primary">৳{selectedBooking.totalAmount}</span>
                  </div>

                  <button 
                    className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2"
                    onClick={handlePayment}
                    disabled={isProcessing || isSelectedExpired}
                    style={{ minHeight: '44px', backgroundColor: isSelectedExpired ? '#9ca3af' : undefined }}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Connecting to Gateway...</span>
                      </>
                    ) : isSelectedExpired ? (
                      <span>Time Expired (Room Released)</span>
                    ) : (
                      <span className="flex items-center gap-2"><CreditCard size={18} /> Proceed to Secure Payment</span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 justify-center text-xs text-muted mt-3">
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