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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <Navbar toggleSidebar={toggleSidebar} />
      <div className="layout-content-wrapper" style={{ display: 'flex', flex: 1, position: 'relative', width: '100%', maxWidth: '100vw', minWidth: 0 }}>
        {user && <Sidebar isOpen={sidebarOpen} closeSidebar={closeSidebar} />}
        
        <main style={{ 
          flex: '1 1 auto',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
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
          min-width: 0;
          box-sizing: border-box;
        }
        .main-content {
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        @media (min-width: 768px) {
          .navbar {
            padding: 1rem 1.5rem;
          }
          .main-content {
            margin-left: 250px !important;
            width: calc(100% - 250px) !important;
            max-width: calc(100% - 250px) !important;
            min-width: 0 !important;
            padding: 1.5rem !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </div>
  );
}
