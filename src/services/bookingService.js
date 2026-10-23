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
  totalAmount: b.total_amount,
  paymentStatus: b.payment_status,
  approvalStatus: b.approval_status,
  bookingStatus: b.booking_status,
  createdAt: b.created_at || b.check_in_date,
  bookingDate: b.check_in_date,
  studentEmail: b.users?.email || null,
  applicantEmail: b.users?.email || null,
  studentMobile: b.users?.mobile || b.mobile_number || null,
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
  async getStudentBookings(userOrId) {
    let query = supabase.from('bookings').select('*, guests(*)');

    if (typeof userOrId === 'object' && userOrId !== null) {
      if (userOrId.role === 'teacher') {
        const filter = userOrId.name 
          ? `user_id.eq.${userOrId.id},approving_teacher_id.eq.${userOrId.id},applicant_name.eq.${userOrId.name}`
          : `user_id.eq.${userOrId.id},approving_teacher_id.eq.${userOrId.id}`;
        query = query.or(filter);
      } else {
        query = query.eq('user_id', userOrId.id);
      }
    } else if (typeof userOrId === 'string') {
      if (userOrId.startsWith('teacher_')) {
        query = query.or(`user_id.eq.${userOrId},approving_teacher_id.eq.${userOrId}`);
      } else {
        query = query.eq('user_id', userOrId);
      }
    }
      
    const { data, error } = await query;
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch user bookings");
    }
    
    // Sort logic handled in memory for simplicity just like before
    return (data || []).map(b => mapBookingToCamelCase(b, b.guests || []));
  },

  getUserBookings(userOrId) {
    return this.getStudentBookings(userOrId);
  },
  
  async getLatestBooking(userOrId) {
    let query = supabase.from('bookings').select('*, guests(*)');

    if (typeof userOrId === 'object' && userOrId !== null) {
      if (userOrId.role === 'teacher') {
        const filter = userOrId.name 
          ? `user_id.eq.${userOrId.id},approving_teacher_id.eq.${userOrId.id},applicant_name.eq.${userOrId.name}`
          : `user_id.eq.${userOrId.id},approving_teacher_id.eq.${userOrId.id}`;
        query = query.or(filter);
      } else {
        query = query.eq('user_id', userOrId.id);
      }
    } else if (typeof userOrId === 'string') {
      if (userOrId.startsWith('teacher_')) {
        query = query.or(`user_id.eq.${userOrId},approving_teacher_id.eq.${userOrId}`);
      } else {
        query = query.eq('user_id', userOrId);
      }
    }

    const { data, error } = await query
      .order('id', { ascending: false })
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
      .select('*, guests(*), users:user_id(id, name, email, mobile)')
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
      .select('*, guests(*), users:user_id(id, name, email, mobile)');
      
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

    // Create real notifications in Supabase
    try {
      const { notificationService } = await import('./notificationService');
      await notificationService.createNotification({
        userId: restData.userId,
        type: 'info',
        title: 'Booking Request Submitted',
        message: `Your booking request ${id} has been submitted${restData.isTeacherBooking ? '. Please proceed to payment.' : ' and is pending teacher approval.'}`,
        link: restData.isTeacherBooking ? '/teacher/history' : '/student/history'
      });

      if (restData.approvingTeacherId) {
        await notificationService.createNotification({
          userId: restData.approvingTeacherId,
          type: 'warning',
          title: 'New Student Application For Review',
          message: `${restData.applicantName} (${restData.department?.toUpperCase() || 'Student'}) requested your approval for booking ${id}.`,
          link: '/teacher/applications'
        });
      }

      // Also notify Admin of the new booking application
      await notificationService.notifyAdmin({
        type: 'info',
        title: 'New Booking Application',
        message: `${restData.applicantName} (${restData.department?.toUpperCase() || (restData.isTeacherBooking ? 'Teacher' : 'Student')}) submitted booking ${id} for ${restData.requestedRoomCount} room(s).`,
        link: '/admin/bookings'
      });
    } catch (notifErr) {
      console.warn("Booking notification error:", notifErr);
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

    // Persist status change notification into Supabase
    try {
      const { notificationService } = await import('./notificationService');
      const targetUserId = data?.user_id;
      if (targetUserId) {
        if (updates.approvalStatus === 'PENDING_PAYMENT') {
          await notificationService.createNotification({
            userId: targetUserId,
            type: 'warning',
            title: 'Teacher Approval Received - Payment Required',
            message: `Your booking ${id} has been approved by your department teacher. Please proceed to payment.`,
            link: '/student/payment'
          });
          await notificationService.notifyAdmin({
            type: 'info',
            title: 'Teacher Approval Granted',
            message: `Booking ${id} (${data?.applicant_name || 'Guest'}) has been approved by department teacher and awaits payment.`,
            link: '/admin/bookings'
          });
        } else if (updates.approvalStatus === 'APPROVED' && (updates.bookingStatus === 'CONFIRMED' || data?.booking_status === 'CONFIRMED')) {
          await notificationService.createNotification({
            userId: targetUserId,
            type: 'success',
            title: 'Booking Approved & Confirmed',
            message: `Your booking ${id} has been approved${data?.assigned_room ? ` (Room ${data.assigned_room})` : ''}.`,
            link: '/student/history'
          });
          await notificationService.notifyAdmin({
            type: 'success',
            title: 'Booking Confirmed',
            message: `Booking ${id} (${data?.applicant_name || 'Guest'}) has been confirmed${data?.assigned_room ? ` for Room ${data.assigned_room}` : ''}.`,
            link: '/admin/bookings'
          });
        } else if (updates.approvalStatus === 'REJECTED' || updates.approvalStatus === 'REJECTED_BY_TEACHER') {
          await notificationService.createNotification({
            userId: targetUserId,
            type: 'danger',
            title: 'Application Rejected',
            message: `Your booking application ${id} was rejected.${updates.rejectionReason ? ` Reason: ${updates.rejectionReason}` : ''}`,
            link: '/student/history'
          });
          await notificationService.notifyAdmin({
            type: 'warning',
            title: 'Application Rejected',
            message: `Booking ${id} (${data?.applicant_name || 'Guest'}) was rejected.`,
            link: '/admin/bookings'
          });
        } else if (updates.bookingStatus === 'CANCELLED') {
          await notificationService.notifyAdmin({
            type: 'warning',
            title: 'Booking Cancelled',
            message: `Booking ${id} (${data?.applicant_name || 'Guest'}) has been cancelled.`,
            link: '/admin/bookings'
          });
        }
      }
    } catch (nErr) {
      console.warn("Update status notification error:", nErr);
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
        const { roomService } = await import('./roomService');
        await roomService.syncRoomAvailability();
      } catch (rErr) {
        console.error("Room sync error on cash verify:", rErr);
      }
    }

    // Broadcast change to update all portals / navbar / sidebar badges immediately
    window.dispatchEvent(new Event('indicatorsChanged'));
    return result || { success: true, booking: updated };
  },

  async deleteBooking(id) {
    // 1. Fetch booking to know details (like assigned room)
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.warn("Could not fetch booking before deletion:", fetchErr);
    }

    // 2. Delete related records in guests and meals
    try {
      await supabase.from('guests').delete().eq('booking_id', id);
    } catch (gErr) {
      console.warn("Guest deletion note:", gErr);
    }
    try {
      await supabase.from('meals').delete().eq('booking_id', id);
    } catch (mErr) {
      console.warn("Meal deletion note:", mErr);
    }

    // 3. Delete the booking directly from Supabase bookings table
    const { error: delErr } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error("Supabase deleteBooking error:", delErr);
      throw new Error(delErr.message || "Failed to delete booking from database");
    }

    // 4. If booking had an assigned room and status was confirmed/occupied, free the room
    if (booking?.assigned_room && (booking?.booking_status === 'CONFIRMED' || booking?.booking_status === 'PENDING')) {
      try {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('room_number', booking.assigned_room);
      } catch (rErr) {
        console.warn("Room status reset warning:", rErr);
      }
    }

    // 5. Broadcast change to update all portals / badges immediately
    window.dispatchEvent(new Event('indicatorsChanged'));
    return { success: true };
  },

  async getDatabaseTime() {
    try {
      // 1. Try backend endpoint
      const response = await fetch(`${API_BASE_URL}/api/database-time`, {
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.timestamp) return new Date(data.timestamp);
      }
    } catch (e) {
      // Fallback to direct Supabase ping
    }

    try {
      // 2. Direct ping to Supabase REST endpoint to read the exact server Date header
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'HEAD',
          headers: { apikey: supabaseKey },
          signal: AbortSignal.timeout(3000)
        });
        const dateHeader = res.headers.get('date');
        if (dateHeader) return new Date(dateHeader);
      }
    } catch (e) {
      console.warn("Direct Supabase date fetch error:", e);
    }

    return new Date();
  }
};
