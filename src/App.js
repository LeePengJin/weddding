import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Header } from './components/Header/Header';
import Home from './pages/Home/Home';
import Projects from './pages/Projects/Projects';
import CreateProject from './pages/CreateProject/CreateProject';
import ProjectDashboard from './pages/ProjectDashboard/ProjectDashboard';
import BudgetManagement from './pages/BudgetManagement/BudgetManagement';
import ChecklistPage from './pages/ChecklistPage/ChecklistPage';
import Messages from './pages/Messages/Messages';
import VenueDesigner from './pages/VenueDesigner/VenueDesigner';
import MyBookings from './pages/MyBookings/MyBookings';
import PaymentCenter from './pages/PaymentCenter/PaymentCenter';
import BookedSuppliers from './pages/BookedSuppliers/BookedSuppliers';
import Payment from './pages/Payment/Payment';
import VendorDashboard from './pages/VendorDashboard/VendorDashboard';
import BookingRequests from './pages/BookingRequests/BookingRequests';
import ManageListings from './pages/ManageListings/ManageListings';
import ManageDesignElements from './pages/ManageDesignElements/ManageDesignElements';
import AvailabilityManagement from './pages/AvailabilityManagement/AvailabilityManagement';
import VenueFloorplanEditor from './pages/VenueFloorplanEditor/VenueFloorplanEditor';
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
import AccountManagement from './admin/pages/AccountManagement';
import PackageManagement from './admin/pages/PackageManagement';
import VendorPayment from './admin/pages/VendorPayment';
import RefundsAndCancellations from './admin/pages/RefundsAndCancellations';
import VendorLayout from './vendor/components/layout/VendorLayout';
import Profile from './pages/Profile/Profile';
import VendorProfile from './pages/VendorProfile/VendorProfile';
import VendorPayments from './pages/VendorPayments/VendorPayments';
import VendorReports from './pages/VendorReports/VendorReports';
import AdminReports from './pages/AdminReports/AdminReports';
import NotFound from './pages/NotFound/NotFound';
import About from './pages/About/About';
import Features from './pages/Features/Features';
import FAQ from './pages/FAQ/FAQ';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';

// Component to redirect vendors to vendor messages route
const MessagesRedirect = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (user?.role === 'vendor') {
    const searchParams = new URLSearchParams(location.search);
    const conversationId = searchParams.get('conversationId');
    const redirectPath = conversationId 
      ? `/vendor/messages?conversationId=${conversationId}`
      : '/vendor/messages';
    return <Navigate to={redirectPath} replace />;
  }
  
  return <Messages />;
};

const AppContent = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isVendorRoute = location.pathname.startsWith('/vendor') && !['/vendor/register', '/vendor/submitted'].includes(location.pathname);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isVenueDesignerRoute =
    location.pathname === '/venue-designer' || location.pathname.includes('/venue-designer');
  const isMessagesRoute = location.pathname === '/messages';
  const isVendorUser = user?.role === 'vendor';
  
  // Hide navbar for vendors on messages page, or for normal hide conditions
  const hideNavbar =
    isVenueDesignerRoute ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/vendor/register' ||
    location.pathname === '/vendor/submitted' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/otp' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/payment' ||
    isAdminRoute ||
    (isMessagesRoute && isVendorUser && !location.pathname.startsWith('/vendor')); // Hide navbar for vendors on messages page (but not when in vendor layout)

  return (
    <div className="App">
      {isVendorRoute ? (
        <Routes>
          <Route path="/vendor/dashboard" element={<RequireAuth requiredRole="vendor"><VendorLayout><VendorDashboard /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/booking-requests" element={<RequireAuth requiredRole="vendor"><VendorLayout><BookingRequests /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/availability" element={<RequireAuth requiredRole="vendor"><VendorLayout><AvailabilityManagement /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/listings" element={<RequireAuth requiredRole="vendor"><VendorLayout><ManageListings /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/design-elements" element={<RequireAuth requiredRole="vendor"><VendorLayout><ManageDesignElements /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/venue-floorplan/:listingId?" element={<RequireAuth requiredRole="vendor"><VendorLayout><VenueFloorplanEditor /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/profile" element={<RequireAuth requiredRole="vendor"><VendorLayout><VendorProfile /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/payments" element={<RequireAuth requiredRole="vendor"><VendorLayout><VendorPayments /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/reports" element={<RequireAuth requiredRole="vendor"><VendorLayout><VendorReports /></VendorLayout></RequireAuth>} />
          <Route path="/vendor/messages" element={<RequireAuth requiredRole="vendor"><VendorLayout><Messages /></VendorLayout></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      ) : (
        <>
          {!hideNavbar && <Header />}
          {/*
            Apply an offset only on authenticated/couple pages so the floating
            header doesn't overlap their content. Marketing pages (home/about/faq)
            remain flush with the viewport.
          */}
          <main
            style={
              !hideNavbar &&
              !isMessagesRoute &&
              !['/', '/about', '/faq', '/features'].includes(location.pathname)
                ? { paddingTop: '80px' }
                : {}
            }
          >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/vendor/register" element={<VendorRegister />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/otp" element={<Otp />} />
              <Route path="/vendor/submitted" element={<VendorSubmitted />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<About />} />
              <Route path="/features" element={<Features />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
              <Route path="/admin/vendors" element={<AdminLayout><Vendors /></AdminLayout>} />
              <Route path="/admin/packages" element={<AdminLayout><PackageManagement /></AdminLayout>} />
              <Route path="/admin/packages/:packageId/designer" element={<VenueDesigner />} />
              <Route path="/admin/accounts" element={<AdminLayout><AccountManagement /></AdminLayout>} />
              <Route path="/admin/vendor-payment" element={<AdminLayout><VendorPayment /></AdminLayout>} />
              <Route path="/admin/refunds-cancellations" element={<AdminLayout><RefundsAndCancellations /></AdminLayout>} />
              <Route path="/admin/reports" element={<AdminLayout><AdminReports /></AdminLayout>} />
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
              <Route path="/create-project" element={<RequireAuth><CreateProject /></RequireAuth>} />
              <Route path="/project-dashboard" element={<RequireAuth><ProjectDashboard /></RequireAuth>} />
              <Route path="/budget" element={<RequireAuth><BudgetManagement /></RequireAuth>} />
              <Route path="/checklist" element={<RequireAuth><ChecklistPage /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><MessagesRedirect /></RequireAuth>} />
              <Route path="/venue-designer" element={<RequireAuth><VenueDesigner /></RequireAuth>} />
              <Route path="/projects/:projectId/venue-designer" element={<RequireAuth><VenueDesigner /></RequireAuth>} />
              <Route path="/my-bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
              <Route path="/payment-center" element={<RequireAuth><PaymentCenter /></RequireAuth>} />
              <Route path="/payment" element={<RequireAuth><Payment /></RequireAuth>} />
              <Route path="/booked-suppliers" element={<RequireAuth><BookedSuppliers /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
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
      <WebSocketProvider>
        <Router>
          <AppContent />
        </Router>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;

function RequireAuth({ children, requiredRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return null; // or a spinner
  if (!user) {
    // Store the attempted location to redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check role if required
  if (requiredRole && user.role !== requiredRole) {
    // Redirect to appropriate dashboard based on user role
    if (user.role === 'vendor') {
      return <Navigate to="/vendor/dashboard" replace />;
    } else if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }
  
  return children;
}
