import { supabase } from '../config/supabaseClient';
import { API_BASE_URL, apiFetch } from '../config/api';

/**
 * Fast lookup of known booking placement timestamps from local cache & payment ledger
 */
export const getKnownPlacementTimestamps = () => {
  const map = {};
  try {
    const rawLedger = typeof localStorage !== 'undefined' ? localStorage.getItem('ruet_payments_ledger') : null;
    if (rawLedger) {
      const records = JSON.parse(rawLedger);
      if (Array.isArray(records)) {
        records.forEach(r => {
          if (r.bookingId && r.createdAt) {
            map[r.bookingId] = r.createdAt;
          }
        });
      }
    }
  } catch (e) {}

  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ruet_booking_created_')) {
          const bId = key.replace('ruet_booking_created_', '');
          const ts = localStorage.getItem(key);
          if (ts && !map[bId]) {
            map[bId] = ts;
          }
        }
      }
    }
  } catch (e) {}

  return map;
};

const mapBookingToCamelCase = (b, guests = [], placementMap = {}) => {
  // Placement time strictly from created_at, payments ledger, or local storage. NEVER fallback to check_in_date!
  const trueCreatedAt = b.created_at || placementMap[b.id] || (typeof localStorage !== 'undefined' ? localStorage.getItem('ruet_booking_created_' + b.id) : null) || null;

  return {
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
    requestedRoomCount: b.requested_room_count || 1,
    requestedRoomType: b.requested_room_type || 'Standard Room',
    stayPurpose: b.stay_purpose,
    assignedRoom: b.assigned_room,
    approvingTeacherId: b.approving_teacher_id,
    totalAmount: b.total_amount,
    paymentStatus: b.payment_status,
    approvalStatus: b.approval_status,
    bookingStatus: b.booking_status,
    paymentDeadline: b.payment_deadline || null,
    updatedAt: b.updated_at || null,
    createdAt: trueCreatedAt, // STRICTLY exact booking placement timestamp
    bookingDate: trueCreatedAt || b.check_in_date,
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
  };
};

/**
 * Extracts numeric millisecond timestamp representing when booking was PLACED
 */
export const getBookingPlacementTimestamp = (b) => {
  if (!b) return 0;
  // 1. Explicit createdAt timestamp
  if (b.createdAt && typeof b.createdAt === 'string') {
    const t = new Date(b.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  // 2. Local storage fallback
  try {
    const id = b.id || b.bookingId;
    if (id && typeof localStorage !== 'undefined') {
      const local = localStorage.getItem('ruet_booking_created_' + id);
      if (local) {
        const t = new Date(local).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
    }
  } catch (e) {}
  // 3. Fallback extraction from booking ID sequence (e.g. BKG-2026-660)
  const idStr = String(b.id || b.bookingId || '');
  const match = idStr.match(/BKG-(\d{4})-(\d+)/);
  if (match) {
    const year = parseInt(match[1], 10);
    const seq = parseInt(match[2], 10);
    return new Date(`${year}-01-01`).getTime() + seq;
  }
  return 0;
};

/**
 * Universal helper to sort booking lists chronologically:
 * Newest placed bookings at the top (#1), older bookings below.
 * Considers explicit booking placement timestamp first, then ID sequence.
 */
export const sortBookingsNewestFirst = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = getBookingPlacementTimestamp(a);
    const timeB = getBookingPlacementTimestamp(b);
    if (timeA !== timeB) {
      return timeB - timeA; // Descending: newest placed booking first
    }
    // Secondary tie-breaker by ID descending
    const idA = String(a.id || a.bookingId || '');
    const idB = String(b.id || b.bookingId || '');
    return idB.localeCompare(idA, undefined, { numeric: true });
  });
};

const PORTAL_DELETIONS_KEY = 'ruet_portal_deletions';

