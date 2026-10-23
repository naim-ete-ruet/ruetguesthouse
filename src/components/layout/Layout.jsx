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
          transition: 'margin var(--transition-normal)'
        }} className={user ? "main-content animate-fade-in" : "animate-fade-in"}>
          <Outlet />
        </main>
      </div>

      <style>{`
        .navbar {
          padding: 0.75rem 1rem;
        }
        main {
          padding: 1rem 0.625rem;
        }
        @media (min-width: 768px) {
          .navbar {
            padding: 1rem 1.5rem;
          }
          .main-content {
            margin-left: 250px !important;
            padding: 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}
