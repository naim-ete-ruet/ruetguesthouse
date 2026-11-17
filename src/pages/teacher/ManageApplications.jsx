import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService, sortBookingsNewestFirst } from '../../services/bookingService';
import { API_BASE_URL, apiFetch } from '../../config/api';
import { Eye, SlidersHorizontal, Check, X, Search, Filter, XCircle } from 'lucide-react';

export default function TeacherManageApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Extract department from teacher's email e.g. teacher@cse.ruet.ac.bd -> cse
  const teacherDepartment = user?.department || user?.email?.split('@')[1]?.split('.')[0]?.toLowerCase();

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const allBookings = await bookingService.getAllBookings({ portal: 'teacher', teacherId: user.id });
      
      // Filter applications that are assigned to this teacher
      const teacherApps = allBookings.filter(b => {
        // Only show bookings that explicitly selected this teacher for approval
        if (b.approvingTeacherId !== user.id) return false;
        // Don't show the teacher's own applications in their approval list
        if (b.userId === user.id) return false;
        if (b.isTeacherBooking) return false;
        return true;
      });
      
      setApplications(sortBookingsNewestFirst(teacherApps));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Lock body scroll when modal is open so window never shifts or scrolls
  useEffect(() => {
    if (selectedApp) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedApp]);

  const handleApprove = async (id) => {
    if (window.confirm("Approve this application and forward for payment?")) {
      try {
        await bookingService.updateBookingStatus(id, { 
          approvalStatus: 'PENDING_PAYMENT' 
        });
        
        // Find approved booking to extract student details
        const targetApp = applications.find(app => app.id === id);

        // Local state update
        setApplications(apps => apps.map(app => 
          app.id === id ? { ...app, approvalStatus: 'PENDING_PAYMENT' } : app
        ));
        if (selectedApp && selectedApp.id === id) {
          setSelectedApp({ ...selectedApp, approvalStatus: 'PENDING_PAYMENT' });
        }

        // Trigger payment notification email to student (non-blocking with 5s timeout)
        try {
          apiFetch('/api/email/student-payment-notice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: id,
              studentEmail: targetApp?.studentEmail || targetApp?.applicantEmail,
              studentName: targetApp?.applicantName,
              teacherName: user?.name,
              assignedRoom: targetApp?.assignedRoom,
              requestedRoomType: targetApp?.requestedRoomType,
              checkInDate: targetApp?.checkInDate,
              checkOutDate: targetApp?.checkOutDate,
              totalAmount: targetApp?.totalAmount
            }),
            signal: AbortSignal.timeout(5000)
          }).catch(err => console.warn("Failed to dispatch student payment notice:", err));
        } catch (e) {
          console.warn("Payment notice trigger failed:", e);
        }
      } catch (err) {
        console.error("Action failed", err);
      }
    }
  };

  const handleReject = async (id) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }
    
    if (window.confirm("Are you sure you want to reject this application?")) {
      try {
        const app = applications.find(a => a.id === id);
        const isPaid = app && (app.paymentStatus === 'PAID' || app.paymentStatus === 'COMPLETED');

        if (isPaid) {
          const res = await bookingService.cancelBookingWithRefund(id, app.totalAmount, `Rejected by Teacher: ${rejectionReason}`);
          alert(res?.message || "Application rejected and refund request sent to SSLCommerz.");
        } else {
          await bookingService.updateBookingStatus(id, { 
            approvalStatus: 'REJECTED_BY_TEACHER',
            bookingStatus: 'CANCELLED',
            rejectionReason
          });
          alert("Application rejected.");
        }
        
        // Dispatch rejection email to student from workmail.naim@gmail.com
        try {
          apiFetch('/api/email/teacher-rejection-notice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: id,
              studentEmail: app?.studentEmail || app?.applicantEmail,
              studentName: app?.applicantName || 'Student',
              teacherName: user?.name || 'Department Teacher',
              rejectionReason,
              requestedRoomType: app?.requestedRoomType,
              checkInDate: app?.checkInDate,
              checkOutDate: app?.checkOutDate
            })
          }).catch(err => console.warn('Teacher rejection email dispatch notice:', err));
        } catch (e) {}

        // Local state update
        setApplications(apps => apps.map(app => 
          app.id === id ? { ...app, approvalStatus: 'REJECTED_BY_TEACHER', bookingStatus: 'CANCELLED', paymentStatus: isPaid ? 'REFUNDED' : app.paymentStatus, rejectionReason } : app
        ));
        if (selectedApp && selectedApp.id === id) {
          setSelectedApp({ ...selectedApp, approvalStatus: 'REJECTED_BY_TEACHER', bookingStatus: 'CANCELLED', paymentStatus: isPaid ? 'REFUNDED' : selectedApp.paymentStatus, rejectionReason });
        }
        setIsRejecting(false);
        setRejectionReason('');
      } catch (err) {
        console.error("Action failed", err);
      }
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

  const formatBookingDateRange = (checkIn, checkOut) => {
    if (!checkIn) return 'N/A';
    const inStr = String(checkIn).replace(/-/g, '/');
    if (!checkOut) return inStr;
    return `${inStr} - ${String(checkOut).replace(/-/g, '/')}`;
  };

  const filteredApps = sortBookingsNewestFirst(applications.filter(app => {
    let matchesFilter = true;
    if (filter === 'PENDING') matchesFilter = app.approvalStatus === 'PENDING_TEACHER_APPROVAL';
    else if (filter === 'APPROVED') matchesFilter = ['PENDING_PAYMENT', 'PENDING_ADMIN_APPROVAL', 'APPROVED'].includes(app.approvalStatus);
    else if (filter === 'REJECTED') matchesFilter = app.approvalStatus === 'REJECTED_BY_TEACHER' || app.approvalStatus === 'REJECTED' || app.bookingStatus === 'CANCELLED';

    if (!matchesFilter) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (app.id || '').toLowerCase().includes(q) ||
      (app.applicantName || '').toLowerCase().includes(q) ||
      (app.department || '').toLowerCase().includes(q) ||
      (app.checkInDate || '').toLowerCase().includes(q) ||
      (app.assignedRoom || '').toLowerCase().includes(q)
    );
  }));

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Applications for Review</h1>
          <p className="text-muted">Manage applications assigned to you</p>
          <div className="notice-box-green">
            <SlidersHorizontal size={15} className="flex-shrink-0" />
            <span>To Review Application Approval / Rejection Click the Option Button</span>
          </div>
        </div>
      </div>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input 
            type="text" 
            placeholder="Search by ID, Student, or Date..." 
            className="form-input w-full" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="text-muted flex-shrink-0" size={20} />
          <select className="form-select w-full sm:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Applications</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="card table-responsive" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">#</th>
              <th className="p-3">App ID</th>
              <th className="p-3">Student</th>
              <th className="p-3">Room No.</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="text-center p-4">Loading applications...</td></tr>
            ) : filteredApps.length === 0 ? (
              <tr><td colSpan="7" className="text-center p-4 text-muted">No applications found matching your criteria.</td></tr>
            ) : filteredApps.map((app, idx) => (
              <tr key={app.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 text-muted font-mono text-sm">{idx + 1}</td>
                <td className="p-3 font-medium text-primary">{app.id}</td>
                <td className="p-3 text-sm">
                  <div className="font-bold">{app.applicantName}</div>
                  <div className="text-muted text-xs">{app.designation || 'Student'} • {app.department?.toUpperCase()}</div>
                </td>
                <td className="p-3 text-sm font-semibold">
                  {app.assignedRoom ? (
                    <span className="text-primary">
                      {app.assignedRoom.toLowerCase().startsWith('room') 
                        ? app.assignedRoom 
                        : `Room ${app.assignedRoom}`}
                    </span>
                  ) : (
                    <span className="text-muted font-normal text-xs">Not assigned</span>
                  )}
                </td>
                <td className="p-3 text-sm text-muted whitespace-nowrap">
                  {formatBookingDateRange(app.checkInDate, app.checkOutDate)}
                </td>
                <td className="p-3">
                  <span className={`badge ${
                    ['PENDING_PAYMENT', 'PENDING_ADMIN_APPROVAL', 'APPROVED'].includes(app.approvalStatus) ? 'badge-success' : 
                    app.approvalStatus === 'PENDING_TEACHER_APPROVAL' ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {(app.approvalStatus || 'PENDING').replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setSelectedApp(app)}
                      className="btn btn-option hover-scale" 
                      title="View application options and details"
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

      {/* Details Modal rendered via createPortal at exact middle position */}
      {selectedApp && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) { setSelectedApp(null); setIsRejecting(false); }
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
              maxWidth: '700px', 
              maxHeight: '92vh', 
              overflowY: 'auto',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '1.25rem'
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold">Review Application: <span className="text-primary">{selectedApp.id}</span></h2>
                <span className={`badge ${
                  ['PENDING_PAYMENT', 'PENDING_ADMIN_APPROVAL', 'APPROVED'].includes(selectedApp.approvalStatus) ? 'badge-success' : 
                  selectedApp.approvalStatus === 'PENDING_TEACHER_APPROVAL' ? 'badge-warning' : 'badge-danger'
                }`}>
                  {(selectedApp.approvalStatus || 'PENDING').replace(/_/g, ' ')}
                </span>
              </div>
              <button 
                onClick={() => { setSelectedApp(null); setIsRejecting(false); }}
                className="p-1 rounded-full hover:bg-gray-100 transition"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* 2 Balanced Side-by-Side Cards (Stack on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs sm:text-sm">
              {/* Card 1: Student Details */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Student Details</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div><span className="text-muted block text-xs">Name:</span> <strong className="text-text">{selectedApp.applicantName}</strong></div>
                  <div><span className="text-muted block text-xs">Mobile / Roll:</span> <strong className="text-text">{selectedApp.mobileNumber}</strong></div>
                  <div><span className="text-muted block text-xs">Designation:</span> <span className="text-text">{selectedApp.designation || 'Student'}</span></div>
                  <div><span className="text-muted block text-xs">Department:</span> <span className="text-text">{selectedApp.department?.toUpperCase() || 'N/A'}</span></div>
                  <div className="col-span-2"><span className="text-muted block text-xs">Stay Purpose:</span> <span className="text-text">{selectedApp.stayPurpose || 'Official / Guest'}</span></div>
                </div>
              </div>

              {/* Card 2: Stay & Room Details */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Stay & Room Details</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div className="col-span-2">
                    <span className="text-muted block text-xs">Booking Placed At:</span>
                    <strong className="text-text">{formatPlacedDateTime(selectedApp.createdAt)}</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Check-in:</span>
                    <strong className="text-text">{selectedApp.checkInDate}</strong> <span className="text-xs text-muted">({selectedApp.checkInTime})</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Check-out:</span>
                    <strong className="text-text">{selectedApp.checkOutDate}</strong> <span className="text-xs text-muted">({selectedApp.checkOutTime})</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Room No:</span>
                    <strong className="text-primary font-bold">
                      {selectedApp.assignedRoom 
                        ? (selectedApp.assignedRoom.toLowerCase().startsWith('room') ? selectedApp.assignedRoom : `Room ${selectedApp.assignedRoom}`)
                        : 'Pending Allocation'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Room Type:</span>
                    <span className="text-text">{(selectedApp.requestedRoomType || 'Standard Room').replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Duration:</span>
                    <span className="text-text">{selectedApp.totalDays} Night(s)</span>
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Total Amount:</span>
                    <strong className="text-success font-bold text-sm sm:text-base">৳{selectedApp.totalAmount}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Guest Information */}
            {selectedApp.guests && selectedApp.guests.length > 0 && (
              <div className="p-2.5 rounded-lg text-xs sm:text-sm border mb-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-1.5 tracking-wider">Guest Information</div>
                <div className="flex flex-col gap-1.5">
                  {selectedApp.guests.map((g, i) => (
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
              </div>
            )}

            {selectedApp.rejectionReason && (
              <div className="p-2.5 rounded border border-danger mb-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                <strong className="text-danger block text-xs font-semibold mb-1">Rejection Reason:</strong>
                <p className="text-xs sm:text-sm">{selectedApp.rejectionReason}</p>
              </div>
            )}

            {isRejecting && selectedApp.approvalStatus === 'PENDING_TEACHER_APPROVAL' && (
              <div className="p-3 rounded border mb-3" style={{ borderColor: 'var(--color-warning)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                <label className="block text-xs font-bold uppercase text-muted mb-1.5">Reason for rejection:</label>
                <textarea 
                  className="form-input w-full mb-2 text-xs sm:text-sm" 
                  rows="2" 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejecting this application..."
                ></textarea>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsRejecting(false)} className="btn btn-secondary text-xs py-1 px-3">Cancel</button>
                  <button onClick={() => handleReject(selectedApp.id)} className="btn btn-danger text-xs py-1 px-3">Confirm Reject</button>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            {!isRejecting && (
              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                {selectedApp.approvalStatus === 'PENDING_TEACHER_APPROVAL' && (
                  <>
                    <button 
                      onClick={() => { handleApprove(selectedApp.id); setSelectedApp(null); }} 
                      className="btn btn-success text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1" 
                      style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button 
                      onClick={() => setIsRejecting(true)} 
                      className="btn btn-danger text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
                <button 
                  className="btn btn-secondary text-xs sm:text-sm py-1.5 px-4" 
                  onClick={() => setSelectedApp(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
