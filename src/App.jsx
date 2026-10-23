import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/layout/Layout';
import RoleGuard from './components/layout/RoleGuard';

// Public Pages
import Home from './pages/public/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import BookingForm from './pages/student/BookingForm';
import RoomAvailability from './pages/student/RoomAvailability';
import BookingHistory from './pages/student/BookingHistory';
import PaymentPage from './pages/student/PaymentPage';
import Notifications from './pages/student/Notifications';
import BookingSuccess from './pages/student/BookingSuccess';
import StudentProfile from './pages/student/StudentProfile';
import Complaints from './pages/student/Complaints';
import BookMeal from './pages/shared/BookMeal';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import ManageBookings from './pages/admin/ManageBookings';
import ManageRooms from './pages/admin/ManageRooms';
import ManagePayments from './pages/admin/ManagePayments';
import ManageUsers from './pages/admin/ManageUsers';
import AdminProfile from './pages/admin/AdminProfile';
import ManageComplaints from './pages/admin/ManageComplaints';
import ManageMeals from './pages/admin/ManageMeals';

// Teacher Pages
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherManageApplications from './pages/teacher/ManageApplications';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
