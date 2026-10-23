import { supabase } from '../config/supabaseClient';

const getCategoryLabel = (category) => {
  if (!category) return '';
  if (category === 'VIP') return 'VIP';
  if (category === 'TYPE_3') return 'Type 3';
  if (category === 'TYPE_4_5_6') return 'Type 4/5/6';
  return category.replace(/_/g, ' ');
};

// Helper to map DB snake_case to frontend camelCase
const mapRoom = (r) => ({
  ...r,
  roomNumber: r.room_number,
  nightlyRate: r.nightly_rate,
  airConditioning: r.air_conditioning,
  bedDescription: r.bed_description,
  roomTypeLabel: getCategoryLabel(r.category)
});

// Helper to parse date string + time string into a valid Date object
const parseDateTime = (dateStr, timeStr, defaultTime = '12:00') => {
  if (!dateStr) return null;
  const cleanDate = dateStr.trim().split('T')[0];
  let hours = 12;
  let minutes = 0;
  
  if (timeStr && typeof timeStr === 'string') {
    const rawTime = timeStr.trim().toLowerCase();
    const isPM = rawTime.includes('pm');
    const isAM = rawTime.includes('am');
    const cleanTime = rawTime.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');
    if (parts.length >= 1) {
      hours = parseInt(parts[0], 10) || 0;
      if (parts.length >= 2) {
        minutes = parseInt(parts[1], 10) || 0;
      }
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }
  } else if (defaultTime) {
    const parts = defaultTime.split(':');
    hours = parseInt(parts[0], 10) || 12;
    minutes = parseInt(parts[1], 10) || 0;
  }
  
  const d = new Date(cleanDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

// Helper to notify other components of room changes
const notifyRoomsChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('roomsChanged'));
    window.dispatchEvent(new Event('indicatorsChanged'));
  }
};

