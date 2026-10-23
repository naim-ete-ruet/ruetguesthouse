import { supabase } from '../config/supabaseClient';

const mapComplaint = (c) => ({
  id: c.id,
  userId: c.user_id,
  bookingId: c.booking_id,
  category: c.category,
  description: c.description,
  status: c.status,
  priority: c.priority,
  createdAt: c.created_at
});

export const complaintService = {
  async getAllComplaints() {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch all complaints");
    }
    return data.map(mapComplaint);
  },

  async getComplaintsByUser(userId) {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(error);
      throw new Error("Failed to fetch user complaints");
    }
    return data.map(mapComplaint);
  },

  async submitComplaint(complaintData) {
    const newComplaint = {
      id: `COMP-${Date.now().toString().slice(-6)}`,
      user_id: complaintData.userId,
      booking_id: complaintData.bookingId,
      category: complaintData.category,
      description: complaintData.description,
      status: 'Open',
      priority: complaintData.priority || 'Normal',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('complaints')
      .insert(newComplaint)
      .select()
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to submit complaint");
    }

    try {
      const { notificationService } = await import('./notificationService');
      // Notify student
      await notificationService.createNotification({
        userId: complaintData.userId,
        type: 'info',
        title: 'Complaint Submitted',
        message: `Your complaint #${newComplaint.id} (${newComplaint.category}) has been submitted and is under review.`,
        link: '/student/complaints'
      });

      // Notify admin
      await notificationService.notifyAdmin({
        type: 'warning',
        title: 'New Complaint Received',
        message: `New complaint #${newComplaint.id} submitted for ${newComplaint.category}.`,
        link: '/admin/complaints'
      });
    } catch (e) {}

    return mapComplaint(data);
  },

  async updateComplaintStatus(complaintId, status, adminReply = '') {
    // Note: adminReply is not in the current SQL schema, but we can easily add it later if needed.
    // For now, we just update the status.
    const { data, error } = await supabase
      .from('complaints')
      .update({ status })
      .eq('id', complaintId)
      .select()
      .single();
      
    if (error) {
      console.error(error);
      throw new Error("Failed to update complaint status");
    }

    try {
      if (data?.user_id) {
        const { notificationService } = await import('./notificationService');
        await notificationService.createNotification({
          userId: data.user_id,
          type: status === 'Resolved' ? 'success' : 'info',
          title: `Complaint ${status}`,
          message: `Your complaint #${complaintId} (${data.category}) status has been updated to "${status}".`,
          link: '/student/complaints'
        });
      }
    } catch (e) {}
    
    return mapComplaint(data);
  }
};
