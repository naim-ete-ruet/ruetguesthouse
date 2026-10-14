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
    return mapMeal(data);
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
    return mapMeal(data);
  }
};
