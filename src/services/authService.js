import { supabase } from '../config/supabaseClient';

export const authService = {
  async login(email, password) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error("Invalid email or password");
    }

    const { password: _, ...sanitizedUser } = data;
    return sanitizedUser;
  },

  async register(userData) {
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();

    if (existing) {
      throw new Error("User already exists with this email");
    }

    const newUser = {
      id: `user_${Date.now()}`,
      role: 'student',
      ...userData
    };

    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new Error("Failed to register user");
    }

    const { password: _, ...sanitizedUser } = data;
    return sanitizedUser;
  },

  async changePassword(userId, currentPassword, newPassword) {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      throw new Error("User not found");
    }

    if (user.password !== currentPassword) {
      throw new Error("Current password is incorrect");
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('id', userId);

    if (updateError) {
      console.error(updateError);
      throw new Error("Failed to update password");
    }
    
    return true;
  },

  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error(error);
      throw new Error("Failed to fetch users");
    }
    
    return data.map(({ password: _, ...u }) => u);
  },

  async updateProfile(userId, profileData) {
    const updates = {};
    if (profileData.name !== undefined) updates.name = String(profileData.name).trim();
    if (profileData.mobile !== undefined) updates.mobile = String(profileData.mobile).trim();
    if (profileData.department !== undefined) updates.department = String(profileData.department).trim();
    if (profileData.designation !== undefined) updates.designation = String(profileData.designation).trim();
    if (profileData.nid !== undefined) updates.nid = profileData.nid ? String(profileData.nid).trim() : null;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateProfile error:", error);
      throw new Error(error.message || "Failed to update profile in database");
    }

    const { password: _, ...sanitizedUser } = data;
    return sanitizedUser;
  }
};
