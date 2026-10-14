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

export const roomService = {
  async getAllRooms() {
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

    return true;
  }
};
