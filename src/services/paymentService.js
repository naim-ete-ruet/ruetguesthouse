import { supabase } from '../config/supabaseClient';
import { API_BASE_URL, apiFetch } from '../config/api';

export const paymentService = {
  /**
   * Fetch all payment transactions directly from Supabase `payments` table
   */
  async getAllPayments() {
    const sortNewestPlacedFirst = (list) => {
      if (!Array.isArray(list)) return [];
      return [...list].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.paidAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.paidAt || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return String(b.bookingId || b.id || '').localeCompare(String(a.bookingId || a.id || ''), undefined, { numeric: true });
      });
    };

    // 1. Fetch directly from Supabase `payments` table (single source of truth)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const formatted = data.map(p => ({
          id: p.id,
          bookingId: p.booking_id,
          userId: p.user_id,
          applicantName: p.applicant_name,
          applicantEmail: p.applicant_email,
          applicantMobile: p.applicant_mobile,
          applicantRole: p.applicant_role,
          checkInDate: p.check_in_date,
          checkOutDate: p.check_out_date,
          amount: Number(p.amount || 0),
          paymentStatus: p.payment_status,
          paymentMethod: p.payment_method,
          transactionId: p.transaction_id,
          bankTranId: p.bank_tran_id,
          invoiceNumber: p.invoice_number,
          paidAt: p.paid_at,
          createdAt: p.created_at
        }));
        return sortNewestPlacedFirst(formatted);
      }
    } catch (sbErr) {
      console.warn("Error fetching payments directly from Supabase:", sbErr);
    }

    // 2. Secondary fallback via backend API
    try {
      const res = await apiFetch('/api/payment/records', {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const records = await res.json();
        if (Array.isArray(records)) {
          return sortNewestPlacedFirst(records);
        }
      }
    } catch (apiErr) {
      console.warn("Backend payment records endpoint unreachable:", apiErr.message);
    }

    return [];
  },

  /**
   * Record or update a payment transaction in Supabase
   */
  async recordPayment(paymentData) {
    if (!paymentData || !paymentData.bookingId) return;

    // Upsert directly into Supabase payments table
    try {
      await supabase.from('payments').upsert({
        id: paymentData.id || `PAY-${paymentData.bookingId}`,
        booking_id: paymentData.bookingId,
        user_id: paymentData.userId || null,
        applicant_name: paymentData.applicantName || 'Guest',
        applicant_email: paymentData.applicantEmail || null,
        applicant_mobile: paymentData.applicantMobile || null,
        applicant_role: paymentData.applicantRole || 'student',
        check_in_date: paymentData.checkInDate || null,
        check_out_date: paymentData.checkOutDate || null,
        amount: Number(paymentData.amount || 0),
        payment_status: paymentData.paymentStatus || 'PENDING',
        payment_method: paymentData.paymentMethod || 'ONLINE',
        transaction_id: paymentData.transactionId || null,
        bank_tran_id: paymentData.bankTranId || null,
        invoice_number: paymentData.invoiceNumber || null,
        paid_at: paymentData.paidAt || null,
        created_at: paymentData.createdAt || new Date().toISOString()
      });
    } catch (sbErr) {
      console.warn("Error recording payment in Supabase:", sbErr);
    }

    // Dispatch to backend API
    try {
      await apiFetch('/api/payment/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
        signal: AbortSignal.timeout(4000)
      });
    } catch (err) {}

    window.dispatchEvent(new CustomEvent('paymentsChanged'));
  },

  /**
   * Verify cash payment
   */
  async verifyCashPayment(bookingId) {
    let result = null;
    let apiSuccess = false;

    // 1. Try backend API first
    try {
      const res = await apiFetch('/api/payment/verify-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        result = await res.json();
        apiSuccess = true;
      }
    } catch (apiErr) {
      console.warn("Backend verify-cash call timed out or failed, falling back to direct Supabase:", apiErr.message);
    }

    // 2. Fallback directly into Supabase (single source of truth)
    if (!apiSuccess) {
      try {
        const { data: booking, error: bErr } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (bErr || !booking) {
          throw new Error("Booking record not found in database.");
        }

        // Update booking status in Supabase
        const nowIso = new Date().toISOString();
        await supabase
          .from('bookings')
          .update({
            payment_status: 'PAID',
            approval_status: 'APPROVED',
            booking_status: 'CONFIRMED'
          })
          .eq('id', bookingId);

        // Update or insert into payments table
        await supabase
          .from('payments')
          .upsert({
            id: `PAY-${bookingId}`,
            booking_id: bookingId,
            user_id: booking.user_id,
            applicant_name: booking.applicant_name,
            applicant_mobile: booking.mobile_number,
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            amount: Number(booking.total_amount || 0),
            payment_status: 'PAID',
            payment_method: 'CASH',
            transaction_id: `CASH-${Date.now()}`,
            paid_at: nowIso
          });

        // Add user notification
        if (booking.user_id) {
          await supabase.from('notifications').insert({
            id: `notif_${Date.now()}`,
            user_id: booking.user_id,
            type: 'success',
            title: 'Cash Payment Verified',
            message: `Your cash payment of ৳${booking.total_amount} for booking #${bookingId} has been verified and confirmed.`,
            link: '/student/history',
            is_read: false
          });
        }

        result = { success: true, message: 'Cash payment verified successfully in Supabase.' };
      } catch (sbErr) {
        console.error("Direct Supabase verification error:", sbErr);
        throw new Error(sbErr.message || "Failed to verify cash payment");
      }
    }

    window.dispatchEvent(new CustomEvent('paymentsChanged'));
    window.dispatchEvent(new CustomEvent('bookingsChanged'));
    window.dispatchEvent(new CustomEvent('indicatorsChanged'));
    return result;
  },

  /**
   * Calculate summary stats from dedicated payments ledger
   */
  calculateStats(paymentsList) {
    const list = Array.isArray(paymentsList) ? paymentsList : [];
    const totalRevenue = list
      .filter(p => (p.paymentStatus === 'PAID' || p.paymentStatus === 'COMPLETED'))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const pendingCount = list
      .filter(p => p.paymentStatus === 'PENDING')
      .length;

    const refundedCount = list
      .filter(p => p.paymentStatus === 'REFUNDED')
      .length;

    return {
      totalRevenue,
      pendingCount,
      refundedCount,
      totalCount: list.length
    };
  }
};
