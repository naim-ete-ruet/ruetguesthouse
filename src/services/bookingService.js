import { supabase } from '../config/supabaseClient';
import { API_BASE_URL } from '../config/api';

const mapBookingToCamelCase = (b, guests = []) => ({
  id: b.id,
  userId: b.user_id,
  isTeacherBooking: b.is_teacher_booking,
  applicantName: b.applicant_name,
  designation: b.designation,
  department: b.department,
  mobileNumber: b.mobile_number,
  checkInDate: b.check_in_date,
  checkInTime: b.check_in_time,
  checkOutDate: b.check_out_date,
  checkOutTime: b.check_out_time,
  totalDays: b.total_days,
  requestedRoomCount: b.requested_room_count,
  requestedRoomType: b.requested_room_type,
  stayPurpose: b.stay_purpose,
  assignedRoom: b.assigned_room,
  approvingTeacherId: b.approving_teacher_id,
  signatureImage: b.signature_image,
  totalAmount: b.total_amount,
  paymentStatus: b.payment_status,
  approvalStatus: b.approval_status,
  bookingStatus: b.booking_status,
  createdAt: b.created_at || b.check_in_date,
  bookingDate: b.check_in_date,
  guests: guests.map(g => ({
    key: g.key_label,
    name: g.name,
    nid: g.nid,
    address: g.address,
    mobile: g.mobile,
    relationship: g.relationship
  }))
});

export const bookingService = {
  async getStudentBookings(userId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guests(*)')
      .eq('user_id', userId);
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch user bookings");
    }
    
    // Sort logic handled in memory for simplicity just like before
    return data.map(b => mapBookingToCamelCase(b, b.guests || []));
  },
  
  async getLatestBooking(userId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guests(*)')
      .eq('user_id', userId)
      .order('id', { ascending: false }) // Or order by created_at if we had it, fallback to id for now
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch latest booking");
    }
    
    return data ? mapBookingToCamelCase(data, data.guests || []) : null;
  },

  async getBookingById(id) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guests(*)')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch booking");
    }
    
    return data ? mapBookingToCamelCase(data, data.guests || []) : null;
  },

  async getAllBookings() {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guests(*)');
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch all bookings");
    }
    
    return data.map(b => mapBookingToCamelCase(b, b.guests || []));
  },

  async createBooking(bookingData) {
    const id = `BKG-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const { guests, ...restData } = bookingData;

    const bookingRow = {
      id,
      user_id: restData.userId,
      is_teacher_booking: restData.isTeacherBooking,
      applicant_name: restData.applicantName,
      designation: restData.designation,
      department: restData.department,
      mobile_number: restData.mobileNumber,
      check_in_date: restData.checkInDate,
      check_in_time: restData.checkInTime,
      check_out_date: restData.checkOutDate,
      check_out_time: restData.checkOutTime,
      total_days: restData.totalDays,
      requested_room_count: restData.requestedRoomCount,
      requested_room_type: restData.requestedRoomType,
      stay_purpose: restData.stayPurpose,
      assigned_room: restData.assignedRoom || null,
      approving_teacher_id: restData.approvingTeacherId,
      signature_image: restData.signatureImage,
      total_amount: restData.totalAmount,
      approval_status: restData.isTeacherBooking ? 'PENDING_PAYMENT' : 'PENDING_TEACHER_APPROVAL',
      payment_status: 'PENDING',
      booking_status: 'PENDING'
    };

    const { data: insertedBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingRow)
      .select()
      .single();
      
    if (bookingError) {
      console.error("Booking error:", bookingError);
      throw new Error("Failed to create booking");
    }

    if (guests && guests.length > 0) {
       const guestRows = guests.map(g => ({
          booking_id: id,
          key_label: g.key,
          name: g.name,
          nid: g.nid,
          address: g.address,
          mobile: g.mobile,
          relationship: g.relationship
       }));
       const { error: guestError } = await supabase.from('guests').insert(guestRows);
       if (guestError) {
         console.error("Guest error:", guestError);
         throw new Error("Failed to insert guests");
       }
    }

    return mapBookingToCamelCase(insertedBooking, guests || []);
  },
  
  async updateBookingStatus(id, updates) {
    const snakeUpdates = {};
    if (updates.approvalStatus !== undefined) snakeUpdates.approval_status = updates.approvalStatus;
    if (updates.paymentStatus !== undefined) snakeUpdates.payment_status = updates.paymentStatus;
    if (updates.bookingStatus !== undefined) snakeUpdates.booking_status = updates.bookingStatus;
    if (updates.assignedRoom !== undefined) snakeUpdates.assigned_room = updates.assignedRoom;

    const { data, error } = await supabase
      .from('bookings')
      .update(snakeUpdates)
      .eq('id', id)
      .select('*, guests(*)')
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to update booking status");
    }

    return mapBookingToCamelCase(data, data.guests || []);
  },

  async cancelBookingWithRefund(id, amount, reason = 'Booking cancellation', bankTranId = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: id,
          amount: amount,
          reason: reason,
          bankTranId: bankTranId
        })
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Refund request failed:", err);
      await this.updateBookingStatus(id, {
        bookingStatus: 'CANCELLED',
        approvalStatus: 'CANCELLED',
        paymentStatus: 'REFUNDED'
      });
      return { success: false, error: err.message };
    }
  },

  async verifyCashPayment(id) {
    let result = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/verify-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id })
      });
      if (response.ok) {
        result = await response.json();
      }
    } catch (err) {
      console.warn("Backend cash verification error, falling back to direct database update:", err);
    }

    // Direct Supabase update to guarantee synchronized status everywhere
    const updated = await this.updateBookingStatus(id, {
      paymentStatus: 'PAID',
      bookingStatus: 'CONFIRMED',
      approvalStatus: 'APPROVED'
    });

    if (updated?.assignedRoom) {
      try {
        await supabase
          .from('rooms')
          .update({ status: 'occupied' })
          .eq('room_number', updated.assignedRoom);
      } catch (rErr) {
        console.error("Room status update error:", rErr);
      }
    }

    // Broadcast change to update all portals / navbar / sidebar badges immediately
    window.dispatchEvent(new Event('indicatorsChanged'));
    return result || { success: true, booking: updated };
  }
};
