import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { supabase } from '../../config/supabaseClient';
import { Info, Calendar, ArrowRight, Lock, Check } from 'lucide-react';

export default function RoomAvailability() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const isDark = theme === 'dark';

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date selection
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 10);
  const maxDateStr = maxD.toISOString().split('T')[0];

  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);

  // Active Floor Selection
  const [selectedFloor, setSelectedFloor] = useState('2');

  // Selected Room
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(null);

  const fetchData = async () => {
    try {
      const [roomsData, bookingsData] = await Promise.all([
        roomService.getAllRooms(),
        bookingService.getAllBookings().catch(() => [])
      ]);
      setRooms(roomsData || []);
      setBookings(bookingsData || []);
    } catch (err) {
      console.error("Failed to load rooms or bookings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 1. Listen for local app events when admin modifies rooms
    const handleSync = () => {
      fetchData();
    };

    window.addEventListener('roomsChanged', handleSync);
    window.addEventListener('indicatorsChanged', handleSync);
    window.addEventListener('focus', handleSync);

    // 2. Realtime listener for cross-tab and cross-device synchronization via Supabase
    const channel = supabase
      .channel('realtime_rooms_sync_booking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      window.removeEventListener('roomsChanged', handleSync);
      window.removeEventListener('indicatorsChanged', handleSync);
      window.removeEventListener('focus', handleSync);
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute active status for each room based on date and bookings
  const roomStatusMap = useMemo(() => {
    const map = {};
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    rooms.forEach(room => {
      map[room.roomNumber] = room.status; // 'available', 'occupied', 'maintenance'
    });

    bookings.forEach(b => {
      if (b.assignedRoom && b.bookingStatus !== 'CANCELLED' && b.approvalStatus !== 'CANCELLED' && b.approvalStatus !== 'REJECTED') {
        const bIn = new Date(b.checkInDate);
        const bOut = new Date(b.checkOutDate || b.checkInDate);
        const overlaps = (checkIn < bOut) && (checkOut > bIn);
        if (overlaps) {
          if (b.approvalStatus === 'APPROVED' || b.bookingStatus === 'CONFIRMED') {
            map[b.assignedRoom] = 'booked';
          } else if (b.approvalStatus === 'PENDING_TEACHER_APPROVAL' || b.approvalStatus === 'PENDING_ADMIN_APPROVAL') {
            map[b.assignedRoom] = 'in-progress';
          }
        }
      }
    });

    return map;
  }, [rooms, bookings, checkInDate, checkOutDate]);

  // Group rooms by floor
  const floorGroups = useMemo(() => {
    const groups = {};
    rooms.forEach(room => {
      const fl = String(room.floor || '1');
      if (!groups[fl]) {
        groups[fl] = [];
      }
      groups[fl].push(room);
    });

    Object.keys(groups).forEach(fl => {
      groups[fl].sort((a, b) => {
        const numA = parseInt(a.roomNumber.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.roomNumber.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
    });

    return groups;
  }, [rooms]);

  const availableFloors = useMemo(() => {
    return Object.keys(floorGroups).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a).localeCompare(String(b));
    });
  }, [floorGroups]);

  // Synchronize selected floor when admin adds a new floor or removes existing floors
  useEffect(() => {
    if (availableFloors.length > 0 && !availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0]);
    }
  }, [availableFloors, selectedFloor]);

  // Automatically clear selection if admin deletes the selected room
  useEffect(() => {
    if (selectedRoomNumber && !rooms.some(r => r.roomNumber === selectedRoomNumber)) {
      setSelectedRoomNumber(null);
    }
  }, [rooms, selectedRoomNumber]);

  // Calculate stay duration in nights
  const totalNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const diffTime = new Date(checkOutDate) - new Date(checkInDate);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  }, [checkInDate, checkOutDate]);

  const selectedRoomObj = useMemo(() => {
    if (!selectedRoomNumber) return null;
    return rooms.find(r => r.roomNumber === selectedRoomNumber) || null;
  }, [selectedRoomNumber, rooms]);

  const totalFare = useMemo(() => {
    if (!selectedRoomObj) return 0;
    return (selectedRoomObj.nightlyRate || 0) * totalNights;
  }, [selectedRoomObj, totalNights]);

  const getFloorTitle = (fl, roomsOnFloor = []) => {
    let label = `Floor ${fl}`;
    if (String(fl).toLowerCase().includes('ground')) {
      label = 'Ground Floor';
    }

    const cats = Array.from(new Set(roomsOnFloor.map(r => r.category).filter(Boolean)));
    if (cats.length === 1) {
      const cat = cats[0];
      if (cat === 'VIP') label += ' (VIP)';
      else if (cat === 'TYPE_3') label += ' (Type 3)';
      else if (cat === 'TYPE_4_5_6') label += ' (Type 4/5/6)';
      else label += ` (${cat.replace(/_/g, ' ')})`;
    } else if (cats.length > 1) {
      label += ` (${cats.map(c => c === 'TYPE_4_5_6' ? 'Type 4/5/6' : c === 'TYPE_3' ? 'Type 3' : c).join(' / ')})`;
    }
    return label;
  };

  const isRoomRestricted = (room) => {
    if (!room) return false;
    return room.category === 'VIP' && user?.role !== 'teacher' && user?.role !== 'admin';
  };

  const handleRoomClick = (room) => {
    if (isRoomRestricted(room)) return;
    const status = roomStatusMap[room.roomNumber];
    if (status === 'booked' || status === 'occupied' || status === 'maintenance') return;

    if (selectedRoomNumber === room.roomNumber) {
      setSelectedRoomNumber(null);
    } else {
      setSelectedRoomNumber(room.roomNumber);
      setSelectedFloor(String(room.floor || '1'));
    }
  };

  const handleContinueBooking = () => {
    if (!selectedRoomObj) return;
    const targetRoute = user?.role === 'teacher' ? '/teacher/booking' : '/student/booking';
    navigate(targetRoute, {
      state: {
        selectedRoom: selectedRoomObj.roomNumber,
        roomType: selectedRoomObj.category,
        bookingDate: checkInDate,
        checkOutDate: checkOutDate,
        totalDays: totalNights,
        floor: selectedRoomObj.floor
      }
    });
  };

  const handleSelectFloor = (fl) => {
    setSelectedFloor(fl);
  };

  const currentFloorRooms = floorGroups[selectedFloor] || [];

  return (
    <div className="container" style={{ maxWidth: '1140px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
            Book a Room
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            RUET Campus Guest House • Railway Seat Allocation Style Room Booking
          </p>
        </div>

        <div 
          style={{ 
            fontSize: '0.85rem', 
            padding: '0.5rem 0.85rem', 
            borderRadius: 'var(--radius-md)', 
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)', 
            color: isDark ? '#60a5fa' : 'var(--color-primary)', 
            border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Info size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Note:</strong> Select a floor card to view rooms. Click on an available room seat to reserve. VIP rooms are reserved for Teachers.
          </span>
        </div>
      </div>

      {/* Date Filter Card */}
      <div 
        className="card"
        style={{ 
          padding: '1rem 1.25rem', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '1rem',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
          <Calendar size={18} style={{ color: isDark ? '#34d399' : '#006442' }} />
          <span>Stay Duration:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500 }}>Check-In:</label>
            <input 
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.85rem', borderColor: isDark ? '#10b981' : '#10b981' }}
              value={checkInDate}
              min={today}
              max={maxDateStr}
              onChange={(e) => {
                const newIn = e.target.value;
                setCheckInDate(newIn);
                if (new Date(checkOutDate) <= new Date(newIn)) {
                  const nextDay = new Date(new Date(newIn).getTime() + 86400000).toISOString().split('T')[0];
                  setCheckOutDate(nextDay);
                }
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500 }}>Check-Out:</label>
            <input 
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.85rem', borderColor: isDark ? '#10b981' : '#10b981' }}
              value={checkOutDate}
              min={checkInDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
            />
          </div>

          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: 700, 
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)', 
            color: isDark ? '#34d399' : '#10b981', 
            padding: '0.4rem 0.8rem', 
            borderRadius: 'var(--radius-full)',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            {totalNights} {totalNights === 1 ? 'Night' : 'Nights'}
          </div>
        </div>
      </div>

      {/* TOP CARDS: Floors & Prices (Railway Class Style) */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div 
          style={{ 
            display: 'flex', 
            gap: '12px', 
            overflowX: 'auto', 
            paddingBottom: '12px',
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {availableFloors.map(fl => {
            const floorRooms = floorGroups[fl] || [];
            const isSelected = selectedFloor === fl;
            const floorRate = floorRooms[0]?.nightlyRate || 200;
            const floorTitle = getFloorTitle(fl, floorRooms);

            const availableCount = floorRooms.filter(r => {
              if (isRoomRestricted(r)) return false;
              const s = roomStatusMap[r.roomNumber];
              return s !== 'booked' && s !== 'occupied' && s !== 'maintenance';
            }).length;

            return (
              <div 
                key={fl}
                onClick={() => handleSelectFloor(fl)}
                style={{
                  position: 'relative',
                  flex: '1 0 180px',
                  maxWidth: '260px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: isSelected 
                    ? (isDark ? '2px solid #10b981' : '2px solid #006442') 
                    : '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  boxShadow: isSelected 
                    ? (isDark ? '0 0 18px rgba(16, 185, 129, 0.25)' : '0 8px 16px rgba(0, 100, 66, 0.2)') 
                    : 'var(--shadow-sm)',
                  userSelect: 'none',
                  overflow: 'visible'
                }}
              >
                {/* Top Half of Card */}
                <div 
                  style={{
                    padding: '12px 14px',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px',
                    backgroundColor: isSelected 
                      ? (isDark ? '#064e3b' : '#006442') 
                      : 'var(--color-surface)',
                    color: isSelected ? '#ffffff' : 'var(--color-text)',
                    borderBottom: isSelected 
                      ? '1px solid rgba(255,255,255,0.2)' 
                      : '1px solid var(--color-border)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {floorTitle}
                  </div>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 800, 
                    color: isSelected 
                      ? (isDark ? '#34d399' : '#ffffff') 
                      : (isDark ? '#34d399' : '#006442') 
                  }}>
                    ৳{floorRate}
                  </div>
                  <div style={{ 
                    fontSize: '0.725rem', 
                    color: isSelected 
                      ? '#d1fae5' 
                      : 'var(--color-muted)', 
                    marginTop: '2px' 
                  }}>
                    Including Amenities • Per Night
                  </div>
                </div>

                {/* Bottom Half of Card */}
                <div 
                  style={{
                    padding: '12px 14px',
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px',
                    backgroundColor: isSelected 
                      ? (isDark ? 'rgba(5, 150, 105, 0.15)' : 'rgba(0, 100, 66, 0.08)') 
                      : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)')
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text)', fontWeight: 500, lineHeight: 1.2 }}>
                    Available Rooms
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '4px' }}>
                    (Online)
                  </div>
                  <div style={{ 
                    fontSize: '1.35rem', 
                    fontWeight: 800, 
                    marginBottom: '10px',
                    color: availableCount > 0 ? '#10b981' : '#ef4444'
                  }}>
                    {availableCount > 0 ? availableCount : '0'}
                  </div>

                  <button
                    style={{
                      width: '100%',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-full)',
                      color: '#ffffff',
                      backgroundColor: isDark ? '#059669' : '#006442',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s ease',
                      boxShadow: isDark ? '0 2px 6px rgba(5,150,105,0.4)' : '0 2px 4px rgba(0,100,66,0.3)'
                    }}
                  >
                    {isSelected ? 'SELECTED' : 'BOOK NOW'}
                  </button>
                </div>

                {/* Railway Downward Notch for Selected Card */}
                {isSelected && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '-10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '10px solid transparent',
                      borderRight: '10px solid transparent',
                      borderTop: isDark ? '10px solid #064e3b' : '10px solid #006442',
                      zIndex: 10
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Instruction Heading (Matches Reference Image) */}
      <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
          <span style={{ color: isDark ? '#34d399' : '#006442' }}>Choose your room(s)**</span>{' '}
          <span style={{ color: 'var(--color-text)' }}>Maximum 1 room can be booked at a time.</span>
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '4px' }}>
          Click on an available room seat to select or deselect. Room details and tariff will appear on the right.
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '1.5rem', 
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}
      >
        
        {/* LEFT COLUMN: Railway Coach Seat Grid */}
        <div 
          className="card"
          style={{ 
            flex: '1 1 500px', 
            minWidth: 0,
            maxWidth: '100%',
            borderRadius: '16px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)'
          }}
        >
          {/* Floor Dropdown Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
              Select Floor
            </label>
            <select
              value={selectedFloor}
              onChange={(e) => handleSelectFloor(e.target.value)}
              className="form-select"
              style={{ fontWeight: 600, fontSize: '0.9rem', padding: '0.65rem 0.85rem' }}
            >
              {availableFloors.map(fl => {
                const floorRooms = floorGroups[fl] || [];
                return (
                  <option key={fl} value={fl}>
                    {getFloorTitle(fl, floorRooms)} — {floorRooms.length} Room(s)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Legend Bar (High-Contrast for Both Themes) */}
          <div 
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              gap: '16px', 
              padding: '10px 14px', 
              marginBottom: '1.5rem', 
              borderRadius: '10px', 
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)', 
              border: '1px solid var(--color-border)', 
              fontSize: '0.8rem' 
            }}
          >
            {/* Available */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '4px', 
                border: isDark ? '1.5px solid #64748b' : '1.5px solid #94a3b8', 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--color-surface)', 
                display: 'inline-block' 
              }}></span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>Available</span>
            </div>

            {/* Selected (High Contrast Vibrant Blue) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '4px', 
                backgroundColor: isDark ? '#2563eb' : '#0f2942', 
                border: isDark ? '1.5px solid #60a5fa' : '1.5px solid #0f2942', 
                boxShadow: isDark ? '0 0 8px rgba(59, 130, 246, 0.7)' : 'none',
                display: 'inline-block' 
              }}></span>
              <span style={{ color: isDark ? '#60a5fa' : 'var(--color-text)', fontWeight: 700 }}>Selected</span>
            </div>

            {/* In Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '4px', 
                backgroundColor: '#16a34a', 
                border: '1.5px solid #22c55e',
                display: 'inline-block' 
              }}></span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>In Progress</span>
            </div>

            {/* Booked */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '4px', 
                backgroundColor: '#c27803', 
                border: '1.5px solid #f59e0b',
                display: 'inline-block' 
              }}></span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>Booked</span>
            </div>

            {/* Teachers Only */}
            {user?.role !== 'teacher' && user?.role !== 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '4px', 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', 
                  border: '1px dashed #94a3b8', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Lock size={10} style={{ color: 'var(--color-muted)' }} />
                </span>
                <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}>Teachers Only</span>
              </div>
            )}
          </div>

          {/* Railway Coach Arrangement (Pill Shaped Seats with Gaps) */}
          <div 
            style={{ 
              padding: '1.25rem', 
              borderRadius: '14px', 
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)', 
              border: isDark ? '2px dashed #334155' : '2px dashed var(--color-border)' 
            }}
          >
            {/* Coach Label */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              color: 'var(--color-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px', 
              marginBottom: '1.25rem', 
              paddingBottom: '8px', 
              borderBottom: '1px solid var(--color-border)' 
            }}>
              <span>← Entry / Stairs</span>
              <span style={{ 
                color: isDark ? '#34d399' : '#006442', 
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(0, 100, 66, 0.12)', 
                border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
                padding: '3px 12px', 
                borderRadius: 'var(--radius-full)' 
              }}>
                {getFloorTitle(selectedFloor, currentFloorRooms)}
              </span>
              <span>Balcony / Exit →</span>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                Loading room layout...
              </div>
            ) : currentFloorRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                No rooms configured on this floor.
              </div>
            ) : (
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', 
                  gap: '8px', 
                  maxWidth: '460px', 
                  width: '100%',
                  margin: '0 auto' 
                }}
              >
                {currentFloorRooms.map((room) => {
                  const status = roomStatusMap[room.roomNumber] || 'available';
                  const isSelected = selectedRoomNumber === room.roomNumber;
                  const isRestricted = isRoomRestricted(room);
                  const isBooked = status === 'booked' || status === 'occupied';
                  const isInProgress = status === 'in-progress';
                  const isAvailable = !isRestricted && !isBooked && !isInProgress && status !== 'maintenance';

                  let bgColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'var(--color-surface)';
                  let textColor = isDark ? '#f8fafc' : 'var(--color-text)';
                  let borderColor = isDark ? '#475569' : 'var(--color-border)';
                  let boxShadow = 'var(--shadow-sm)';
                  let cursorStyle = 'pointer';

                  if (isSelected) {
                    // Vibrant High-Contrast Blue for Dark Mode, Deep Navy for Light Mode
                    bgColor = isDark 
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' 
                      : 'linear-gradient(135deg, #1e3a8a, #0f2942)';
                    textColor = '#ffffff';
                    borderColor = isDark ? '#60a5fa' : '#0f2942';
                    boxShadow = isDark 
                      ? '0 0 16px rgba(59, 130, 246, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.3)' 
                      : '0 4px 12px rgba(15, 41, 66, 0.35)';
                  } else if (isRestricted) {
                    bgColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)';
                    textColor = 'var(--color-muted)';
                    borderColor = isDark ? '#334155' : 'var(--color-border)';
                    cursorStyle = 'not-allowed';
                  } else if (isBooked) {
                    bgColor = '#c27803'; // Warm Caramel Amber
                    textColor = '#ffffff';
                    borderColor = '#f59e0b';
                    cursorStyle = 'not-allowed';
                  } else if (isInProgress) {
                    bgColor = '#16a34a'; // Vibrant Green
                    textColor = '#ffffff';
                    borderColor = '#22c55e';
                    cursorStyle = 'not-allowed';
                  } else {
                    // Available room
                    bgColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'var(--color-surface)';
                    textColor = isDark ? '#f8fafc' : 'var(--color-text)';
                    borderColor = isDark ? '#475569' : 'var(--color-border)';
                  }

                  return (
                    <button
                      key={room.roomNumber}
                      type="button"
                      disabled={!isAvailable && !isSelected}
                      onClick={() => handleRoomClick(room)}
                      style={{
                        background: bgColor,
                        color: textColor,
                        border: isSelected 
                          ? (isDark ? '2px solid #60a5fa' : '2px solid #0f2942') 
                          : `1.5px solid ${borderColor}`,
                        borderRadius: '10px',
                        padding: '8px 2px',
                        minHeight: '48px',
                        width: '100%',
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: cursorStyle,
                        outline: 'none',
                        transition: 'all 0.15s ease',
                        boxShadow: boxShadow
                      }}
                    >
                      <span style={{ 
                        fontWeight: 800, 
                        fontSize: isSelected ? '0.9rem' : '0.85rem', 
                        letterSpacing: '0.2px',
                        textShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.4)' : 'none'
                      }}>
                        {room.roomNumber}
                      </span>
                      {isSelected && (
                        <Check size={14} style={{ color: '#ffffff', marginTop: '2px', strokeWidth: 3 }} />
                      )}
                      {isRestricted && !isSelected && (
                        <Lock size={12} style={{ color: 'var(--color-muted)', marginTop: '2px' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '10px', borderTop: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 500 }}>
              Central Corridor & Room Seat Layout
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Seat Details Card (Matches Reference Image) */}
        <div style={{ flex: '1 1 340px', minWidth: 0, width: '100%' }}>
          <div 
            className="card"
            style={{ 
              borderRadius: '16px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                Seat Details
              </h2>
              {selectedRoomObj && (
                <span style={{ 
                  fontSize: '0.75rem', 
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.15)', 
                  color: isDark ? '#60a5fa' : '#10b981', 
                  border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : 'none',
                  padding: '3px 10px', 
                  borderRadius: 'var(--radius-full)', 
                  fontWeight: 700 
                }}>
                  1 Room Selected
                </span>
              )}
            </div>

            {/* Selection Table */}
            <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ paddingBottom: '8px', fontWeight: 600 }}>Class</th>
                    <th style={{ paddingBottom: '8px', fontWeight: 600, textAlign: 'center' }}>Seats</th>
                    <th style={{ paddingBottom: '8px', fontWeight: 600, textAlign: 'right' }}>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRoomObj ? (
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 0', fontWeight: 600, color: 'var(--color-text)' }}>
                        <div>{selectedRoomObj.roomTypeLabel || selectedRoomObj.category}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 400 }}>Floor {selectedRoomObj.floor}</div>
                      </td>
                      <td style={{ padding: '12px 0', fontWeight: 700, textAlign: 'center' }}>
                        <span style={{ 
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(0,0,0,0.06)', 
                          color: isDark ? '#93c5fd' : 'var(--color-text)',
                          border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : 'none',
                          padding: '4px 10px', 
                          borderRadius: '6px', 
                          fontFamily: 'monospace',
                          fontWeight: 800
                        }}>
                          {selectedRoomObj.roomNumber}
                        </span>
                      </td>
                      <td style={{ padding: '12px 0', fontWeight: 800, color: isDark ? '#38bdf8' : 'var(--color-text)', textAlign: 'right' }}>
                        ৳ {selectedRoomObj.nightlyRate?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        Please click on an available room from the layout.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Highlight Bar (High Contrast for Dark Mode & Light Mode) */}
            <div 
              style={{
                padding: '11px 14px',
                borderRadius: '8px',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: 800,
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(0, 100, 66, 0.08)',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(0, 100, 66, 0.2)',
                color: isDark ? '#34d399' : '#006442',
                fontSize: '1.15rem'
              }}
            >
              Total: ৳ {totalFare.toFixed(2)}
              {totalNights > 1 && (
                <span style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : 'var(--color-muted)', display: 'block', fontWeight: 400, marginTop: '2px' }}>
                  (৳ {selectedRoomObj?.nightlyRate || 0} × {totalNights} nights)
                </span>
              )}
            </div>

            {/* Child / Tariff Notice */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '8px', 
              fontSize: '0.775rem', 
              color: 'var(--color-muted)', 
              marginBottom: '1.25rem', 
              lineHeight: 1.5, 
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)', 
              padding: '10px', 
              borderRadius: '8px', 
              border: '1px solid var(--color-border)' 
            }}>
              <Info size={15} style={{ flexShrink: 0, color: '#f59e0b', marginTop: '2px' }} />
              <span>
                Room tariff and guest count verification will be adjusted on the application page.
              </span>
            </div>

            {/* Guest House Location */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                Guest House Location <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ 
                padding: '10px 12px', 
                borderRadius: '8px', 
                border: '1px solid var(--color-border)', 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)', 
                fontSize: '0.8rem', 
                color: 'var(--color-text)', 
                fontWeight: 500 
              }}>
                RUET Campus Guest House, Rajshahi-6204
              </div>
            </div>

            {/* Big Green CTA Button */}
            <button
              type="button"
              disabled={!selectedRoomObj}
              onClick={handleContinueBooking}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--radius-full)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.875rem',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: selectedRoomObj
                  ? (isDark 
                      ? 'linear-gradient(135deg, #10b981, #059669)' 
                      : 'linear-gradient(135deg, #006442, #047857)')
                  : (isDark ? '#334155' : '#94a3b8'),
                border: 'none',
                cursor: selectedRoomObj ? 'pointer' : 'not-allowed',
                opacity: selectedRoomObj ? 1 : 0.6,
                transition: 'all 0.2s ease',
                boxShadow: selectedRoomObj 
                  ? (isDark ? '0 4px 18px rgba(16, 185, 129, 0.45)' : '0 4px 14px rgba(0, 100, 66, 0.35)') 
                  : 'none'
              }}
            >
              <span>CONTINUE PURCHASE</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Sticky Quick Action Bar when a Room is Selected */}
      {selectedRoomObj && (
        <div 
          className="md-hidden"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Selected Room</div>
            <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.95rem' }}>
              Room {selectedRoomObj.roomNumber} • <span style={{ color: isDark ? '#34d399' : '#006442' }}>৳{totalFare.toFixed(0)}</span>
            </div>
          </div>
          <button
            onClick={handleContinueBooking}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-full)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isDark ? 'linear-gradient(135deg, #10b981, #059669)' : '#006442',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <span>Continue</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

    </div>
  );
}
