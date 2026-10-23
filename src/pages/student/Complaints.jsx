import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { complaintService } from '../../services/complaintService';
import { bookingService } from '../../services/bookingService';
import { AlertCircle, Plus, CheckCircle, Clock } from 'lucide-react';

export default function Complaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    bookingId: '',
    roomNumber: '',
    subject: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [complaintsData, bookingsData] = await Promise.all([
        complaintService.getComplaintsByUser(user.id),
        bookingService.getBookingsByUser(user.id)
      ]);
      setComplaints(complaintsData);
      
      // Filter only approved/active bookings
      setUserBookings(bookingsData.filter(b => b.approvalStatus === 'APPROVED' || b.bookingStatus === 'ACTIVE'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingChange = (e) => {
    const bId = e.target.value;
    const booking = userBookings.find(b => b.id === bId);
    setFormData({
      ...formData,
      bookingId: bId,
      roomNumber: booking?.assignedRoom || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await complaintService.submitComplaint({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        ...formData
      });
      setFormData({ bookingId: '', roomNumber: '', subject: '', description: '' });
      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">My Complaints</h1>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={18} /> {showForm ? 'Cancel' : 'New Complaint'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-8 animate-fade-in">
          <h2 className="text-lg font-bold mb-4 border-bottom pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            Submit a New Complaint
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-group mb-0">
                <label className="form-label">Related Booking</label>
                <select 
                  className="form-select" 
                  value={formData.bookingId} 
                  onChange={handleBookingChange}
                  required
                >
                  <option value="">Select a booking...</option>
                  {userBookings.map(b => (
                    <option key={b.id} value={b.id}>{b.id} - Room {b.assignedRoom || 'Not Assigned'}</option>
                  ))}
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Room Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.roomNumber} 
                  onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                  placeholder="e.g. 101"
                  required
                />
              </div>
            </div>
            
            <div className="form-group mb-4">
              <label className="form-label">Subject</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.subject} 
                onChange={e => setFormData({...formData, subject: e.target.value})}
                placeholder="Brief summary of the issue"
                required
              />
            </div>
            
            <div className="form-group mb-4">
              <label className="form-label">Description</label>
              <textarea 
                className="form-input" 
                rows="4"
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Provide detailed information about your complaint..."
                required
              ></textarea>
            </div>
            
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading && !showForm ? (
        <div className="text-center py-8">Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="card text-center py-8">
          <AlertCircle size={48} className="mx-auto text-muted mb-4" />
          <h3 className="text-lg font-medium text-muted">No complaints found</h3>
          <p className="text-sm text-muted mt-1">You haven't submitted any complaints yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {complaints.map(complaint => (
            <div key={complaint.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{complaint.subject}</span>
                    <span className={`badge ${complaint.status === 'RESOLVED' ? 'badge-success' : complaint.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-danger'}`}>
                      {complaint.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-muted flex gap-4">
                    <span>ID: {complaint.id}</span>
                    <span>Booking: {complaint.bookingId}</span>
                    <span>Room: {complaint.roomNumber}</span>
                    <span>Date: {new Date(complaint.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 p-3 rounded bg-gray-50 text-sm" style={{ backgroundColor: 'var(--color-background)' }}>
                <p>{complaint.description}</p>
              </div>
              
              {complaint.adminReply && (
                <div className="mt-3 p-3 rounded text-sm" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--color-success)' }}>
                  <strong className="text-success block mb-1">Admin Reply:</strong>
                  <p>{complaint.adminReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
