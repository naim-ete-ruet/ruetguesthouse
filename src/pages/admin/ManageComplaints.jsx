import { useState, useEffect } from 'react';
import { complaintService } from '../../services/complaintService';
import { Search, Filter, MessageSquare, CheckCircle, XCircle } from 'lucide-react';

export default function ManageComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

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
    if (filter === 'ALL') return true;
    return c.status === filter;
  });

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">Manage Complaints</h1>

      <div className="card mb-6 flex justify-between items-center">
        <div className="flex items-center gap-2 w-full max-w-md">
          <Search className="text-muted" size={20} />
          <input type="text" placeholder="Search by ID or Subject..." className="form-input" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-muted" size={20} />
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)}>
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
                    {complaint.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-sm">{new Date(complaint.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-center">
                  <button 
                    onClick={() => setSelectedComplaint(complaint)}
                    className="btn btn-secondary" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <MessageSquare size={14} className="inline mr-1" /> View / Reply
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedComplaint && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Complaint: {selectedComplaint.id}
              </h2>
              <button 
                onClick={() => setSelectedComplaint(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-lg">{selectedComplaint.subject}</span>
                <span className={`badge ${selectedComplaint.status === 'RESOLVED' ? 'badge-success' : selectedComplaint.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-danger'}`}>
                  {selectedComplaint.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-sm text-muted mb-3 flex gap-4 border-bottom pb-3">
                <span>By: {selectedComplaint.userName} ({selectedComplaint.userRole})</span>
                <span>Room: {selectedComplaint.roomNumber}</span>
                <span>Date: {new Date(selectedComplaint.createdAt).toLocaleString()}</span>
              </div>
              
              <div className="p-4 bg-gray-50 rounded mb-4" style={{ backgroundColor: 'var(--color-background)' }}>
                <strong className="block mb-2 text-sm text-muted uppercase">Description</strong>
                <p className="text-sm whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>

              {selectedComplaint.adminReply && (
                <div className="p-4 rounded mb-4" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--color-success)' }}>
                  <strong className="block mb-2 text-sm text-success uppercase">Admin Reply</strong>
                  <p className="text-sm whitespace-pre-wrap">{selectedComplaint.adminReply}</p>
                </div>
              )}
            </div>

            {selectedComplaint.status !== 'RESOLVED' && (
              <form onSubmit={handleReplySubmit} className="mt-4 pt-4 border-top" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="form-group mb-3">
                  <label className="form-label">Reply & Resolve</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Enter your response to the guest..."
                    required
                  ></textarea>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleUpdateStatus(selectedComplaint.id, 'IN_PROGRESS')} className="btn btn-secondary flex-1">
                    Mark In Progress
                  </button>
                  <button type="submit" disabled={isReplying} className="btn btn-success flex-1" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>
                    <CheckCircle size={16} className="inline mr-1" /> {isReplying ? 'Resolving...' : 'Resolve Complaint'}
                  </button>
                </div>
              </form>
            )}
            
            {selectedComplaint.status === 'RESOLVED' && (
              <button onClick={() => setSelectedComplaint(null)} className="btn btn-secondary w-full mt-4">Close</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
