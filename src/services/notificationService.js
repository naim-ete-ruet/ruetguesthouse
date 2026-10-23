import { supabase } from '../config/supabaseClient';

/**
 * Service to manage notifications stored directly in Supabase database.
 * Every user's notifications are stored in `public.notifications` with their `user_id`.
 * Deleting a notification removes it directly from the Supabase database.
 */

// Helper to notify other components (e.g. Sidebar badges) of changes
const notifyUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('indicatorsChanged'));
    window.dispatchEvent(new Event('notificationsChanged'));
  }
};

export const notificationService = {
  /**
   * Fetch all notifications for a specific user from Supabase.
   * If the user is an admin, fetch notifications targeted to them or 'admin_1' or 'admin'.
   * @param {string} userId - The user's ID
   * @param {string} [role] - Optional role ('admin', 'teacher', 'student')
   */
  async getUserNotifications(userId, role = null) {
    if (!userId) return [];
    try {
      let query = supabase
        .from('notifications')
        .select('*');

      if (role === 'admin' || userId === 'admin_1' || userId === 'admin') {
        const adminTargets = Array.from(new Set([userId, 'admin_1', 'admin']));
        query = query.in('user_id', adminTargets);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching notifications from Supabase:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Supabase notification fetch failed:', err);
      return [];
    }
  },

  /**
   * Insert a new notification into Supabase for a user.
   */
  async createNotification({ userId, type = 'info', title, message, link = null }) {
    if (!userId || !title || !message) return null;
    try {
      const newNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        user_id: userId,
        type,
        title,
        message,
        link,
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert([newNotif])
        .select()
        .single();

      if (error) {
        console.warn('Failed to insert notification into Supabase:', error.message);
        return null;
      }

      notifyUpdate();
      return data;
    } catch (err) {
      console.warn('createNotification error:', err);
      return null;
    }
  },

  /**
   * Send a notification to all Admin accounts in Supabase.
   */
  async notifyAdmin({ type = 'info', title, message, link = '/admin/bookings' }) {
    try {
      // Find all admin IDs
      let adminIds = ['admin_1'];
      try {
        const { data: adminUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin');
        if (adminUsers && adminUsers.length > 0) {
          adminIds = Array.from(new Set([...adminUsers.map(u => u.id), 'admin_1']));
        }
      } catch (uErr) {
        console.warn("Could not fetch admin list, defaulting to admin_1", uErr);
      }

      const rows = adminIds.map(adminId => ({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        user_id: adminId,
        type,
        title,
        message,
        link,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(rows);

      if (error) {
        console.warn("Failed to insert admin notification:", error.message);
      }

      notifyUpdate();
      return true;
    } catch (err) {
      console.warn("notifyAdmin error:", err);
      return false;
    }
  },

  /**
   * Mark a single notification as read in Supabase.
   */
  async markAsRead(id) {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) console.warn('Failed to mark notification as read in Supabase:', error.message);
      notifyUpdate();
    } catch (err) {
      console.warn('markAsRead error:', err);
    }
  },

  /**
   * Mark all notifications for a user as read in Supabase.
   */
  async markAllAsRead(userId, role = null) {
    if (!userId) return;
    try {
      let query = supabase
        .from('notifications')
        .update({ is_read: true });

      if (role === 'admin' || userId === 'admin_1' || userId === 'admin') {
        const adminTargets = Array.from(new Set([userId, 'admin_1', 'admin']));
        query = query.in('user_id', adminTargets);
      } else {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;
      if (error) console.warn('Failed to mark all as read in Supabase:', error.message);
      notifyUpdate();
    } catch (err) {
      console.warn('markAllAsRead error:', err);
    }
  },

  /**
   * Delete a notification directly from the Supabase database.
   */
  async deleteNotification(id) {
    if (!id) return false;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Failed to delete notification from Supabase:', error.message);
        return false;
      }
      notifyUpdate();
      return true;
    } catch (err) {
      console.warn('deleteNotification error:', err);
      return false;
    }
  },

  /**
   * Delete all notifications for a user directly from the Supabase database.
   */
  async deleteAllNotifications(userId, role = null) {
    if (!userId) return false;
    try {
      let query = supabase
        .from('notifications')
        .delete();

      if (role === 'admin' || userId === 'admin_1' || userId === 'admin') {
        const adminTargets = Array.from(new Set([userId, 'admin_1', 'admin']));
        query = query.in('user_id', adminTargets);
      } else {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;
      if (error) {
        console.warn('Failed to delete all notifications from Supabase:', error.message);
        return false;
      }
      notifyUpdate();
      return true;
    } catch (err) {
      console.warn('deleteAllNotifications error:', err);
      return false;
    }
  },

  /**
   * Count unread notifications for a user in Supabase.
   */
  async getUnreadCount(userId, role = null) {
    if (!userId) return 0;
    try {
      let query = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);

      if (role === 'admin' || userId === 'admin_1' || userId === 'admin') {
        const adminTargets = Array.from(new Set([userId, 'admin_1', 'admin']));
        query = query.in('user_id', adminTargets);
      } else {
        query = query.eq('user_id', userId);
      }

      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    } catch (err) {
      return 0;
    }
  }
};
