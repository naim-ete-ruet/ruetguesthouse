import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { API_BASE_URL } from '../../config/api';
import { Eye, Check, X, Search, Filter, XCircle } from 'lucide-react';

export default function TeacherManageApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Extract department from teacher's email e.g. teacher@cse.ruet.ac.bd -> cse
  const teacherDepartment = user?.department || user?.email?.split('@')[1]?.split('.')[0]?.toLowerCase();

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const allBookings = await bookingService.getAllBookings();
      
      // Filter applications that are assigned to this teacher
      const teacherApps = allBookings.filter(b => {
        // Only show bookings that explicitly selected this teacher for approval
        if (b.approvingTeacherId !== user.id) return false;
        // Don't show the teacher's own applications in their approval list
        if (b.userId === user.id) return false;
        return true;
      });
      
      setApplications(teacherApps);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

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
          fetch(`${API_BASE_URL}/api/email/student-payment-notice`, {
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

  const filteredApps = applications.filter(app => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return app.approvalStatus === 'PENDING_TEACHER_APPROVAL';
    if (filter === 'APPROVED') return ['PENDING_PAYMENT', 'PENDING_ADMIN_APPROVAL', 'APPROVED'].includes(app.approvalStatus);
    if (filter === 'REJECTED') return app.approvalStatus === 'REJECTED_BY_TEACHER';
    return true;
  });

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Applications for Review</h1>
          <p className="text-muted">Manage applications assigned to you</p>
        </div>
      </div>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input type="text" placeholder="Search applications..." className="form-input w-full" />
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

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">App ID</th>
              <th className="p-3">Student</th>
              <th className="p-3">Room</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="text-center p-4">Loading applications...</td></tr>
            ) : filteredApps.length === 0 ? (
              <tr><td colSpan="6" className="text-center p-4 text-muted">No applications found assigned to you.</td></tr>
            ) : filteredApps.map(app => (
              <tr key={app.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 font-medium text-primary">{app.id}</td>
                <td className="p-3 text-sm">
                  <div className="font-bold">{app.applicantName}</div>
                  <div className="text-muted text-xs">{app.designation || 'Student'} • {app.department?.toUpperCase()}</div>
                </td>
                <td className="p-3 text-sm">
                  {app.requestedRoomType.replace(/_/g, ' ')}
                </td>
                <td className="p-3 text-sm">
                  {app.checkInDate} to {app.checkOutDate}
                </td>
                <td className="p-3">
                  <span className={`badge ${
                    ['PENDING_PAYMENT', 'PENDING_ADMIN_APPROVAL', 'APPROVED'].includes(app.approvalStatus) ? 'badge-success' : 
                    app.approvalStatus === 'PENDING_TEACHER_APPROVAL' ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {app.approvalStatus.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => setSelectedApp(app)}
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      <Eye size={14} /> Review
                    </button>
                    {app.approvalStatus === 'PENDING_TEACHER_APPROVAL' && (
                      <button 
                        onClick={() => handleApprove(app.id)} 
                        className="btn btn-success" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--color-success)', color: 'white' }}
                      >
                        <Check size={14} /> Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {selectedApp && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold">Review Application: {selectedApp.id}</h2>
              <button 
                onClick={() => { setSelectedApp(null); setIsRejecting(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                <div><strong className="text-muted block text-xs uppercase mb-1">Applicant Name</strong> {selectedApp.applicantName}</div>
                <div><strong className="text-muted block text-xs uppercase mb-1">Email / ID</strong> {selectedApp.mobileNumber}</div>
                <div><strong className="text-muted block text-xs uppercase mb-1">Designation</strong> {selectedApp.designation || 'Student'}</div>
                <div><strong className="text-muted block text-xs uppercase mb-1">Department</strong> {selectedApp.department?.toUpperCase()}</div>
                <div className="col-span-2"><strong className="text-muted block text-xs uppercase mb-1">Stay Purpose</strong> {selectedApp.stayPurpose}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                <div><strong className="text-muted block text-xs uppercase mb-1">Check-in</strong> {selectedApp.checkInDate} at {selectedApp.checkInTime}</div>
                <div><strong className="text-muted block text-xs uppercase mb-1">Check-out</strong> {selectedApp.checkOutDate} at {selectedApp.checkOutTime}</div>
                <div><strong className="text-muted block text-xs uppercase mb-1">Room Type</strong> {selectedApp.requestedRoomType.replace(/_/g, ' ')}</div>
                <div><strong className="text-muted block text-xs uppercase mb-1">Total Days</strong> {selectedApp.totalDays}</div>
              </div>

              {selectedApp.rejectionReason && (
                <div className="p-4 rounded border border-danger bg-danger bg-opacity-10">
                  <strong className="text-danger block text-sm mb-1">Rejection Reason:</strong>
                  <p className="text-sm">{selectedApp.rejectionReason}</p>
                </div>
              )}

              {isRejecting && selectedApp.approvalStatus === 'PENDING_TEACHER_APPROVAL' && (
                <div className="mt-4 p-4 rounded border" style={{ borderColor: 'var(--color-warning)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                  <label className="block text-sm font-medium mb-2">Reason for rejection:</label>
                  <textarea 
                    className="form-input w-full mb-3" 
                    rows="3" 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejecting this application..."
                  ></textarea>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsRejecting(false)} className="btn btn-secondary text-sm py-1 px-3">Cancel</button>
                    <button onClick={() => handleReject(selectedApp.id)} className="btn btn-danger text-sm py-1 px-3">Confirm Reject</button>
                  </div>
                </div>
              )}
            </div>

            {!isRejecting && (
              <div className="mt-6 flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                {selectedApp.approvalStatus === 'PENDING_TEACHER_APPROVAL' && (
                  <>
                    <button onClick={() => { handleApprove(selectedApp.id); setSelectedApp(null); }} className="btn btn-success" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>Approve</button>
                    <button onClick={() => setIsRejecting(true)} className="btn btn-danger">Reject</button>
                  </>
                )}
                <button className="btn btn-secondary" onClick={() => setSelectedApp(null)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
