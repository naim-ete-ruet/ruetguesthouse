import { useState, useEffect } from 'react';
import { mealService } from '../../services/mealService';
import { Coffee, Check, X, Search, Filter } from 'lucide-react';

export default function ManageMeals() {
  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const allMeals = await mealService.getAllMeals();
      setMeals(allMeals);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await mealService.updateMealStatus(id, status);
      setMeals(meals.map(m => m.id === id ? { ...m, status } : m));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const filteredMeals = meals.filter(m => {
    if (filter !== 'ALL' && m.status !== filter) return false;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return (m.applicantName?.toLowerCase().includes(lower) || 
              m.roomNumber?.toLowerCase().includes(lower) ||
              m.mealDate?.includes(lower));
    }
    return true;
  });

  return (
    <div className="container">
      <div className="flex items-center gap-3 mb-6 pb-2" style={{ borderBottom: '2px solid var(--color-primary)' }}>
        <Coffee size={28} className="text-primary" />
        <h1 className="text-2xl font-bold">Manage Dining</h1>
      </div>

      <div className="card mb-6 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2 w-full max-w-md">
          <Search className="text-muted" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, room, or date..." 
            className="form-input" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-muted" size={20} />
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Meals</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="SERVED">Served</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '800px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3">ID</th>
              <th className="p-3">Applicant (Room)</th>
              <th className="p-3">Meal Info</th>
              <th className="p-3">Persons</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="text-center p-4">Loading meals...</td></tr>
            ) : filteredMeals.length === 0 ? (
              <tr><td colSpan="6" className="text-center p-4 text-muted">No meal requests found.</td></tr>
            ) : filteredMeals.map(meal => (
              <tr key={meal.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 text-sm font-bold text-primary">{meal.id}</td>
                <td className="p-3 text-sm">
                  <div className="font-bold">{meal.applicantName}</div>
                  <div className="text-xs text-muted">Room: {meal.roomNumber}</div>
                </td>
                <td className="p-3 text-sm">
                  <div className="font-bold">{meal.mealType}</div>
                  <div className="text-xs text-muted">{meal.mealDate}</div>
                </td>
                <td className="p-3 text-sm">{meal.persons}</td>
                <td className="p-3 text-sm">
                  <span className={`badge ${
                    meal.status === 'APPROVED' || meal.status === 'SERVED' ? 'badge-success' : 
                    meal.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {meal.status}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    {meal.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleUpdateStatus(meal.id, 'APPROVED')} className="btn btn-success p-1" title="Approve">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleUpdateStatus(meal.id, 'REJECTED')} className="btn btn-danger p-1" title="Reject">
                          <X size={16} />
                        </button>
                      </>
                    )}
                    {meal.status === 'APPROVED' && (
                      <button onClick={() => handleUpdateStatus(meal.id, 'SERVED')} className="btn btn-primary p-1 text-xs px-2">
                        Mark Served
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
