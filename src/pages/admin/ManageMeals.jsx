import { useState, useEffect, useCallback } from 'react';
import { mealService } from '../../services/mealService';
import { supabase } from '../../config/supabaseClient';
import { Coffee, Check, X, Search, Filter, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

export default function ManageMeals() {
  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const fetchMeals = useCallback(async () => {
    try {
      const allMeals = await mealService.getAllMeals();
      // Sort newest / upcoming meal dates first
      setMeals(allMeals.sort((a, b) => (b.mealDate || '').localeCompare(a.mealDate || '')));
    } catch (err) {
      console.error("Failed to load meals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeals();

    const handleRefresh = () => {
      fetchMeals();
    };

    window.addEventListener('mealsChanged', handleRefresh);
    window.addEventListener('indicatorsChanged', handleRefresh);

    // Supabase Realtime channel for live updates to meals
    const channel = supabase
      .channel('realtime_admin_manage_meals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        fetchMeals();
      })
      .subscribe();

    return () => {
      window.removeEventListener('mealsChanged', handleRefresh);
      window.removeEventListener('indicatorsChanged', handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [fetchMeals]);

  // Determine effective status for display & filtering:
  // If payment is completed and not approved/refunded/served yet, display as PAID
  const getDisplayStatus = (meal) => {
    if (meal.status === 'REFUNDED' || meal.paymentStatus === 'REFUNDED') return 'REFUNDED';
    if (meal.status === 'APPROVED') return 'APPROVED';
    if (meal.status === 'SERVED') return 'SERVED';
    if (meal.status === 'CANCELLED') return 'CANCELLED';
    if (meal.status === 'REJECTED') return 'REJECTED';
    if (meal.paymentStatus === 'COMPLETED' || meal.status === 'PAID' || meal.status === 'CONFIRMED') {
      return 'PAID';
    }
    return meal.status || 'PENDING';
  };

  const handleApproveMeal = async (meal) => {
    setProcessingId(meal.id);
    try {
      await mealService.updateMealStatus(meal.id, 'APPROVED');
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, status: 'APPROVED' } : m));
      setFeedback({
        type: 'success',
        message: `Meal #${meal.id} (${meal.applicantName}) has been approved successfully.`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Failed to approve meal:", err);
      setFeedback({
        type: 'error',
        message: err.message || "Failed to update meal status."
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefundMeal = async (meal) => {
    if (meal.status === 'APPROVED' || meal.status === 'SERVED') {
      alert("Approved meals cannot be refunded.");
      return;
    }

    const amount = meal.totalAmount || (meal.persons * (meal.mealType.includes('Both') ? 2 : 1) * 100);
    const confirmed = window.confirm(
      `Are you sure you want to refund ৳${amount} for meal #${meal.id} (${meal.applicantName})?\n\nThis will initiate an automatic refund via SSLCommerz and mark the meal order as REFUNDED in the database.`
    );
    if (!confirmed) return;

    setProcessingId(meal.id);
    try {
      const res = await mealService.refundMeal(meal.id, 'Admin Dining Refund');
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, status: 'REFUNDED', paymentStatus: 'REFUNDED' } : m));
      setFeedback({
        type: 'success',
        message: `Meal #${meal.id} has been refunded (৳${amount}) to ${meal.applicantName} successfully. ${res.refundedInSSLCommerz ? 'SSLCommerz transaction refunded.' : ''}`
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      console.error("Failed to refund meal:", err);
      setFeedback({
        type: 'error',
        message: err.message || "Failed to process meal refund. Please check gateway connection."
      });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkServed = async (meal) => {
    setProcessingId(meal.id);
    try {
      await mealService.updateMealStatus(meal.id, 'SERVED');
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, status: 'SERVED' } : m));
      setFeedback({
        type: 'success',
        message: `Meal #${meal.id} marked as served.`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Failed to mark meal served:", err);
      setFeedback({
        type: 'error',
        message: err.message || "Failed to update status."
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredMeals = meals.filter(m => {
    const dispStatus = getDisplayStatus(m);
    if (filter !== 'ALL') {
      if (filter === 'PAID') {
        if (dispStatus !== 'PAID') return false;
      } else if (filter === 'APPROVED') {
        if (dispStatus !== 'APPROVED') return false;
      } else if (filter === 'SERVED') {
        if (dispStatus !== 'SERVED') return false;
      } else if (filter === 'REFUNDED') {
        if (dispStatus !== 'REFUNDED') return false;
      } else if (dispStatus !== filter) {
        return false;
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return (
        m.applicantName?.toLowerCase().includes(lower) || 
        m.roomNumber?.toLowerCase().includes(lower) ||
        m.mealDate?.includes(lower) ||
        m.id?.toLowerCase().includes(lower) ||
        m.bookingId?.toLowerCase().includes(lower)
      );
    }
    return true;
  });

  return (
    <div className="container animate-fade-in">
      <div className="flex items-center gap-3 mb-6 pb-2" style={{ borderBottom: '2px solid var(--color-primary)' }}>
        <Coffee size={28} className="text-primary" />
        <h1 className="text-2xl font-bold">Manage Dining</h1>
      </div>

      {feedback && (
        <div 
          className="mb-6 p-4 rounded flex items-center justify-between text-sm shadow-sm transition-all animate-fade-in"
          style={{
            backgroundColor: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: feedback.type === 'success' ? '#22c55e' : '#ef4444',
            border: '1px solid',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c'
          }}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-black p-1">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, room, meal date, or meal ID..." 
            className="form-input w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="text-muted flex-shrink-0" size={20} />
          <select className="form-select w-full sm:w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Meals</option>
            <option value="PAID">Paid (Pending Admin Action)</option>
            <option value="APPROVED">Approved</option>
            <option value="SERVED">Served</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PENDING">Pending Payment</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '850px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <th className="p-3">ID</th>
              <th className="p-3">Applicant (Room)</th>
              <th className="p-3">Meal Info</th>
              <th className="p-3">Persons & Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center" style={{ minWidth: '180px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="text-center p-6 text-muted">Loading dining meal orders...</td></tr>
            ) : filteredMeals.length === 0 ? (
              <tr><td colSpan="6" className="text-center p-8 text-muted italic">No meal requests found.</td></tr>
            ) : filteredMeals.map(meal => {
              const dispStatus = getDisplayStatus(meal);
              const isProcessing = processingId === meal.id;
              const amount = meal.totalAmount || (meal.persons * (meal.mealType?.includes('Both') ? 2 : 1) * 100);

              return (
                <tr key={meal.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="p-3 text-sm font-bold font-mono text-primary">{meal.id}</td>
                  <td className="p-3 text-sm">
                    <div className="font-bold">{meal.applicantName}</div>
                    <div className="text-xs text-muted">Room: {meal.roomNumber} {meal.bookingId ? `(${meal.bookingId})` : ''}</div>
                  </td>
                  <td className="p-3 text-sm">
                    <div className="font-bold">{meal.mealType}</div>
                    <div className="text-xs text-muted">{meal.mealDate}</div>
                  </td>
                  <td className="p-3 text-sm">
                    <div className="font-semibold">{meal.persons} person(s)</div>
                    <div className="text-xs text-success font-bold">৳{amount}</div>
                  </td>
                  <td className="p-3 text-sm">
                    {dispStatus === 'PAID' && (
                      <span 
                        className="badge font-bold" 
                        style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.14)', 
                          color: '#2563eb', 
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          padding: '4px 10px',
                          borderRadius: '6px'
                        }}
                      >
                        PAID
                      </span>
                    )}
                    {dispStatus === 'APPROVED' && (
                      <span className="badge badge-success font-bold" style={{ padding: '4px 10px', borderRadius: '6px' }}>
                        APPROVED
                      </span>
                    )}
                    {dispStatus === 'SERVED' && (
                      <span className="badge badge-success font-bold" style={{ padding: '4px 10px', borderRadius: '6px' }}>
                        SERVED
                      </span>
                    )}
                    {dispStatus === 'REFUNDED' && (
                      <span className="badge badge-danger font-bold" style={{ padding: '4px 10px', borderRadius: '6px' }}>
                        REFUNDED
                      </span>
                    )}
                    {dispStatus !== 'PAID' && dispStatus !== 'APPROVED' && dispStatus !== 'SERVED' && dispStatus !== 'REFUNDED' && (
                      <span className="badge badge-warning font-bold" style={{ padding: '4px 10px', borderRadius: '6px' }}>
                        {dispStatus}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center items-center gap-2 flex-wrap">
                      {/* For PAID meals: Show Approve (green) and Refund (red) */}
                      {dispStatus === 'PAID' && (
                        <>
                          <button 
                            type="button"
                            onClick={() => handleApproveMeal(meal)} 
                            disabled={isProcessing}
                            className="btn btn-sm btn-success flex items-center gap-1.5"
                            style={{ 
                              backgroundColor: '#10b981', 
                              borderColor: '#10b981', 
                              color: '#ffffff',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontWeight: 600
                            }}
                            title="Approve this meal order"
                          >
                            <Check size={15} />
                            <span>{isProcessing ? 'Saving...' : 'Approve'}</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => handleRefundMeal(meal)} 
                            disabled={isProcessing}
                            className="btn btn-sm btn-danger flex items-center gap-1.5"
                            style={{ 
                              backgroundColor: '#ef4444', 
                              borderColor: '#ef4444', 
                              color: '#ffffff',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontWeight: 600
                            }}
                            title="Refund meal payment to user"
                          >
                            <RotateCcw size={14} />
                            <span>{isProcessing ? 'Processing...' : 'Refund'}</span>
                          </button>
                        </>
                      )}

                      {/* For APPROVED meals: Only Mark Served (refund is not allowed once approved) */}
                      {dispStatus === 'APPROVED' && (
                        <button 
                          type="button"
                          onClick={() => handleMarkServed(meal)} 
                          disabled={isProcessing}
                          className="btn btn-sm btn-primary flex items-center gap-1.5"
                          style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '0.825rem', fontWeight: 600 }}
                          title="Mark meal as served to guest"
                        >
                          <Check size={14} />
                          <span>{isProcessing ? 'Saving...' : 'Mark Served'}</span>
                        </button>
                      )}

                      {/* For SERVED meals */}
                      {dispStatus === 'SERVED' && (
                        <span className="text-xs text-muted font-medium flex items-center gap-1">
                          <Check size={14} className="text-success" /> Completed
                        </span>
                      )}

                      {/* For REFUNDED meals */}
                      {dispStatus === 'REFUNDED' && (
                        <span className="text-xs font-semibold text-danger flex items-center gap-1">
                          <RotateCcw size={13} /> Refund Processed
                        </span>
                      )}

                      {/* For PENDING payment */}
                      {dispStatus === 'PENDING' && (
                        <span className="text-xs text-muted italic">Awaiting Payment</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
