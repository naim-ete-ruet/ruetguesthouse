import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { mealService } from '../../services/mealService';
import { supabase } from '../../config/supabaseClient';
import { AlertCircle, Coffee, Clock, CheckCircle, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function BookMeal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const [formData, setFormData] = useState({
    bookingId: '',
    mealDate: '',
    mealType: 'Lunch', // Lunch, Dinner, Both
    persons: 1
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchUserData = async () => {
    try {
      const bookings = await bookingService.getStudentBookings(user.id);
      // Only allow meal booking for APPROVED bookings
      setApprovedBookings(bookings.filter(b => b.approvalStatus === 'APPROVED'));

      const myMeals = await mealService.getMealsByUserId(user.id);
      // Sort meals descending by date
      setMeals(myMeals.sort((a, b) => (b.mealDate || '').localeCompare(a.mealDate || '')));
    } catch (err) {
      console.error("Failed to load dining data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();

    const handleRefresh = () => {
      fetchUserData();
    };

    window.addEventListener('mealsChanged', handleRefresh);
    window.addEventListener('indicatorsChanged', handleRefresh);

    // Supabase Realtime channel for live updates to meals
    const channel = supabase
      .channel(`realtime_meals_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        fetchUserData();
      })
      .subscribe();

    return () => {
      window.removeEventListener('mealsChanged', handleRefresh);
      window.removeEventListener('indicatorsChanged', handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const selectedBooking = approvedBookings.find(b => b.id === formData.bookingId);

  // Checks whether the meal date has passed
  const isMealDatePassed = (mealDateStr) => {
    if (!mealDateStr) return false;
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = String(now.getMonth() + 1).padStart(2, '0');
    const todayD = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayY}-${todayM}-${todayD}`;

    // Strictly prior to today: passed
    if (mealDateStr < todayStr) return true;

    // Same day: if it is after 10:00 PM (22:00), the meal service day has passed
    if (mealDateStr === todayStr && now.getHours() >= 22) {
      return true;
    }

    return false;
  };

  // Only past-date meals or cancelled/rejected/refunded meals can be deleted by user
  const canDeleteMeal = (meal) => {
    if (!meal) return false;
    if (meal.status === 'CANCELLED' || meal.status === 'REJECTED' || meal.status === 'REFUNDED') return true;
    return isMealDatePassed(meal.mealDate);
  };

  const handleDeleteMeal = async (meal) => {
    if (!meal) return;
    if (!canDeleteMeal(meal)) {
      alert("Upcoming or active meals cannot be deleted. Meal history can only be deleted once the meal date has passed.");
      return;
    }

    const confirmMsg = `Are you sure you want to delete this ${meal.mealType} record on ${meal.mealDate} (#${meal.id})?\n\nThis will permanently remove it from the database.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeletingId(meal.id);
    try {
      await mealService.deleteMeal(meal.id);
      setMeals(prev => prev.filter(m => m.id !== meal.id));
      setFeedback({
        type: 'success',
        message: `Meal record #${meal.id} for ${meal.mealDate} has been permanently deleted from database.`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Failed to delete meal:", err);
      setFeedback({
        type: 'error',
        message: err.message || "Failed to delete meal record from database. Please try again."
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsDeletingId(null);
    }
  };

  const getMinMealDate = (checkInDateStr) => {
    if (!checkInDateStr) return '';
    const now = new Date();
    let minValid = new Date();

    // If it is 11 PM (23:xx) or later, earliest they can order is day after tomorrow
    if (now.getHours() >= 23) {
      minValid.setDate(now.getDate() + 2);
    } else {
      minValid.setDate(now.getDate() + 1); // Before 11 PM, earliest is tomorrow
    }

    const y = minValid.getFullYear();
    const m = String(minValid.getMonth() + 1).padStart(2, '0');
    const d = String(minValid.getDate()).padStart(2, '0');
    const minValidStr = `${y}-${m}-${d}`;

    return checkInDateStr > minValidStr ? checkInDateStr : minValidStr;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking) {
      setError("Please select an approved room booking first.");
      return;
    }

    const mealDateObj = new Date(formData.mealDate);
    const checkInObj = new Date(selectedBooking.checkInDate);
    const checkOutObj = new Date(selectedBooking.checkOutDate);

    // Set time to midnight for accurate day comparison
    mealDateObj.setHours(0, 0, 0, 0);
    checkInObj.setHours(0, 0, 0, 0);
    checkOutObj.setHours(0, 0, 0, 0);

    if (mealDateObj < checkInObj || mealDateObj > checkOutObj) {
      setError(`Meal date must be between Check-in (${selectedBooking.checkInDate}) and Check-out (${selectedBooking.checkOutDate}).`);
      return;
    }

    const [y, m, d] = formData.mealDate.split('-');
    const deadline = new Date(y, m - 1, d);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(23, 0, 0, 0);

    const now = new Date();
    if (now > deadline) {
      setError(`Meals for ${formData.mealDate} must be ordered before 11:00 PM on the previous day.`);
      return;
    }

    const multiplier = formData.mealType === 'Both (Lunch & Dinner)' ? 2 : 1;
    const totalAmount = formData.persons * multiplier * 100;
    setIsProcessing(true);
    
    try {
      const mealData = {
        userRole: user.role,
        userId: user.id,
        bookingId: formData.bookingId,
        applicantName: user.name,
        roomNumber: selectedBooking.assignedRoom || 'Pending',
        mealDate: formData.mealDate,
        mealType: formData.mealType,
        persons: formData.persons,
        totalAmount: totalAmount
      };

      // 1. Create the pending meal in the database
      const createdMeal = await mealService.requestMeal(mealData);

      // 2. Init SSLCommerz payment
      const response = await fetch(`${API_BASE_URL}/api/payment/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          applicant_name: user.name,
          user_id: user.id,
          role: user.role,
          email: user.email,
          mobile: selectedBooking.mobileNumber || user.mobile || '01700000000',
          item_type: 'meal',
          reference_id: createdMeal.id // pass the meal ID
        })
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to secure gateway
      } else {
        setError("Payment Gateway Failed to initialize.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to secure payment server or save request.");
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading dining details...</div>;

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '1050px' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3" style={{ borderBottom: '2px solid var(--color-primary)' }}>
        <div className="flex items-center gap-3">
          <Coffee size={28} className="text-primary flex-shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold">Dining & Meal Request</h1>
        </div>
        <div className="text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded font-medium flex items-center gap-2 self-start sm:self-auto" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={16} className="flex-shrink-0" />
          <span><strong>Note:</strong> Meals must be ordered before 11 PM.</span>
        </div>
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
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-black p-1">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left Column: Request Form */}
        <div>
          {approvedBookings.length === 0 ? (
            <div className="card text-center p-8 h-fit">
              <AlertCircle size={44} className="mx-auto text-warning mb-3" />
              <h2 className="text-lg font-bold mb-2">No Active Room Booking</h2>
              <p className="text-sm text-muted">
                You can only request meals if you have an approved and confirmed room booking. Past meal records remain accessible in your history on the right.
              </p>
            </div>
          ) : (
            <div className="card hover-scale h-fit">
              <h2 className="text-lg font-bold mb-4 bg-primary text-white p-2 rounded">
                Request a Meal
              </h2>

              {error && <div className="mb-4 p-3 rounded bg-danger bg-opacity-10 text-danger text-sm">{error}</div>}
              {message && <div className="mb-4 p-3 rounded bg-success bg-opacity-10 text-success text-sm">{message}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Select Booking</label>
                  <select className="form-select" required
                    value={formData.bookingId}
                    onChange={e => setFormData({ ...formData, bookingId: e.target.value })}
                  >
                    <option value="">-- Choose Booking --</option>
                    {approvedBookings.map(b => (
                      <option key={b.id} value={b.id}>
                        Room {b.assignedRoom || 'TBD'} ({b.checkInDate} to {b.checkOutDate})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBooking && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Date for Meal</label>
                      <input type="date" className="form-input" required
                        min={getMinMealDate(selectedBooking.checkInDate)}
                        max={selectedBooking.checkOutDate}
                        value={formData.mealDate}
                        onChange={e => setFormData({ ...formData, mealDate: e.target.value })}
                      />
                      <small className="text-muted mt-1 block">
                        Must be between your check-in and check-out dates.
                      </small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Meal Type</label>
                      <select className="form-select" required
                        value={formData.mealType}
                        onChange={e => setFormData({ ...formData, mealType: e.target.value })}
                      >
                        <option value="Lunch">Lunch</option>
                        <option value="Dinner">Dinner</option>
                        <option value="Both (Lunch & Dinner)">Both (Lunch & Dinner)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Number of Persons</label>
                      <input type="number" className="form-input" min="1" required
                        value={formData.persons}
                        onChange={e => setFormData({ ...formData, persons: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="mt-4 mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>
                      <strong>Total Amount:</strong> BDT {
                        formData.persons * (formData.mealType === 'Both (Lunch & Dinner)' ? 2 : 1) * 100
                      } (100 Tk per meal)
                    </div>

                    <button type="submit" disabled={isProcessing} className="btn btn-primary w-full flex items-center justify-center gap-2">
                      {isProcessing ? 'Processing Secure Payment...' : 'Pay & Submit Request'}
                    </button>
                  </>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Right Column: History */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: '2px solid var(--color-border)' }}>
            <h2 className="text-xl font-bold">Your Meal History</h2>
            <span className="text-xs text-muted font-medium">
              {meals.length} {meals.length === 1 ? 'order' : 'orders'}
            </span>
          </div>

          {meals.length === 0 ? (
            <div className="p-8 text-center border rounded dashed" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-muted italic">No meal requests found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {meals.map(meal => {
                const passed = isMealDatePassed(meal.mealDate);
                const deletable = canDeleteMeal(meal);
                const isDeleting = isDeletingId === meal.id;

                return (
                  <div 
                    key={meal.id} 
                    className="card p-4 sm:p-5 flex flex-wrap justify-between items-start sm:items-center gap-3 shadow-sm hover:shadow-md transition-shadow" 
                    style={{ 
                      borderLeft: passed ? '4px solid #94a3b8' : '4px solid var(--color-primary)',
                      opacity: isDeleting ? 0.6 : 1 
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base sm:text-lg">{meal.mealType}</h3>
                        <span className="text-xs font-mono text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                          #{meal.id}
                        </span>
                      </div>
                      <p className="text-sm text-muted mb-1">
                        Date: <span className="font-semibold text-black">{meal.mealDate}</span> • Persons: <span className="font-semibold text-black">{meal.persons}</span>
                      </p>
                      <p className="text-xs text-muted">Room: {meal.roomNumber} (Ref: {meal.bookingId})</p>
                    </div>

                    <div className="flex flex-row sm:flex-row items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {passed && (
                          <span 
                            className="badge text-xs" 
                            style={{ 
                              backgroundColor: 'rgba(100, 116, 139, 0.12)', 
                              color: '#475569', 
                              border: '1px solid rgba(100, 116, 139, 0.25)',
                              fontWeight: 500
                            }}
                          >
                            Date Passed
                          </span>
                        )}
                        <span className={`badge ${
                          meal.status === 'APPROVED' || meal.status === 'SERVED' ? 'badge-success' :
                          meal.status === 'PAID' ? 'badge-info' :
                          meal.status === 'REJECTED' || meal.status === 'CANCELLED' || meal.status === 'REFUNDED' ? 'badge-danger' : 
                          'badge-warning'
                        }`}>
                          {meal.status}
                        </span>
                      </div>

                      {deletable ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteMeal(meal)}
                          disabled={isDeleting}
                          className="btn btn-sm flex items-center gap-1.5 text-danger hover:bg-red-50 transition-colors"
                          style={{
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            color: '#dc2626',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: isDeleting ? 'not-allowed' : 'pointer'
                          }}
                          title="Delete this past meal record from database"
                        >
                          <Trash2 size={15} />
                          <span className="text-xs font-semibold">{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      ) : (
                        <span 
                          className="text-xs text-muted flex items-center gap-1 px-2.5 py-1 rounded"
                          style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
                          title="Active/upcoming meal (can be deleted once the meal date has passed)"
                        >
                          <Clock size={12} className="text-primary" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
