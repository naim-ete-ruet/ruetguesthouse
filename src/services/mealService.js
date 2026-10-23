import { supabase } from '../config/supabaseClient';

const mapMeal = (m) => ({
  id: m.id,
  userId: m.user_id,
  userRole: m.user_role,
  bookingId: m.booking_id,
  applicantName: m.applicant_name,
  roomNumber: m.room_number,
  mealDate: m.meal_date,
  mealType: m.meal_type,
  persons: m.persons,
  totalAmount: m.total_amount,
  status: m.status,
  paymentStatus: m.payment_status
});

export const mealService = {
  async requestMeal(mealData) {
    const newMeal = {
      id: `MEAL-${Math.floor(1000 + Math.random() * 9000)}`,
      user_id: mealData.userId,
      user_role: mealData.userRole,
      booking_id: mealData.bookingId,
      applicant_name: mealData.applicantName,
      room_number: mealData.roomNumber,
      meal_date: mealData.mealDate,
      meal_type: mealData.mealType,
      persons: mealData.persons,
      total_amount: mealData.totalAmount,
      status: 'PENDING',
      payment_status: 'PENDING'
    };

    const { data, error } = await supabase
      .from('meals')
      .insert(newMeal)
      .select()
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to request meal");
    }

    try {
      const { notificationService } = await import('./notificationService');
      // Notify user
      await notificationService.createNotification({
        userId: mealData.userId,
        type: 'info',
        title: 'Meal Request Placed',
        message: `Your meal request for ${mealData.mealType} (${mealData.persons} person(s)) on ${mealData.mealDate} has been placed.`,
        link: mealData.userRole === 'teacher' ? '/teacher/meals' : '/student/meals'
      });

      // Notify admin
      await notificationService.notifyAdmin({
        type: 'info',
        title: 'New Meal Request',
        message: `${mealData.applicantName || 'Guest'} requested ${mealData.mealType} for ${mealData.persons} person(s) on ${mealData.mealDate}${mealData.roomNumber ? ` (Room ${mealData.roomNumber})` : ''}.`,
        link: '/admin/meals'
      });
    } catch (nErr) {
      console.warn("Meal notification error:", nErr);
    }

    return mapMeal(data);
  },

  async getMealById(id) {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch meal");
    }
    return data ? mapMeal(data) : null;
  },

  async getMealsByUserId(userId) {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch user meals");
    }
    return data.map(mapMeal);
  },

  async getAllMeals() {
    const { data, error } = await supabase
      .from('meals')
      .select('*');
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch all meals");
    }
    return data.map(mapMeal);
  },

  async updateMealStatus(id, status) {
    const { data, error } = await supabase
      .from('meals')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to update meal status");
    }

    try {
      if (data?.user_id) {
        const { notificationService } = await import('./notificationService');
        await notificationService.createNotification({
          userId: data.user_id,
          type: status === 'APPROVED' || status === 'COMPLETED' ? 'success' : (status === 'CANCELLED' || status === 'REFUNDED' ? 'danger' : 'info'),
          title: `Meal Request ${status}`,
          message: `Your meal request #${id} (${data.meal_type}) has been updated to "${status}".`,
          link: data.user_role === 'teacher' ? '/teacher/meals' : '/student/meals'
        });
      }
      window.dispatchEvent(new Event('mealsChanged'));
      window.dispatchEvent(new Event('indicatorsChanged'));
    } catch (nErr) {
      console.warn("Meal update notification warning:", nErr);
    }

    return mapMeal(data);
  },

  async refundMeal(id, reason = 'Admin Dining Refund') {
    const { API_BASE_URL } = await import('../config/api');
    const response = await fetch(`${API_BASE_URL}/api/payment/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealId: id, reason })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "Failed to process meal refund");
    }

    try {
      window.dispatchEvent(new Event('mealsChanged'));
      window.dispatchEvent(new Event('indicatorsChanged'));
    } catch (e) {
      // ignore
    }

    return result;
  },

  async deleteMeal(id) {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Failed to delete meal:", error);
      throw new Error(error.message || "Failed to delete meal");
    }

    try {
      window.dispatchEvent(new Event('mealsChanged'));
      window.dispatchEvent(new Event('indicatorsChanged'));
    } catch (e) {
      // ignore
    }

    return true;
  }
};
