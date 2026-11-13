import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { complaintService } from '../../services/complaintService';
import { Search, Filter, MessageSquare, SlidersHorizontal, CheckCircle, XCircle, X } from 'lucide-react';

export default function ManageComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Lock body scroll when modal is open so position never shifts
  useEffect(() => {
    if (selectedComplaint) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedComplaint]);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const data = await complaintService.getAllComplaints();
      setComplaints(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, reply = '') => {
    try {
      const updated = await complaintService.updateComplaintStatus(id, newStatus, reply);
      setComplaints(complaints.map(c => c.id === id ? updated : c));
      if (selectedComplaint && selectedComplaint.id === id) {
        setSelectedComplaint(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    setIsReplying(true);
    await handleUpdateStatus(selectedComplaint.id, 'RESOLVED', replyText);
    setReplyText('');
    setIsReplying(false);
    setSelectedComplaint(null);
  };

  const filteredComplaints = complaints.filter(c => {
    let matchesFilter = true;
    if (filter !== 'ALL') {
      matchesFilter = (c.status || '').toUpperCase() === filter;
    }
    if (!matchesFilter) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (c.id || '').toLowerCase().includes(q) ||
      (c.subject || '').toLowerCase().includes(q) ||
      (c.userName || '').toLowerCase().includes(q) ||
      (c.bookingId || '').toLowerCase().includes(q) ||
      (c.roomNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">Manage Complaints</h1>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input 
            type="text" 
            placeholder="Search by ID, Guest, Subject, or Room..." 
            className="form-input w-full" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="text-muted flex-shrink-0" size={20} />
          <select className="form-select w-full sm:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Complaints</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">ID</th>
              <th className="p-3">Guest</th>
              <th className="p-3">Room / Booking</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="text-center p-4">Loading...</td></tr>
            ) : filteredComplaints.map(complaint => (
              <tr key={complaint.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 font-medium text-primary">{complaint.id}</td>
                <td className="p-3 text-sm">
                  <div className="font-medium">{complaint.userName}</div>
                  <div className="text-xs text-muted capitalize">{complaint.userRole}</div>
                </td>
                <td className="p-3 text-sm">
                  <div>Room {complaint.roomNumber}</div>
                  <div className="text-xs text-muted">{complaint.bookingId}</div>
                </td>
                <td className="p-3 text-sm font-medium">{complaint.subject}</td>
                <td className="p-3">
                  <span className={`badge ${complaint.status === 'RESOLVED' ? 'badge-success' : complaint.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-danger'}`}>
                    {(complaint.status || 'PENDING').replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-sm">{new Date(complaint.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-center">
                  <button 
                    onClick={() => setSelectedComplaint(complaint)}
                    className="btn btn-option hover-scale" 
                    title="View complaint options and reply"
                  >
                    <SlidersHorizontal size={14} /> Option
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedComplaint && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
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
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '1.25rem'
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold">Complaint Details: <span className="text-primary">{selectedComplaint.id}</span></h2>
                <span className={`badge ${selectedComplaint.status === 'RESOLVED' ? 'badge-success' : selectedComplaint.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-danger'}`}>
                  {(selectedComplaint.status || 'PENDING').replace(/_/g, ' ')}
                </span>
              </div>
              <button 
                onClick={() => setSelectedComplaint(null)}
                className="p-1 rounded-full hover:bg-gray-100 transition"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* 2 Balanced Side-by-Side Cards (Stack on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs sm:text-sm">
              {/* Card 1: Complainant & Room */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Complainant Details</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div className="col-span-2"><span className="text-muted block text-xs">Name:</span> <strong className="text-text">{selectedComplaint.userName}</strong></div>
                  <div><span className="text-muted block text-xs">Role:</span> <span className="text-text capitalize">{selectedComplaint.userRole}</span></div>
                  <div>
                    <span className="text-muted block text-xs">Room No:</span>
                    <strong className="text-primary font-bold">
                      {selectedComplaint.roomNumber 
                        ? (String(selectedComplaint.roomNumber).toLowerCase().startsWith('room') ? selectedComplaint.roomNumber : `Room ${selectedComplaint.roomNumber}`)
                        : 'N/A'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Complaint Info */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Complaint Information</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                  <div className="col-span-2"><span className="text-muted block text-xs">Subject:</span> <strong className="text-text">{selectedComplaint.subject}</strong></div>
                  <div><span className="text-muted block text-xs">Date:</span> <span className="text-text">{new Date(selectedComplaint.createdAt).toLocaleDateString()}</span></div>
                  <div><span className="text-muted block text-xs">Time:</span> <span className="text-text">{new Date(selectedComplaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-3 rounded-lg text-xs sm:text-sm border mb-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              <div className="text-xs uppercase font-bold text-muted mb-1.5 tracking-wider">Description</div>
              <p className="text-text whitespace-pre-wrap leading-relaxed">{selectedComplaint.description}</p>
            </div>

            {/* Admin Reply */}
            {selectedComplaint.adminReply && (
              <div className="p-3 rounded-lg text-xs sm:text-sm border mb-3" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'var(--color-success)' }}>
                <div className="text-xs uppercase font-bold text-success mb-1.5 tracking-wider">Admin Reply</div>
                <p className="text-text whitespace-pre-wrap leading-relaxed">{selectedComplaint.adminReply}</p>
              </div>
            )}

            {/* Action Form or Footer */}
            {selectedComplaint.status !== 'RESOLVED' ? (
              <form onSubmit={handleReplySubmit} className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase text-muted mb-1.5">Reply & Resolve</label>
                  <textarea 
                    className="form-input text-xs sm:text-sm w-full" 
                    rows="2" 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Enter your response to the guest..."
                    required
                  ></textarea>
                </div>
                <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => handleUpdateStatus(selectedComplaint.id, 'IN_PROGRESS')} 
                    className="btn btn-secondary text-xs sm:text-sm py-1.5 px-3"
                  >
                    Mark In Progress
                  </button>
                  <button 
                    type="submit" 
                    disabled={isReplying} 
                    className="btn btn-success text-xs sm:text-sm py-1.5 px-3 flex items-center justify-center gap-1" 
                    style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                  >
                    <CheckCircle size={14} /> {isReplying ? 'Resolving...' : 'Resolve Complaint'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSelectedComplaint(null)} 
                    className="btn btn-secondary text-xs sm:text-sm py-1.5 px-4"
                  >
                    Close
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                <button 
                  onClick={() => setSelectedComplaint(null)} 
                  className="btn btn-secondary text-xs sm:text-sm py-1.5 px-4"
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
