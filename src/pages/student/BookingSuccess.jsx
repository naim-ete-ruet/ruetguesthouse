import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CheckCircle, FileText, Coffee } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { GuestHouseApplicationPDF } from '../../components/pdf/GuestHouseApplicationPDF';
import { bookingService } from '../../services/bookingService';
import { mealService } from '../../services/mealService';
import { useAuth } from '../../context/AuthContext';

export default function BookingSuccess() {
  const { state, pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(state?.booking || null);
  const [meal, setMeal] = useState(state?.meal || null);
  const [dbTimestamp, setDbTimestamp] = useState(null);
  const [isLoading, setIsLoading] = useState(!state?.booking && !state?.meal);

  const getDashboardPath = () => {
    if (pathname.startsWith('/teacher')) return '/teacher/dashboard';
    if (pathname.startsWith('/admin')) return '/admin/dashboard';
    if (pathname.startsWith('/student')) return '/student/dashboard';

    if (user?.role === 'teacher') return '/teacher/dashboard';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'student') return '/student/dashboard';

    const roleParam = searchParams.get('role');
    if (roleParam === 'teacher' || booking?.isTeacherBooking) return '/teacher/dashboard';
    if (roleParam === 'admin') return '/admin/dashboard';

    return '/student/dashboard';
  };

  const getDiningPath = () => {
    if (pathname.startsWith('/teacher') || user?.role === 'teacher') return '/teacher/meals';
    if (pathname.startsWith('/admin') || user?.role === 'admin') return '/admin/meals';
    return '/student/meals';
  };

  const handleGoToDashboard = () => {
    navigate(getDashboardPath(), { replace: true });
  };

  const handleGoToDining = () => {
    navigate(getDiningPath(), { replace: true });
  };

  useEffect(() => {
    const ref = searchParams.get('ref');
    const type = searchParams.get('type');
    const isMealRef = type === 'meal' || (ref && ref.startsWith('MEAL-')) || Boolean(meal);

    if (isMealRef) {
      if (!meal && ref) {
        mealService.getMealById(ref)
          .then(data => {
            setMeal(data);
            setIsLoading(false);
          })
          .catch(err => {
            console.error("Failed to load meal details", err);
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    } else {
      if (!booking && ref) {
        bookingService.getBookingById(ref)
          .then(data => {
            setBooking(data);
            setIsLoading(false);
          })
          .catch(err => {
            console.error("Failed to load booking details", err);
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    }
    // Fetch database timestamp for PDF issue date
    bookingService.getDatabaseTime().then(t => {
      if (t) setDbTimestamp(t);
    }).catch(err => console.warn("Failed to get DB time in BookingSuccess:", err));
  }, [booking, meal, searchParams]);

  if (isLoading) {
    return <div className="container text-center mt-12">Loading transaction details...</div>;
  }

  // 1. Dining Meal Payment Success View
  if (meal) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '600px', marginTop: '40px' }}>
        <div className="card text-center py-10 px-6">
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={40} className="text-success" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Dining Payment Successful!</h2>
          <p className="text-muted mb-6">
            Your meal order reference is <strong>{meal.id}</strong>.
          </p>

          <div className="card p-4 text-left mb-6 text-sm" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Guest Name</span>
                <strong>{meal.applicantName || user?.name || 'Guest User'}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Assigned Room</span>
                <strong>{meal.roomNumber ? `Room ${meal.roomNumber}` : 'N/A'}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Meal Date</span>
                <strong>{meal.mealDate}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Meal Type</span>
                <strong>{meal.mealType}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Persons</span>
                <strong>{meal.persons} Person(s)</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Amount Paid</span>
                <strong className="text-success text-base">৳{meal.totalAmount}</strong>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              type="button"
              onClick={handleGoToDining}
              className="btn btn-primary hover-scale w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Coffee size={18} /> View Dining Orders
            </button>
            <button 
              type="button"
              onClick={handleGoToDashboard}
              className="btn btn-secondary hover-scale w-full sm:w-auto"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Room Booking Payment Success View
  if (booking) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '600px', marginTop: '40px' }}>
        <div className="card text-center py-10 px-6">
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={40} className="text-success" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Booking & Payment Successful!</h2>
          <p className="text-muted mb-6">
            Your booking reference is <strong>{booking.id}</strong>.
          </p>

          <div className="card p-4 text-left mb-6 text-sm" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Applicant Name</span>
                <strong>{booking.applicantName || user?.name || 'Guest User'}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Room Allocation</span>
                <strong>{booking.assignedRoom ? `Room ${booking.assignedRoom}` : (booking.requestedRoomType || 'Pending Allocation').replace(/_/g, ' ')}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Check-In</span>
                <strong>{booking.checkInDate} {booking.checkInTime}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Check-Out</span>
                <strong>{booking.checkOutDate} {booking.checkOutTime}</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Total Days</span>
                <strong>{booking.totalDays} Day(s)</strong>
              </div>
              <div>
                <span className="text-muted text-xs block uppercase font-medium">Amount Paid</span>
                <strong className="text-success text-base">৳{booking.totalAmount}</strong>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <PDFDownloadLink 
              key={`${booking.id}_${dbTimestamp ? dbTimestamp.getTime() : 'init'}`}
              document={<GuestHouseApplicationPDF booking={booking} issueDateTime={dbTimestamp} />} 
              fileName={`booking_${booking.id}.pdf`}
              className="btn btn-primary hover-scale w-full sm:w-auto flex items-center justify-center gap-2"
              style={{ textDecoration: 'none' }}
            >
              {({ blob, url, loading, error }) => 
                loading ? 'Generating PDF...' : <><FileText size={18} /> Download Application PDF</>
              }
            </PDFDownloadLink>
            
            <button 
              type="button"
              onClick={handleGoToDashboard}
              className="btn btn-secondary hover-scale w-full sm:w-auto"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Fallback View when neither booking nor meal is found
  return (
    <div className="container text-center mt-12">
      <h2 className="text-xl font-bold mb-3">Invalid Access or Record Not Found</h2>
      <p className="text-muted mb-4">We could not locate the requested booking or meal payment record.</p>
      <button className="btn btn-primary mt-2" onClick={handleGoToDashboard}>
        Go to Dashboard
      </button>
    </div>
  );
}
