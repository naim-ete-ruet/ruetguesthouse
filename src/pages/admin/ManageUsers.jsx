import { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { Search, Shield, User, UserX } from 'lucide-react';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await authService.getAllUsers();
      // Add a mock status field to users for UI purposes
      const usersWithStatus = data.map(u => ({ ...u, accountStatus: 'ACTIVE' }));
      setUsers(usersWithStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspend = (id) => {
    if (window.confirm("Are you sure you want to suspend this user? They will not be able to log in.")) {
      setUsers(users.map(u => u.id === id ? { ...u, accountStatus: 'SUSPENDED' } : u));
      alert("User suspended successfully");
    }
  };

  const handleActivate = (id) => {
    setUsers(users.map(u => u.id === id ? { ...u, accountStatus: 'ACTIVE' } : u));
  };

  const filteredUsers = users.filter(u => {
    const matchesFilter = filterRole === 'ALL' || u.role === filterRole;
    const searchString = `${u.name} ${u.email} ${u.rollNo || ''} ${u.mobile || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">Manage Users</h1>

      <div className="card mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <Search className="text-muted flex-shrink-0" size={20} />
          <input 
            type="text" 
            placeholder="Search by Name, Roll, or Email..." 
            className="form-input w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm font-medium text-muted flex-shrink-0">Role:</span>
          <select className="form-select w-full sm:w-auto" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="ALL">All Users</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="w-full text-left" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Contact Info</th>
              <th className="p-3 text-left">Registration Date</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="text-center p-4">Loading Users...</td></tr>
            ) : filteredUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="p-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                      {u.role === 'admin' ? <Shield size={18} /> : <User size={18} />}
                    </div>
                    <div>
                      <div className="font-bold">{u.name}</div>
                      {u.rollNo && <div className="text-xs text-muted">Roll: {u.rollNo}</div>}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-left text-sm">
                  <div>{u.email}</div>
                  <div className="text-muted">{u.mobile}</div>
                </td>
                <td className="p-3 text-left text-sm">
                  {u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="p-3 text-left">
                  <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-info'}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td className="p-3 text-left">
                  <span className={`badge ${u.accountStatus === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                    {u.accountStatus}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    {u.role !== 'admin' && (
                      u.accountStatus === 'ACTIVE' ? (
                        <button 
                          onClick={() => handleSuspend(u.id)} 
                          className="btn btn-danger" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
                        >
                          <UserX size={14} /> Suspend
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleActivate(u.id)} 
                          className="btn btn-success" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--color-success)', color: 'white' }}
                        >
                          <User size={14} /> Activate
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
            
            {!isLoading && filteredUsers.length === 0 && (
               <tr><td colSpan="6" className="text-center p-8 text-muted">No users found matching your criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
