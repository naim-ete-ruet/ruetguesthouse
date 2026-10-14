import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roomService } from '../../services/roomService';
import { Search, Info, Calendar as CalendarIcon } from 'lucide-react';

export default function RoomAvailability() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState('ALL');
  
  const today = new Date().toISOString().split('T')[0];
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 10);
  const maxDateStr = maxD.toISOString().split('T')[0];
  
  const [bookingDate, setBookingDate] = useState(today);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await roomService.getAllRooms();
        setRooms(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const filteredRooms = rooms.filter(room => {
    if (filter === 'ALL') return true;
    if (filter === 'AVAILABLE') return room.status === 'available';
    return room.category === filter;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'available': return <span className="badge badge-success">Available</span>;
      case 'occupied': return <span className="badge badge-danger">Occupied</span>;
      case 'maintenance': return <span className="badge badge-warning">Maintenance</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="container">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Book a Room</h1>
        <div className="text-sm px-4 py-2 rounded font-medium flex items-center gap-2" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <Info size={16} className="flex-shrink-0" />
          <span><strong>Note:</strong> Select a room to apply. You can book for a date up to 10 days in advance. Guests cannot select VIP rooms.</span>
        </div>
      </div>

      <div className="card flex flex-col md:flex-row justify-between items-center gap-4" style={{ marginBottom: '2.5rem' }}>
        <div className="flex items-center gap-2">
          <Search size={20} className="text-muted" />
          <span className="font-medium">Filter Rooms:</span>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
          <div className="flex items-center gap-2 w-full md:w-auto p-2 rounded border transition-colors shadow-sm" style={{ 
            borderColor: 'var(--color-success)', 
            backgroundColor: 'rgba(34, 197, 94, 0.1)', // Light green highlight
            color: '#15803d' // Darker green text for contrast
          }}>
            <CalendarIcon size={18} />
            <span className="text-sm font-bold">Date for Booking:</span>
            <input 
              type="date" 
              className="form-input text-sm p-1" 
              style={{ width: 'auto', border: '1px solid var(--color-success)', outline: 'none' }}
              value={bookingDate} 
              onChange={e => setBookingDate(e.target.value)}
              min={today}
              max={maxDateStr}
            />
          </div>

          <select className="form-select w-full md:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Rooms</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="VIP">VIP Rooms</option>
            <option value="TYPE_3">Type 3</option>
            <option value="TYPE_4_5_6">Type 4/5/6</option>
          </select>
        </div>
      </div>


      {isLoading ? (
        <div className="text-center py-8">Loading rooms...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map(room => (
            <div key={room.roomNumber} className="card hover:border-primary transition" style={{ borderColor: room.status === 'available' ? 'var(--color-success)' : '' }}>
              <div className="flex justify-between items-start mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <h3 className="text-xl font-bold">Room {room.roomNumber}</h3>
                  <p className="text-sm text-muted">Floor {room.floor}</p>
                </div>
                {getStatusBadge(room.status)}
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
                <div className="text-muted">Category:</div>
                <div className="font-medium text-right">{room.roomTypeLabel}</div>
                
                <div className="text-muted">Capacity:</div>
                <div className="font-medium text-right">{room.capacity} Persons</div>
                
                <div className="text-muted">Beds:</div>
                <div className="font-medium text-right">{room.beds} ({room.bedDescription})</div>
                
                <div className="text-muted">Bathroom:</div>
                <div className="font-medium text-right">{room.bathroom}</div>
                
                <div className="text-muted">AC:</div>
                <div className="font-medium text-right">{room.airConditioning ? 'Yes' : 'No'}</div>
              </div>
              
              <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="font-bold text-lg text-primary">
                  {`৳${room.nightlyRate}/night`}
                </div>
                
                {room.status === 'available' ? (
                   (room.category === 'VIP' && user.role !== 'teacher' && user.role !== 'admin') ? (
                     <span className="text-xs text-warning bg-warning bg-opacity-10 px-2 py-1 rounded">Teachers/Admin Only</span>
                   ) : (
                     <button 
                       className="btn btn-primary" 
                       style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                       onClick={() => navigate(user.role === 'teacher' ? '/teacher/booking' : '/student/booking', { state: { selectedRoom: room.roomNumber, roomType: room.category, bookingDate }})}
                     >
                       Select Room
                     </button>
                   )
                ) : (
                  <span className="text-sm text-muted">Not Available</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
