import { supabase } from '../config/supabaseClient';

export const authService = {
  async login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error("Invalid email or password");
    }

    const { password: _, ...sanitizedUser } = data;

    // Check account suspension status
    try {
      const suspendedList = JSON.parse(localStorage.getItem('ruet_suspended_users') || '[]');
      if (suspendedList.includes(sanitizedUser.id)) {
        throw new Error("Your account has been suspended by the administrator. Please contact the guest house office.");
      }
    } catch (e) {
      if (e.message.includes('suspended')) throw e;
    }

    return {
      ...sanitizedUser,
      rollNo: sanitizedUser.nid || sanitizedUser.rollNo || ''
    };
  },

  async checkEmailRegistered(email) {
    if (!email || !String(email).trim()) return false;
    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.warn("Check email lookup warning:", error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.warn("Check email exception:", err);
      return false;
    }
  },

  async register(userData) {
    const cleanEmail = String(userData.email || '').trim().toLowerCase();

    // Check if user already exists with this email (case-insensitive)
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      throw new Error("An account have already registered from this email");
    }

    if (!userData.password || userData.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    // Build the user record strictly matching Supabase 'users' columns
    const newUser = {
      id: `user_${Date.now()}`,
      role: 'student',
      name: String(userData.name || '').trim(),
      email: cleanEmail,
      department: String(userData.department || 'cse').toUpperCase(),
      mobile: String(userData.mobile || '').trim(),
      password: userData.password,
      designation: userData.designation || 'Student',
      nid: userData.rollNo ? String(userData.rollNo).trim() : (userData.nid ? String(userData.nid).trim() : null)
    };

    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();

    if (error) {
      console.error("Supabase user insert error:", error);
      if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique'))) {
        throw new Error("An account have already registered from this email");
      }
      throw new Error("Failed to register user: " + (error.message || 'Database error'));
    }

    const { password: _, ...sanitizedUser } = data;
    return {
      ...sanitizedUser,
      rollNo: sanitizedUser.nid || sanitizedUser.rollNo || ''
    };
  },

  async changePassword(userId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

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
    
    return data.map(({ password: _, ...u }) => ({
      ...u,
      rollNo: u.nid || u.rollNo || ''
    }));
  },

  async updateProfile(userId, profileData) {
    const updates = {};
    if (profileData.name !== undefined) updates.name = String(profileData.name).trim();
    if (profileData.mobile !== undefined) updates.mobile = String(profileData.mobile).trim();
    if (profileData.department !== undefined) updates.department = String(profileData.department).trim();
    if (profileData.designation !== undefined) updates.designation = String(profileData.designation).trim();
    if (profileData.nid !== undefined || profileData.rollNo !== undefined) {
      const val = profileData.rollNo !== undefined ? profileData.rollNo : profileData.nid;
      updates.nid = val ? String(val).trim() : null;
    }

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
    return {
      ...sanitizedUser,
      rollNo: sanitizedUser.nid || sanitizedUser.rollNo || ''
    };
  }
};
