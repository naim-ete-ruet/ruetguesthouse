import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { mealService } from '../../services/mealService';
import { AlertCircle, Coffee, Clock, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function BookMeal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    bookingId: '',
    mealDate: '',
    mealType: 'Lunch', // Lunch, Dinner, Both
    persons: 1
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bookings = await bookingService.getStudentBookings(user.id);
        // Only allow meal booking for APPROVED bookings
        setApprovedBookings(bookings.filter(b => b.approvalStatus === 'APPROVED'));

        const myMeals = await mealService.getMealsByUserId(user.id);
        setMeals(myMeals);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const selectedBooking = approvedBookings.find(b => b.id === formData.bookingId);

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

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '1000px' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-3" style={{ borderBottom: '2px solid var(--color-primary)' }}>
        <div className="flex items-center gap-3">
          <Coffee size={28} className="text-primary" />
          <h1 className="text-2xl font-bold">Dining & Meal Request</h1>
        </div>
        <div className="text-sm px-4 py-2 rounded font-medium flex items-center gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={16} />
          <span><strong>Note:</strong> Meals must be ordered before 11 PM.</span>
        </div>
      </div>

      {approvedBookings.length === 0 ? (
        <div className="card text-center p-8">
          <AlertCircle size={48} className="mx-auto text-warning mb-4" />
          <h2 className="text-xl font-bold mb-2">No Approved Bookings</h2>
          <p className="text-muted">You can only request meals if you have an approved and confirmed room booking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left Column: Request Form */}
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

          {/* Right Column: History */}
          <div>
            <h2 className="text-xl font-bold mb-6 pb-2" style={{ borderBottom: '2px solid var(--color-border)' }}>Your Meal History</h2>
            {meals.length === 0 ? (
              <div className="p-8 text-center border rounded dashed" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-muted italic">No meal requests found.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {meals.map(meal => (
                  <div key={meal.id} className="card p-5 flex justify-between items-center shadow-sm" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{meal.mealType}</h3>
                      <p className="text-sm text-muted mb-1">Date: <span className="font-medium text-black">{meal.mealDate}</span> • Persons: <span className="font-medium text-black">{meal.persons}</span></p>
                      <p className="text-xs text-muted">Room: {meal.roomNumber} (Ref: {meal.bookingId})</p>
                    </div>
                    <div>
                      <span className={`badge ${meal.status === 'APPROVED' || meal.status === 'SERVED' ? 'badge-success' :
                        meal.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                        }`}>
                        {meal.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