export const roomService = {
  // Synchronize room availability against active bookings and past checkout times
  async syncRoomAvailability() {
    try {
      const [{ data: bookings, error: bErr }, { data: rooms, error: rErr }] = await Promise.all([
        supabase.from('bookings').select('*'),
        supabase.from('rooms').select('*')
      ]);

      if (bErr || rErr || !rooms || !bookings) return;

      const now = new Date();
      const activeOccupiedRooms = new Set();
      const expiredBookingIds = [];

      bookings.forEach(b => {
        // Exclude cancelled or rejected bookings
        if (
          b.booking_status === 'CANCELLED' ||
          b.approval_status === 'CANCELLED' ||
          b.approval_status === 'REJECTED' ||
          b.approval_status === 'REJECTED_BY_TEACHER'
        ) {
          return;
        }

        if (!b.assigned_room) return;
        const isConfirmed = (b.booking_status === 'CONFIRMED' || b.approval_status === 'APPROVED');
        if (!isConfirmed) return;

        const checkIn = parseDateTime(b.check_in_date, b.check_in_time, '12:00');
        const checkOut = parseDateTime(b.check_out_date || b.check_in_date, b.check_out_time, '12:00');

        if (checkOut) {
          if (now < checkOut) {
            // Booking is NOT expired! The room is occupied/reserved by this booking.
            activeOccupiedRooms.add(String(b.assigned_room).trim());
          } else {
            // Checkout time has passed (now >= checkOut): Booking IS expired.
            if (b.booking_status === 'CONFIRMED') {
              expiredBookingIds.push(b.id);
            }
          }
        }
      });

      const roomsToMakeAvailable = [];
      const roomsToMakeOccupied = [];

      rooms.forEach(room => {
        const roomNum = String(room.room_number).trim();
        // Preserve manual maintenance status
        if (room.status === 'maintenance') return;

        const shouldBeOccupied = activeOccupiedRooms.has(roomNum);

        if (!shouldBeOccupied && room.status === 'occupied') {
          roomsToMakeAvailable.push(roomNum);
        } else if (shouldBeOccupied && room.status !== 'occupied') {
          roomsToMakeOccupied.push(roomNum);
        }
      });

      let changed = false;

      if (roomsToMakeAvailable.length > 0) {
        const { error } = await supabase
          .from('rooms')
          .update({ status: 'available' })
          .in('room_number', roomsToMakeAvailable);
        if (!error) changed = true;
      }

      if (roomsToMakeOccupied.length > 0) {
        const { error } = await supabase
          .from('rooms')
          .update({ status: 'occupied' })
          .in('room_number', roomsToMakeOccupied);
        if (!error) changed = true;
      }

      if (expiredBookingIds.length > 0) {
        await supabase
          .from('bookings')
          .update({ booking_status: 'COMPLETED' })
          .in('id', expiredBookingIds);
        changed = true;
      }

      if (changed) {
        notifyRoomsChanged();
      }

      return {
        roomsMadeAvailable: roomsToMakeAvailable,
        roomsMadeOccupied: roomsToMakeOccupied
      };
    } catch (syncErr) {
      console.warn("Room sync warning:", syncErr);
    }
  },

  async getAllRooms() {
    // Automatically synchronize checkout elapsed rooms on load
    await this.syncRoomAvailability().catch(() => {});

    const { data, error } = await supabase.from('rooms').select('*').order('room_number', { ascending: true });
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch rooms");
    }
    return data.map(mapRoom);
  },
  
  async getRoomCategories() {
    const { data, error } = await supabase.from('rooms').select('category, nightly_rate');
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch room categories");
    }
    
    // Extract unique categories and their rates
    const categoriesMap = new Map();
    data.forEach(room => {
      categoriesMap.set(room.category, room.nightly_rate);
    });
    
    return Array.from(categoriesMap.entries()).map(([category, nightlyRate]) => ({ category, nightlyRate }));
  },
  
  async getAvailableRooms(category) {
    // Automatically synchronize checkout elapsed rooms on query
    await this.syncRoomAvailability().catch(() => {});

    let query = supabase.from('rooms').select('*').eq('status', 'available').order('room_number', { ascending: true });
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch available rooms");
    }
    
    return data.map(mapRoom);
  },

  async updateRoomStatus(roomNumber, status) {
    const { data, error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('room_number', roomNumber)
      .select()
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to update room status");
    }
    
    notifyRoomsChanged();
    return mapRoom(data);
  },

  async createRoom(roomData) {
    const roomNumber = String(roomData.roomNumber || roomData.room_number || '').trim();
    if (!roomNumber) {
      throw new Error("Room number is required");
    }

    // Check if room number already exists
    const { data: existing } = await supabase
      .from('rooms')
      .select('room_number')
      .eq('room_number', roomNumber)
      .maybeSingle();

    if (existing) {
      throw new Error(`Room number ${roomNumber} already exists.`);
    }

    const row = {
      room_number: roomNumber,
      floor: String(roomData.floor || roomNumber.charAt(0) || '1').trim(),
      category: roomData.category || 'TYPE_3',
      capacity: Number(roomData.capacity) || 1,
      nightly_rate: Number(roomData.nightlyRate !== undefined ? roomData.nightlyRate : roomData.nightly_rate) || 0,
      status: roomData.status || 'available',
      beds: Number(roomData.beds) || 1,
      bed_description: roomData.bedDescription || roomData.bed_description || '',
      bathroom: roomData.bathroom || 'Attached bathroom',
      air_conditioning: roomData.airConditioning !== undefined ? Boolean(roomData.airConditioning) : (roomData.air_conditioning !== undefined ? Boolean(roomData.air_conditioning) : true)
    };

    const { data, error } = await supabase
      .from('rooms')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("Error creating room:", error);
      throw new Error(error.message || "Failed to create room");
    }

    notifyRoomsChanged();
    return mapRoom(data);
  },

  async updateRoom(originalRoomNumber, roomData) {
    const targetRoomNumber = String(originalRoomNumber).trim();
    const newRoomNumber = String(roomData.roomNumber || roomData.room_number || targetRoomNumber).trim();

    // If room number is being changed, check if new room number already exists
    if (newRoomNumber !== targetRoomNumber) {
      const { data: existing } = await supabase
        .from('rooms')
        .select('room_number')
        .eq('room_number', newRoomNumber)
        .maybeSingle();

      if (existing) {
        throw new Error(`Room number ${newRoomNumber} is already in use by another room.`);
      }
    }

    const updates = {
      room_number: newRoomNumber,
      floor: String(roomData.floor || newRoomNumber.charAt(0) || '1').trim(),
      category: roomData.category,
      capacity: Number(roomData.capacity) || 1,
      nightly_rate: Number(roomData.nightlyRate !== undefined ? roomData.nightlyRate : roomData.nightly_rate) || 0,
      status: roomData.status || 'available',
      beds: Number(roomData.beds) || 1,
      bed_description: roomData.bedDescription || roomData.bed_description || '',
      bathroom: roomData.bathroom || 'Attached bathroom',
      air_conditioning: roomData.airConditioning !== undefined ? Boolean(roomData.airConditioning) : (roomData.air_conditioning !== undefined ? Boolean(roomData.air_conditioning) : true)
    };

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('room_number', targetRoomNumber)
      .select()
      .single();

    if (error) {
      console.error("Error updating room:", error);
      throw new Error(error.message || "Failed to update room");
    }

    // Cascade room number change if assigned to any bookings
    if (newRoomNumber !== targetRoomNumber) {
      try {
        await supabase
          .from('bookings')
          .update({ assigned_room: newRoomNumber })
          .eq('assigned_room', targetRoomNumber);
      } catch (cascadeErr) {
        console.warn("Cascade room number to bookings warning:", cascadeErr);
      }
    }

    notifyRoomsChanged();
    return mapRoom(data);
  },

  async deleteRoom(roomNumber) {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('room_number', roomNumber);

    if (error) {
      console.error("Error deleting room:", error);
      throw new Error(error.message || "Failed to delete room");
    }

    notifyRoomsChanged();
    return true;
  }
};

// Automatic client-side background synchronization every 30 seconds
if (typeof window !== 'undefined') {
  setTimeout(() => {
    roomService.syncRoomAvailability().catch(() => {});
  }, 1000);

  setInterval(() => {
    roomService.syncRoomAvailability().catch(() => {});
  }, 30000);
}
