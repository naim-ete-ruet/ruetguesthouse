import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { paymentService } from '../../services/paymentService';
import { Search, Filter, DollarSign, CheckCircle, AlertCircle, SlidersHorizontal, X } from 'lucide-react';

export default function ManagePayments() {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, PAID, PENDING, REFUNDED
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedPayment) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedPayment]);

  useEffect(() => {
    fetchPayments();

    const handleSync = () => fetchPayments();
    window.addEventListener('paymentsChanged', handleSync);
    window.addEventListener('bookingsChanged', handleSync);
    return () => {
      window.removeEventListener('paymentsChanged', handleSync);
      window.removeEventListener('bookingsChanged', handleSync);
    };
  }, []);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const data = await paymentService.getAllPayments();
      setPayments(data);
    } catch (err) {
      console.error("Failed to load payments ledger:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (bookingId) => {
    if (window.confirm("Mark this payment as verified and manually paid?")) {
      try {
        await paymentService.verifyCashPayment(bookingId);
        await fetchPayments();
      } catch (err) {
        console.error("Verification failed", err);
        alert(err.message || "Failed to verify cash payment");
      }
    }
  };

  const sortedPayments = [...payments].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.paidAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.paidAt || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return String(b.bookingId || b.id || '').localeCompare(String(a.bookingId || a.id || ''), undefined, { numeric: true });
  });

  const filteredPayments = sortedPayments.filter(p => {
    let matchesFilter = true;
    const status = (p.paymentStatus || '').toUpperCase();
    if (filter === 'PAID') {
      matchesFilter = status === 'PAID' || status === 'COMPLETED';
    } else if (filter === 'PENDING') {
      matchesFilter = status === 'PENDING';
    } else if (filter === 'REFUNDED') {
      matchesFilter = status === 'REFUNDED';
    }

    if (!matchesFilter) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const ref = (p.bookingId || p.id || '').toLowerCase();
    const name = (p.applicantName || '').toLowerCase();
    const date = (p.checkInDate || p.createdAt || '').toLowerCase();
    return ref.includes(q) || name.includes(q) || date.includes(q);
  });

  // Calculate stats directly from permanent payments ledger
  const stats = paymentService.calculateStats(payments);

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
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Total Collected Revenue</p>
              <h3 className="text-2xl font-bold">৳{stats.totalRevenue}</h3>
            </div>
          </div>
        </div>
        <div className="card border-l-4" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Pending Payments</p>
              <h3 className="text-2xl font-bold">{stats.pendingCount} <span className="text-sm font-normal text-muted">bookings</span></h3>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input 
            type="text" 
            placeholder="Search by ID, Name, or Date..." 
            className="form-input w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="text-muted flex-shrink-0" size={20} />
          <select className="form-select w-full sm:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Transactions</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      <div className="card table-responsive" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '850px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Transaction Ref (Booking ID)</th>
              <th className="p-3 text-left">Applicant</th>
              <th className="p-3 text-left">Stay Dates</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="text-center p-4">Loading payments ledger...</td></tr>
            ) : filteredPayments.map((p, idx) => {
              const isPaid = p.paymentStatus === 'PAID' || p.paymentStatus === 'COMPLETED';
              const isRefunded = p.paymentStatus === 'REFUNDED';
              const isPending = p.paymentStatus === 'PENDING';

              return (
                <tr key={p.id || p.bookingId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="p-3 text-left text-muted font-mono text-sm">{idx + 1}</td>
                  <td className="p-3 text-left font-medium text-primary">{p.bookingId || p.id}</td>
                  <td className="p-3 text-left text-sm">
                    <div className="font-semibold">{p.applicantName || 'Guest'}</div>
                    <span className="text-muted text-xs">{p.applicantMobile || p.mobileNumber || ''}</span>
                  </td>
                  <td className="p-3 text-left text-sm text-muted whitespace-nowrap">
                    {formatBookingDateRange(p.checkInDate, p.checkOutDate)}
                  </td>
                  <td className="p-3 text-left font-bold">৳{p.amount}</td>
                  <td className="p-3 text-left">
                    <span className={`badge ${
                      isPaid ? 'badge-success' : isRefunded ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {p.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center">
                      <button 
                        onClick={() => setSelectedPayment(p)}
                        className="btn btn-option hover-scale"
                        title="View transaction options and details"
                      >
                        <SlidersHorizontal size={14} /> Option
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {!isLoading && filteredPayments.length === 0 && (
               <tr><td colSpan="7" className="text-center p-8 text-muted">No transactions found matching your criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Option Details Modal rendered via createPortal */}
      {selectedPayment && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPayment(null);
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
              maxWidth: '680px', 
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
                <h2 className="text-lg sm:text-xl font-bold">Transaction: <span className="text-primary">{selectedPayment.bookingId || selectedPayment.id}</span></h2>
                <span className={`badge ${
                  (selectedPayment.paymentStatus === 'PAID' || selectedPayment.paymentStatus === 'COMPLETED') ? 'badge-success' : 
                  selectedPayment.paymentStatus === 'REFUNDED' ? 'badge-danger' : 'badge-warning'
                }`}>
                  {selectedPayment.paymentStatus}
                </span>
              </div>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="p-1 rounded-full hover:bg-gray-100 transition"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2 Balanced Side-by-Side Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs sm:text-sm">
              {/* Card 1: Applicant Details */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Applicant Information</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div className="col-span-2"><span className="text-muted block text-xs">Name:</span> <strong className="text-text">{selectedPayment.applicantName || 'Guest'}</strong></div>
                  <div><span className="text-muted block text-xs">Mobile:</span> <strong className="text-text">{selectedPayment.applicantMobile || selectedPayment.mobileNumber || 'N/A'}</strong></div>
                  <div><span className="text-muted block text-xs">Role:</span> <span className="text-text capitalize">{selectedPayment.applicantRole || 'Guest'}</span></div>
                  <div className="col-span-2"><span className="text-muted block text-xs">Email:</span> <span className="text-text">{selectedPayment.applicantEmail || 'N/A'}</span></div>
                </div>
              </div>

              {/* Card 2: Payment & Booking Placement Time */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Placement & Payment Info</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div className="col-span-2">
                    <span className="text-muted block text-xs">Booking Placed At:</span>
                    <strong className="text-text">{formatPlacedDateTime(selectedPayment.createdAt)}</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Stay Dates:</span>
                    <span className="text-text">{formatBookingDateRange(selectedPayment.checkInDate, selectedPayment.checkOutDate)}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Amount:</span>
                    <strong className="text-success font-bold text-base">৳{selectedPayment.amount}</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Payment Method:</span>
                    <span className="text-text font-medium">{selectedPayment.paymentMethod || 'ONLINE'}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Paid At:</span>
                    <span className="text-text">{selectedPayment.paidAt ? formatPlacedDateTime(selectedPayment.paidAt) : 'Pending'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Verification References */}
            <div className="p-2.5 rounded-lg text-xs sm:text-sm border mb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-xs uppercase font-bold text-muted mb-1.5 tracking-wider">Transaction References</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted">Transaction ID:</span> <span className="font-mono">{selectedPayment.transactionId || 'N/A'}</span></div>
                <div><span className="text-muted">Invoice Number:</span> <span className="font-mono">{selectedPayment.invoiceNumber || 'N/A'}</span></div>
                <div><span className="text-muted">Bank Tran ID:</span> <span className="font-mono">{selectedPayment.bankTranId || 'N/A'}</span></div>
                <div><span className="text-muted">Booking Reference:</span> <strong className="text-primary">{selectedPayment.bookingId || selectedPayment.id}</strong></div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              {selectedPayment.paymentStatus === 'PENDING' ? (
                <button 
                  onClick={async () => {
                    await handleVerify(selectedPayment.bookingId);
                    setSelectedPayment(null);
                  }}
                  className="btn btn-success flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem', minHeight: '38px' }}
                >
                  <CheckCircle size={15} /> Verify Cash Payment
                </button>
              ) : <div />}
              <button 
                onClick={() => setSelectedPayment(null)} 
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', minHeight: '38px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
