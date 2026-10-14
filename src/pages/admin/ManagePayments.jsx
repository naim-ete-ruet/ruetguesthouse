import { useState, useEffect } from 'react';
import { bookingService } from '../../services/bookingService';
import { Search, Filter, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

export default function ManagePayments() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, PAID, PENDING
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
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

  const handleVerify = async (id) => {
    if (window.confirm("Mark this payment as verified and manually paid?")) {
      try {
        await bookingService.verifyCashPayment(id);
        setBookings(bookings.map(b => b.id === id ? { 
          ...b, 
          paymentStatus: 'PAID', 
          bookingStatus: 'CONFIRMED',
          approvalStatus: 'APPROVED'
        } : b));
      } catch (err) {
        console.error("Verification failed", err);
      }
    }
  };

  const filteredBookings = bookings.filter(b => {
    let matchesFilter = true;
    if (filter === 'PAID') {
      matchesFilter = (b.paymentStatus === 'PAID' || b.paymentStatus === 'COMPLETED') && b.bookingStatus !== 'CANCELLED';
    } else if (filter === 'PENDING') {
      matchesFilter = b.paymentStatus === 'PENDING' && b.bookingStatus !== 'CANCELLED' && b.approvalStatus !== 'CANCELLED';
    } else if (filter === 'REFUNDED') {
      matchesFilter = b.paymentStatus === 'REFUNDED';
    }
    const matchesSearch = (b.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (b.applicantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (b.checkInDate || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate stats
  const totalRevenue = bookings
    .filter(b => (b.paymentStatus === 'PAID' || b.paymentStatus === 'COMPLETED') && b.bookingStatus !== 'CANCELLED')
    .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

  const pendingCount = bookings
    .filter(b => b.paymentStatus === 'PENDING' && b.bookingStatus !== 'CANCELLED' && b.approvalStatus !== 'CANCELLED')
    .length;

  const formatDateSlash = (d) => {
    if (!d) return '';
    if (typeof d === 'string') {
      const match = d.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
      if (match) return `${match[1]}/${match[2]}/${match[3]}`;
    }
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  };

  const formatBookingDateRange = (checkIn, checkOut) => {
    if (!checkIn) return 'N/A';
    const formattedIn = formatDateSlash(checkIn);
    if (!checkOut) return formattedIn;
    const formattedOut = formatDateSlash(checkOut);
    return `${formattedIn} - ${formattedOut}`;
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">Manage Payments</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card border-l-4" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-50 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Total Collected Revenue</p>
              <h3 className="text-2xl font-bold">৳{totalRevenue}</h3>
            </div>
          </div>
        </div>
        <div className="card border-l-4" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-50 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Pending Payments</p>
              <h3 className="text-2xl font-bold">{pendingCount} <span className="text-sm font-normal text-muted">bookings</span></h3>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6 flex justify-between items-center">
        <div className="flex items-center gap-2 w-full max-w-md">
          <Search className="text-muted" size={20} />
          <input 
            type="text" 
            placeholder="Search by ID, Name, or Date..." 
            className="form-input" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-muted" size={20} />
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Transactions</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '800px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3 text-left">Transaction Ref (Booking ID)</th>
              <th className="p-3 text-left">Applicant</th>
              <th className="p-3 text-left">Booking Date</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="text-center p-4">Loading...</td></tr>
            ) : filteredBookings.map(booking => (
              <tr key={booking.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 text-left font-medium text-primary">{booking.id}</td>
                <td className="p-3 text-left text-sm">
                  {booking.applicantName} <br/>
                  <span className="text-muted text-xs">{booking.mobileNumber}</span>
                </td>
                <td className="p-3 text-left text-sm font-medium whitespace-nowrap">
                  {formatBookingDateRange(booking.checkInDate, booking.checkOutDate)}
                </td>
                <td className="p-3 text-left font-bold">৳{booking.totalAmount}</td>
                <td className="p-3 text-left">
                  <span className={`badge ${
                    booking.paymentStatus === 'PAID' || booking.paymentStatus === 'COMPLETED' ? 'badge-success' :
                    booking.paymentStatus === 'REFUNDED' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {booking.paymentStatus}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    {booking.paymentStatus === 'PENDING' && booking.bookingStatus !== 'CANCELLED' ? (
                      <button 
                        onClick={() => handleVerify(booking.id)} 
                        className="btn btn-success" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--color-success)', color: 'white' }}
                      >
                        <CheckCircle size={14} /> Verify Cash
                      </button>
                    ) : (
                      <span className="text-xs text-muted">
                        {booking.paymentStatus === 'REFUNDED' ? 'Refunded' : 'Processed'}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            
            {!isLoading && filteredBookings.length === 0 && (
               <tr><td colSpan="6" className="text-center p-8 text-muted">No transactions found matching your criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
