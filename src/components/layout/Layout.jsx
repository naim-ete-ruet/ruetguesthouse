import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar toggleSidebar={toggleSidebar} />
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {user && <Sidebar isOpen={sidebarOpen} closeSidebar={closeSidebar} />}
        
        <main style={{ 
          flex: 1, 
          padding: 'var(--spacing-6)', 
          marginLeft: user ? '0' : '0',
          transition: 'margin var(--transition-normal)'
        }} className={user ? "main-content animate-fade-in" : "animate-fade-in"}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .main-content {
            margin-left: 250px !important;
          }
        }
      `}</style>
    </div>
  );
}
