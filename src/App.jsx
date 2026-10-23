import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Layout from './components/layout/Layout';
import RoleGuard from './components/layout/RoleGuard';
import { API_BASE_URL } from './config/api';

// Public Pages (Home loaded eagerly for instant landing paint)
import Home from './pages/public/Home';
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));

// Student Pages (Lazy loaded)
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const BookingForm = lazy(() => import('./pages/student/BookingForm'));
const RoomAvailability = lazy(() => import('./pages/student/RoomAvailability'));
const BookingHistory = lazy(() => import('./pages/student/BookingHistory'));
const PaymentPage = lazy(() => import('./pages/student/PaymentPage'));
const Notifications = lazy(() => import('./pages/student/Notifications'));
const BookingSuccess = lazy(() => import('./pages/student/BookingSuccess'));
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'));
const Complaints = lazy(() => import('./pages/student/Complaints'));
const BookMeal = lazy(() => import('./pages/shared/BookMeal'));

// Admin Pages (Lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageBookings = lazy(() => import('./pages/admin/ManageBookings'));
const ManageRooms = lazy(() => import('./pages/admin/ManageRooms'));
const ManagePayments = lazy(() => import('./pages/admin/ManagePayments'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));
const ManageComplaints = lazy(() => import('./pages/admin/ManageComplaints'));
const ManageMeals = lazy(() => import('./pages/admin/ManageMeals'));

// Teacher Pages (Lazy loaded)
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'));
const TeacherManageApplications = lazy(() => import('./pages/teacher/ManageApplications'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--color-text-muted, #6b7280)' }}>
    <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-primary, #1e3a8a)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
);

function App() {
  // Pre-warm backend server silently in the background on initial app launch to avoid cold starts
  useEffect(() => {
    if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
      fetch(`${API_BASE_URL}/ping`, { method: 'GET' }).catch(() => {});
    }
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Admin and Teacher Login - separate for clarity */}
            <Route path="/admin/login" element={<Login isAdmin={true} />} />
            <Route path="/teacher/login" element={<Login isTeacher={true} />} />

            {/* Protected Student Routes */}
            <Route path="/student" element={<RoleGuard allowedRoles={['student']}><Outlet /></RoleGuard>}>
              <Route index element={<Navigate to="/student/dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="booking" element={<BookingForm />} />
              <Route path="rooms" element={<RoomAvailability />} />
              <Route path="history" element={<BookingHistory />} />
              <Route path="payment" element={<PaymentPage />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="booking-success" element={<BookingSuccess />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="meals" element={<BookMeal />} />
              <Route path="dining" element={<Navigate to="/student/meals" replace />} />
            </Route>

            {/* Protected Admin Routes */}
            <Route path="/admin" element={<RoleGuard allowedRoles={['admin']}><Outlet /></RoleGuard>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="bookings" element={<ManageBookings />} />
              <Route path="rooms" element={<ManageRooms />} />
              <Route path="payments" element={<ManagePayments />} />
              <Route path="users" element={<ManageUsers />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="complaints" element={<ManageComplaints />} />
              <Route path="meals" element={<ManageMeals />} />
              <Route path="dining" element={<Navigate to="/admin/meals" replace />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="booking-success" element={<BookingSuccess />} />
            </Route>

            {/* Protected Teacher Routes */}
            <Route path="/teacher" element={<RoleGuard allowedRoles={['teacher']}><Outlet /></RoleGuard>}>
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="applications" element={<TeacherManageApplications />} />
              <Route path="rooms" element={<RoomAvailability />} />
              <Route path="booking" element={<BookingForm />} />
              <Route path="history" element={<BookingHistory />} />
              <Route path="payment" element={<PaymentPage />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="booking-success" element={<BookingSuccess />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="meals" element={<BookMeal />} />
              <Route path="dining" element={<Navigate to="/teacher/meals" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