const getCachedPortalDeletions = () => {
  try {
    const raw = localStorage.getItem(PORTAL_DELETIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { student: {}, admin: [], teacher: {} };
};

const setCachedPortalDeletions = (deletions) => {
  try {
    localStorage.setItem(PORTAL_DELETIONS_KEY, JSON.stringify(deletions));
  } catch (e) {}
};

export const fetchRemotePortalDeletions = async () => {
  // 1. Fetch directly from Supabase `booking_portal_deletions` (single source of truth)
  try {
    const { data: sbDeletions, error: sbErr } = await supabase
      .from('booking_portal_deletions')
      .select('booking_id, portal_role, user_id');

    if (!sbErr && Array.isArray(sbDeletions)) {
      const local = getCachedPortalDeletions();
      const merged = {
        admin: Array.from(new Set(local.admin || [])),
        student: { ...(local.student || {}) },
        teacher: { ...(local.teacher || {}) }
      };

      sbDeletions.forEach(item => {
        const role = item.portal_role;
        const bId = item.booking_id;
        const uId = item.user_id || 'default';

        if (role === 'admin') {
          if (!merged.admin.includes(bId)) merged.admin.push(bId);
        } else if (role === 'student') {
          if (!merged.student[uId]) merged.student[uId] = [];
          if (!merged.student[uId].includes(bId)) merged.student[uId].push(bId);
        } else if (role === 'teacher') {
          if (!merged.teacher[uId]) merged.teacher[uId] = [];
          if (!merged.teacher[uId].includes(bId)) merged.teacher[uId].push(bId);
        }
      });

      setCachedPortalDeletions(merged);
      return merged;
    }
  } catch (sbErr) {
    // Non-fatal if table is still loading
  }

  // 2. Fallback to Express backend endpoint
  try {
    const res = await apiFetch('/api/bookings/portal-deletions', {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const local = getCachedPortalDeletions();
        const merged = {
          admin: Array.from(new Set([...(local.admin || []), ...(data.admin || [])])),
          student: { ...(data.student || {}) },
          teacher: { ...(data.teacher || {}) }
        };
        if (local.student) {
          Object.keys(local.student).forEach(k => {
            merged.student[k] = Array.from(new Set([...(merged.student[k] || []), ...(local.student[k] || [])]));
          });
        }
        if (local.teacher) {
          Object.keys(local.teacher).forEach(k => {
            merged.teacher[k] = Array.from(new Set([...(merged.teacher[k] || []), ...(local.teacher[k] || [])]));
          });
        }
        setCachedPortalDeletions(merged);
        return merged;
      }
    }
  } catch (err) {}
  return getCachedPortalDeletions();
};

export const bookingService = {
  async getStudentBookings(userOrId) {
    const userId = typeof userOrId === 'object' && userOrId !== null ? userOrId.id : userOrId;
    if (!userId) {
      return [];
    }

    // Always fetch strictly by user_id so personal booking history (both student and teacher)
    // only contains bookings where this user is the actual applicant.
    // Applications assigned to a teacher for approval are reviewed in ManageApplications,
    // and must NEVER leak into the teacher's personal application history.
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guests(*)')
      .eq('user_id', userId);

    if (error) {
      console.error(error);
      throw new Error("Failed to fetch user bookings");
    }
    
    // Filter out bookings that this user has deleted from their personal portal history
    const deletions = getCachedPortalDeletions();
    fetchRemotePortalDeletions().catch(() => {}); // non-blocking background sync

    const userRole = typeof userOrId === 'object' && userOrId !== null ? userOrId.role : (String(userId).startsWith('teacher_') ? 'teacher' : 'student');
    const portalRole = userRole === 'teacher' ? 'teacher' : 'student';
    const deletedForThisUser = (deletions[portalRole] && deletions[portalRole][userId]) || (deletions.student && deletions.student[userId]) || [];

    const nonDeleted = (data || []).filter(b => {
      if (deletedForThisUser.includes(b.id)) return false;
      // Strictly guarantee that this user is the applicant / owner of this booking
      if (b.user_id && b.user_id !== userId) return false;
      return true;
    });

    const placementMap = getKnownPlacementTimestamps();
    // Map and guarantee newest bookings appear first across all portals
    const mapped = nonDeleted.map(b => mapBookingToCamelCase(b, b.guests || [], placementMap));
    return sortBookingsNewestFirst(mapped);
  },

  getUserBookings(userOrId) {
    return this.getStudentBookings(userOrId);
  },

  getBookingsByUser(userOrId) {
    return this.getStudentBookings(userOrId);
  },
  
  async getLatestBooking(userOrId) {
    const list = await this.getStudentBookings(userOrId);
    return list.length > 0 ? list[0] : null;
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
    
    const placementMap = getKnownPlacementTimestamps();
    return data ? mapBookingToCamelCase(data, data.guests || [], placementMap) : null;
  },

  async getAllBookings(options = {}) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, guests(*), users:user_id(id, name, email, mobile)');
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch all bookings");
    }

    const deletions = getCachedPortalDeletions();
    fetchRemotePortalDeletions().catch(() => {});

    let filteredData = data || [];
    // If called from Admin portal (default), filter out bookings deleted from Admin view
    if (options.portal === 'admin' || !options.portal) {
      const adminDeleted = deletions.admin || [];
      filteredData = filteredData.filter(b => !adminDeleted.includes(b.id));
    } else if (options.portal === 'teacher' && options.teacherId) {
      const teacherDeleted = (deletions.teacher && deletions.teacher[options.teacherId]) || [];
      filteredData = filteredData.filter(b => !teacherDeleted.includes(b.id));
    } else if (options.portal === 'all') {
      // Returns raw list without portal filtering
    }
    
    const placementMap = getKnownPlacementTimestamps();
    // Map and guarantee newest bookings appear first across all portals
    const mapped = filteredData.map(b => mapBookingToCamelCase(b, b.guests || [], placementMap));
    return sortBookingsNewestFirst(mapped);
  },

  async createBooking(bookingData) {
    const id = `BKG-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem('ruet_booking_created_' + id, nowIso);
    } catch (e) {}

    const { guests, ...restData } = bookingData;

    const isType3 = restData.requestedRoomType === 'TYPE_3';
    const deadlineMs = isType3 ? 2 * 60 * 60 * 1000 : 5 * 60 * 1000;
    const paymentDeadline = restData.isTeacherBooking ? new Date(Date.now() + deadlineMs).toISOString() : null;

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
      const response = await apiFetch('/api/payment/refund', {
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
      const response = await apiFetch('/api/payment/verify-cash', {
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

  /**
   * Independent multi-portal booking deletion:
   * Deleting a booking in Guest portal removes it ONLY from Guest view (keeps in Admin & Teacher).
   * Deleting a booking in Admin portal removes it ONLY from Admin view (keeps in Guest & Teacher).
   * Payments ledger is NEVER deleted.
   */
  async deleteBookingForPortal(id, portal = 'student', userId = null) {
    if (!id) return { success: false };

    // 1. Update local cache immediately
    const deletions = getCachedPortalDeletions();
    if (portal === 'admin') {
      if (!Array.isArray(deletions.admin)) deletions.admin = [];
      if (!deletions.admin.includes(id)) deletions.admin.push(id);
    } else if (portal === 'student') {
      if (!deletions.student || typeof deletions.student !== 'object') deletions.student = {};
      const key = userId || 'default';
      if (!Array.isArray(deletions.student[key])) deletions.student[key] = [];
      if (!deletions.student[key].includes(id)) deletions.student[key].push(id);
    } else if (portal === 'teacher') {
      if (!deletions.teacher || typeof deletions.teacher !== 'object') deletions.teacher = {};
      const key = userId || 'default';
      if (!Array.isArray(deletions.teacher[key])) deletions.teacher[key] = [];
      if (!deletions.teacher[key].includes(id)) deletions.teacher[key].push(id);
    }
    setCachedPortalDeletions(deletions);

    // 2. Persist directly to Supabase `booking_portal_deletions` (single source of truth)
    try {
      await supabase.from('booking_portal_deletions').upsert({
        booking_id: id,
        portal_role: portal,
        user_id: userId || null
      }, { onConflict: 'booking_id,portal_role,user_id' });
    } catch (sbErr) {
      console.warn("Supabase booking_portal_deletions upsert notice:", sbErr?.message);
    }

    // 2b. Dispatch to backend API to persist in portal_deletions.json & secondary cache
    try {
      apiFetch('/api/bookings/portal-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id, portal, userId }),
        signal: AbortSignal.timeout(3000)
      }).catch(e => console.warn("Backend portal delete notice:", e.message));
    } catch (e) {}

    // 3. Free up room if the booking was assigned to an active room and was pending or confirmed
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select('assigned_room, booking_status')
        .eq('id', id)
        .maybeSingle();

      if (booking?.assigned_room && (booking?.booking_status === 'CONFIRMED' || booking?.booking_status === 'PENDING')) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('room_number', booking.assigned_room);
      }
    } catch (rErr) {}

    // 4. Broadcast change to update all portals & badges immediately
    window.dispatchEvent(new CustomEvent('bookingsChanged'));
    window.dispatchEvent(new CustomEvent('indicatorsChanged'));
    return { success: true };
  },

  async deleteBooking(id) {
    // Default fallback calls portal-safe admin deletion instead of hard database wipe
    return this.deleteBookingForPortal(id, 'admin', null);
  },

  async getDatabaseTime() {
    try {
      // 1. Try backend endpoint
      const response = await apiFetch('/api/database-time', {
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
  },

  /**
   * Fetches all active bookings with assigned rooms for accurate cross-user room availability.
   * Does NOT filter out user-specific portal deletions, so physical rooms stay accurately reserved.
   */
  async getActiveRoomBookings() {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .not('assigned_room', 'is', null);

      if (!error && Array.isArray(data)) {
        return data.map(b => mapBookingToCamelCase(b));
      }
    } catch (e) {
      console.warn("Direct Supabase active bookings fetch error, trying backend schedule:", e);
    }

    // Backend schedule fallback
    try {
      const res = await apiFetch('/api/rooms/schedule', {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const payload = await res.json();
        if (Array.isArray(payload.bookings)) {
          return payload.bookings.map(b => mapBookingToCamelCase(b));
        }
      }
    } catch (fallbackErr) {
      console.warn("Backend room schedule fallback error:", fallbackErr);
    }

    return [];
  },

  /**
   * Automatically expires an unpaid booking when its payment window elapses.
   * Releases the assigned room to general availability and dispatches notification email.
   */
  async expireBooking(id) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          booking_status: 'CANCELLED',
          approval_status: 'EXPIRED'
        })
        .eq('id', id)
        .select('*, users:user_id(name, email)')
        .maybeSingle();

      if (error) {
        console.error("Failed to expire booking in Supabase:", error);
      }

      if (data?.assigned_room) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('room_number', data.assigned_room);
      }

      // Notify backend to trigger payment expiration email notice from workmail.naim@gmail.com
      apiFetch('/api/email/payment-expired-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: id,
          guestEmail: data?.users?.email || data?.applicant_email,
          guestName: data?.applicant_name || data?.users?.name,
          assignedRoom: data?.assigned_room,
          requestedRoomType: data?.requested_room_type
        })
      }).catch(e => console.warn("Failed to dispatch payment expiration email:", e));

      window.dispatchEvent(new CustomEvent('roomsChanged'));
      window.dispatchEvent(new CustomEvent('indicatorsChanged'));
      return data;
    } catch (err) {
      console.error("expireBooking error:", err);
    }
  }
};
