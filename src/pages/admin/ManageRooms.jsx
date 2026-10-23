import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { roomService } from '../../services/roomService';
import { supabase } from '../../config/supabaseClient';
import { Search, Filter, Edit, Plus, X, Trash2, Save, CheckCircle, AlertCircle, DoorOpen } from 'lucide-react';

const INITIAL_ROOM_FORM = {
  roomNumber: '',
  floor: '3',
  category: 'TYPE_3',
  capacity: 2,
  nightlyRate: 200,
  status: 'available',
  beds: 1,
  bedDescription: 'approximately 14 ft',
  bathroom: 'Attached bathroom',
  airConditioning: true
};

export default function ManageRooms() {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, available, occupied, maintenance
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState(INITIAL_ROOM_FORM);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Lock body scroll when modal is open so position never shifts
  useEffect(() => {
    if (isAddModalOpen || editingRoom) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAddModalOpen, editingRoom]);

  useEffect(() => {
    fetchRooms();

    const handleSync = () => {
      fetchRooms();
    };

    window.addEventListener('roomsChanged', handleSync);
    window.addEventListener('indicatorsChanged', handleSync);
    window.addEventListener('focus', handleSync);

    // Supabase Realtime channel for live room status updates
    const channel = supabase
      .channel('realtime_manage_rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchRooms();
      })
      .subscribe();

    const interval = setInterval(() => {
      roomService.syncRoomAvailability();
    }, 30000);

    return () => {
      window.removeEventListener('roomsChanged', handleSync);
      window.removeEventListener('indicatorsChanged', handleSync);
      window.removeEventListener('focus', handleSync);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const data = await roomService.getAllRooms();
      setRooms(data);
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Failed to load rooms from Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };


  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData(INITIAL_ROOM_FORM);
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (room) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber || '',
      floor: room.floor ? String(room.floor) : '',
      category: room.category || 'TYPE_3',
      capacity: Number(room.capacity) || 1,
      nightlyRate: Number(room.nightlyRate) || 0,
      status: room.status || 'available',
      beds: Number(room.beds) || 1,
      bedDescription: room.bedDescription || '',
      bathroom: room.bathroom || 'Attached bathroom',
      airConditioning: room.airConditioning !== undefined ? Boolean(room.airConditioning) : true
    });
    setFormError('');
  };

  // Auto-fill defaults when category changes in Add modal (convenience for admin)
  const handleCategoryChange = (newCat) => {
    let suggested = { category: newCat };
    if (!editingRoom) {
      if (newCat === 'VIP') {
        suggested = {
          ...suggested,
          capacity: 1,
          nightlyRate: 200,
          beds: 1,
          bedDescription: 'approximately 6x7 ft',
          bathroom: 'Attached bathroom',
          airConditioning: true,
          floor: formData.floor || '2'
        };
      } else if (newCat === 'TYPE_3') {
        suggested = {
          ...suggested,
          capacity: 2,
          nightlyRate: 200,
          beds: 1,
          bedDescription: 'approximately 14 ft',
          bathroom: 'Attached bathroom',
          airConditioning: true,
          floor: formData.floor || '3'
        };
      } else if (newCat === 'TYPE_4_5_6') {
        suggested = {
          ...suggested,
          capacity: 2,
          nightlyRate: 150,
          beds: 2,
          bedDescription: '4 x 7 ft',
          bathroom: 'Non-attached bathroom',
          airConditioning: true,
          floor: formData.floor || '4'
        };
      }
    }
    setFormData(prev => ({ ...prev, ...suggested }));
  };

  // Save Add Room
  const handleSaveAddRoom = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await roomService.createRoom(formData);
      setRooms(prev => [...prev, created].sort((a, b) => 
        String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
      ));
      setIsAddModalOpen(false);
      window.dispatchEvent(new Event('indicatorsChanged'));
      showFeedback('success', `Room ${created.roomNumber} added successfully to Supabase!`);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to add room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Edit Room
  const handleSaveEditRoom = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await roomService.updateRoom(editingRoom.roomNumber, formData);
      setRooms(rooms.map(r => r.roomNumber === editingRoom.roomNumber ? updated : r));
      setEditingRoom(null);
      window.dispatchEvent(new Event('indicatorsChanged'));
      showFeedback('success', `Room ${updated.roomNumber} updated successfully in Supabase!`);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to update room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Room
  const handleDeleteRoom = async () => {
    if (!editingRoom) return;
    if (window.confirm(`Are you sure you want to permanently delete Room ${editingRoom.roomNumber}? This action cannot be undone.`)) {
      setIsSubmitting(true);
      try {
        await roomService.deleteRoom(editingRoom.roomNumber);
        setRooms(rooms.filter(r => r.roomNumber !== editingRoom.roomNumber));
        setEditingRoom(null);
        window.dispatchEvent(new Event('indicatorsChanged'));
        showFeedback('success', `Room ${editingRoom.roomNumber} deleted successfully.`);
      } catch (err) {
        console.error(err);
        setFormError(err.message || 'Failed to delete room.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };


  const filteredRooms = rooms.filter(r => {
    const matchesFilter = filter === 'ALL' || r.status === filter;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || 
      String(r.roomNumber || '').toLowerCase().includes(term) ||
      String(r.floor || '').toLowerCase().includes(term) ||
      String(r.category || '').toLowerCase().includes(term) ||
      String(r.roomTypeLabel || '').toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Rooms</h1>
          <p className="text-sm text-muted">Configure room availability, rates, and specifications</p>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div 
          className="mb-4 p-3 rounded flex items-center gap-2 animate-fade-in"
          style={{
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
            color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium text-sm">{feedback.message}</span>
        </div>
      )}

      {/* Top Search & Filter Card with Add Room Option */}
      <div className="card mb-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex items-center gap-2 w-full md:max-w-md">
          <Search className="text-muted" size={20} />
          <input 
            type="text" 
            placeholder="Search Room Number..." 
            className="form-input" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Filter className="text-muted flex-shrink-0" size={20} />
            <select className="form-select w-full sm:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <button 
            type="button"
            onClick={handleOpenAddModal} 
            className="btn btn-primary flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.5rem 1rem' }}
          >
            <Plus size={18} /> Add Room
          </button>
        </div>
      </div>

      {/* Rooms Table Card */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">Room</th>
              <th className="p-3">Floor</th>
              <th className="p-3">Category</th>
              <th className="p-3">Rate</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="text-center p-8 text-muted">Loading rooms from database...</td></tr>
            ) : filteredRooms.length === 0 ? (
              <tr><td colSpan="6" className="text-center p-8 text-muted">No rooms found matching your search.</td></tr>
            ) : filteredRooms.map(room => (
              <tr key={room.roomNumber} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 font-medium text-primary text-lg">{room.roomNumber}</td>
                <td className="p-3 text-sm">{room.floor}</td>
                <td className="p-3 text-sm">
                  <span className="font-semibold">{room.roomTypeLabel || room.category}</span> <br/>
                  <span className="text-muted text-xs">Cap: {room.capacity}</span>
                </td>
                <td className="p-3 font-medium">৳{room.nightlyRate}</td>
                <td className="p-3">
                  <span className={`badge ${
                    room.status === 'available' ? 'badge-success' : 
                    room.status === 'occupied' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {room.status}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center">
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleOpenEditModal(room)}
                      title="Edit Room Details"
                    >
                      <Edit size={14} /> Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Room Modal Rendered with Portal at Viewport Center */}
      {(isAddModalOpen || editingRoom) && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAddModalOpen(false);
              setEditingRoom(null);
            }
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
            padding: '16px',
            margin: 0
          }}
        >
          <div 
            className="card animate-fade-in" 
            style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <DoorOpen className="text-primary" size={24} />
                <h2 className="text-xl font-bold">
                  {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Add New Room'}
                </h2>
              </div>
              <button 
                onClick={() => { setIsAddModalOpen(false); setEditingRoom(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded bg-danger bg-opacity-10 text-danger text-sm flex items-center gap-2 border border-danger">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={editingRoom ? handleSaveEditRoom : handleSaveAddRoom}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Room Number <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="text" 
                    className="form-input w-full"
                    placeholder="e.g. 201, 305"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Floor <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="text" 
                    className="form-input w-full"
                    placeholder="e.g. 2, 3, 4"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Category <span className="text-danger">*</span>
                  </label>
                  <select 
                    className="form-select w-full"
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="VIP">VIP (VIP Suite)</option>
                    <option value="TYPE_3">TYPE_3 (Type 3)</option>
                    <option value="TYPE_4_5_6">TYPE_4_5_6 (Type 4/5/6)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Capacity (Persons) <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    max="10"
                    className="form-input w-full"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Nightly Rate (৳) <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    step="10"
                    className="form-input w-full"
                    value={formData.nightlyRate}
                    onChange={(e) => setFormData({ ...formData, nightlyRate: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Status <span className="text-danger">*</span>
                  </label>
                  <select 
                    className="form-select w-full"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Beds Count
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    max="10"
                    className="form-input w-full"
                    value={formData.beds}
                    onChange={(e) => setFormData({ ...formData, beds: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Bathroom
                  </label>
                  <select 
                    className="form-select w-full"
                    value={formData.bathroom}
                    onChange={(e) => setFormData({ ...formData, bathroom: e.target.value })}
                  >
                    <option value="Attached bathroom">Attached bathroom</option>
                    <option value="Non-attached bathroom">Non-attached bathroom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Air Conditioning (AC)
                  </label>
                  <select 
                    className="form-select w-full"
                    value={formData.airConditioning ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, airConditioning: e.target.value === "true" })}
                  >
                    <option value="true">Yes (Air Conditioned)</option>
                    <option value="false">No (Non-AC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-1">
                    Bed Description
                  </label>
                  <input 
                    type="text" 
                    className="form-input w-full"
                    placeholder="e.g. approximately 6x7 ft"
                    value={formData.bedDescription}
                    onChange={(e) => setFormData({ ...formData, bedDescription: e.target.value })}
                  />
                </div>
              </div>

              {/* Symmetric Rectangular Action Table with 4 Cells */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                {editingRoom ? (
                  <div className="room-modal-actions-table">
                    {/* Cell 1 (Top-Left): Maintenance Status Toggle */}
                    <button 
                      type="button" 
                      onClick={() => {
                        if (editingRoom.status === 'occupied') return;
                        const nextStatus = formData.status === 'maintenance' ? 'available' : 'maintenance';
                        setFormData(prev => ({ ...prev, status: nextStatus }));
                      }}
                      disabled={isSubmitting || editingRoom.status === 'occupied'}
                      className={`action-cell action-maintenance ${formData.status === 'maintenance' ? 'is-maintenance' : ''}`}
                      title={editingRoom.status === 'occupied' ? "Cannot change status of occupied room" : "Toggle Maintenance Status"}
                    >
                      {formData.status === 'maintenance' ? (
                        <>
                          <CheckCircle size={16} />
                          <span>Set to Available</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} />
                          <span>{editingRoom.status === 'occupied' ? 'Occupied (Locked)' : 'Set to Maintenance'}</span>
                        </>
                      )}
                    </button>

                    {/* Cell 2 (Top-Right): Delete Room */}
                    <button 
                      type="button" 
                      onClick={handleDeleteRoom}
                      disabled={isSubmitting}
                      className="action-cell action-delete"
                      title="Permanently Delete Room"
                    >
                      <Trash2 size={16} />
                      <span>Delete Room</span>
                    </button>

                    {/* Cell 3 (Bottom-Left): Cancel */}
                    <button 
                      type="button" 
                      className="action-cell action-cancel"
                      onClick={() => { setIsAddModalOpen(false); setEditingRoom(null); }}
                      disabled={isSubmitting}
                      title="Cancel and close dialog"
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>

                    {/* Cell 4 (Bottom-Right): Save Changes */}
                    <button 
                      type="submit" 
                      className="action-cell action-save"
                      disabled={isSubmitting}
                      title="Save room updates"
                    >
                      <Save size={16} />
                      <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                ) : (
                  /* Add Room: Symmetric 2-cell rectangular row */
                  <div className="room-modal-actions-table add-mode">
                    <button 
                      type="button" 
                      className="action-cell action-cancel"
                      onClick={() => { setIsAddModalOpen(false); setEditingRoom(null); }}
                      disabled={isSubmitting}
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>

                    <button 
                      type="submit" 
                      className="action-cell action-save"
                      disabled={isSubmitting}
                    >
                      <Plus size={16} />
                      <span>{isSubmitting ? 'Adding...' : 'Add Room'}</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* Rectangular Action Table with 4 Symmetric Cells */
        .room-modal-actions-table {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background-color: var(--color-border);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .room-modal-actions-table.add-mode {
          grid-template-columns: 1fr 1fr;
        }

        .action-cell {
          appearance: none;
          border: none;
          outline: none;
          background-color: var(--color-surface);
          color: var(--color-text);
          padding: 0.85rem 1rem;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease, filter 0.15s ease;
          user-select: none;
          text-align: center;
        }

        .action-cell:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Cell 1: Maintenance Status Toggle */
        .action-cell.action-maintenance {
          background-color: var(--color-surface);
          color: #d97706;
        }
        .action-cell.action-maintenance:hover:not(:disabled) {
          background-color: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }
        .action-cell.action-maintenance.is-maintenance {
          color: #059669;
        }
        .action-cell.action-maintenance.is-maintenance:hover:not(:disabled) {
          background-color: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        /* Cell 2: Delete Room */
        .action-cell.action-delete {
          background-color: var(--color-surface);
          color: #dc2626;
        }
        .action-cell.action-delete:hover:not(:disabled) {
          background-color: rgba(239, 68, 68, 0.14);
          color: #b91c1c;
        }

        /* Cell 3: Cancel */
        .action-cell.action-cancel {
          background-color: var(--color-surface);
          color: var(--color-muted);
        }
        .action-cell.action-cancel:hover:not(:disabled) {
          background-color: rgba(125, 125, 125, 0.1);
          color: var(--color-text);
        }

        /* Cell 4: Save / Add */
        .action-cell.action-save {
          background-color: var(--color-primary);
          color: #ffffff;
        }
        .action-cell.action-save:hover:not(:disabled) {
          filter: brightness(1.12);
        }
        .action-cell.action-save:active:not(:disabled) {
          filter: brightness(0.95);
        }

        @media (max-width: 480px) {
          .action-cell {
            padding: 0.65rem 0.4rem;
            font-size: 0.76rem;
            gap: 4px;
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
}

