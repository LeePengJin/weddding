import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home/Home';
import Projects from './pages/Projects/Projects';
import CreateProject from './pages/CreateProject/CreateProject';
import ProjectDashboard from './pages/ProjectDashboard/ProjectDashboard';
import BudgetManagement from './pages/BudgetManagement/BudgetManagement';
import ChecklistPage from './pages/ChecklistPage/ChecklistPage';
import Messages from './pages/Messages/Messages';
import VenueDesigner from './pages/VenueDesigner/VenueDesigner';
import PaymentManagement from './pages/PaymentManagement/PaymentManagement';
import VendorDashboard from './pages/VendorDashboard/VendorDashboard';
import BookingRequests from './pages/BookingRequests/BookingRequests';
import ManageListings from './pages/ManageListings/ManageListings';
import ManageDesignElements from './pages/ManageDesignElements/ManageDesignElements';
import AvailabilityManagement from './pages/AvailabilityManagement/AvailabilityManagement';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import VendorRegister from './pages/Auth/VendorRegister';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Otp from './pages/Auth/Otp';
import ResetPassword from './pages/Auth/ResetPassword';
import VendorSubmitted from './pages/Auth/VendorSubmitted';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminLayout from './admin/components/layout/AdminLayout';
import Dashboard from './admin/pages/Dashboard';
import Vendors from './admin/pages/Vendors';
import VendorLayout from './vendor/components/layout/VendorLayout';
import Profile from './pages/Profile/Profile';
import VendorProfile from './pages/VendorProfile/VendorProfile';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppContent = () => {
  const location = useLocation();
  const isVendorRoute = location.pathname.startsWith('/vendor') && !['/vendor/register', '/vendor/submitted'].includes(location.pathname);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isVenueDesignerRoute =
    location.pathname === '/venue-designer' || location.pathname.includes('/venue-designer');
  const hideNavbar =
    isVenueDesignerRoute ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/vendor/register' ||
    location.pathname === '/vendor/submitted' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/otp' ||
    location.pathname === '/reset-password' ||
    isAdminRoute;

  return (
    <div className="App">
      {isVendorRoute ? (
        <Routes>
          <Route path="/vendor/dashboard" element={<VendorLayout><VendorDashboard /></VendorLayout>} />
          <Route path="/vendor/booking-requests" element={<VendorLayout><BookingRequests /></VendorLayout>} />
          <Route path="/vendor/availability" element={<VendorLayout><AvailabilityManagement /></VendorLayout>} />
          <Route path="/vendor/listings" element={<VendorLayout><ManageListings /></VendorLayout>} />
          <Route path="/vendor/design-elements" element={<VendorLayout><ManageDesignElements /></VendorLayout>} />
          <Route path="/vendor/profile" element={<VendorLayout><VendorProfile /></VendorLayout>} />
        </Routes>
      ) : (
        <>
          {!hideNavbar && <Navbar />}
          <main>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/vendor/register" element={<VendorRegister />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/otp" element={<Otp />} />
              <Route path="/vendor/submitted" element={<VendorSubmitted />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
              <Route path="/admin/vendors" element={<AdminLayout><Vendors /></AdminLayout>} />
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
              <Route path="/create-project" element={<RequireAuth><CreateProject /></RequireAuth>} />
              <Route path="/project-dashboard" element={<RequireAuth><ProjectDashboard /></RequireAuth>} />
              <Route path="/budget" element={<RequireAuth><BudgetManagement /></RequireAuth>} />
              <Route path="/checklist" element={<RequireAuth><ChecklistPage /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
              <Route path="/venue-designer" element={<RequireAuth><VenueDesigner /></RequireAuth>} />
              <Route path="/projects/:projectId/venue-designer" element={<RequireAuth><VenueDesigner /></RequireAuth>} />
              <Route path="/payments" element={<RequireAuth><PaymentManagement /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            </Routes>
          </main>
        </>
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null; // or a spinner
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
