import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CheckCircle, FileText } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { GuestHouseApplicationPDF } from '../../components/pdf/GuestHouseApplicationPDF';
import { bookingService } from '../../services/bookingService';
import { useAuth } from '../../context/AuthContext';

export default function BookingSuccess() {
  const { state, pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(state?.booking || null);
  const [isLoading, setIsLoading] = useState(!state?.booking);

  const getDashboardPath = () => {
    // 1. Identify by URL path prefix
    if (pathname.startsWith('/teacher')) return '/teacher/dashboard';
    if (pathname.startsWith('/admin')) return '/admin/dashboard';
    if (pathname.startsWith('/student')) return '/student/dashboard';

    // 2. Identify by user role
    if (user?.role === 'teacher') return '/teacher/dashboard';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'student') return '/student/dashboard';

    // 3. Fallback based on booking details or query params
    const roleParam = searchParams.get('role');
    if (roleParam === 'teacher' || booking?.isTeacherBooking) return '/teacher/dashboard';
    if (roleParam === 'admin') return '/admin/dashboard';

    return '/student/dashboard';
  };

  const handleGoToDashboard = () => {
    navigate(getDashboardPath(), { replace: true });
  };

  useEffect(() => {
    if (!booking) {
      const ref = searchParams.get('ref');
      if (ref) {
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
  }, [booking, searchParams]);

  if (isLoading) {
    return <div className="container text-center mt-12">Loading booking details...</div>;
  }

  if (!booking) {
    return (
      <div className="container text-center mt-12">
        <h2>Invalid Access or Booking Not Found</h2>
        <button className="btn btn-primary mt-4" onClick={handleGoToDashboard}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '600px', marginTop: '40px' }}>
      <div className="card text-center py-12">
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle size={40} className="text-success" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Booking & Payment Successful!</h2>
        <p className="text-muted mb-6">
          Your booking reference is <strong>{booking.id}</strong>.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <PDFDownloadLink 
            document={<GuestHouseApplicationPDF booking={booking} />} 
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
