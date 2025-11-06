import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import VendorSidebar from './components/VendorSidebar/VendorSidebar';
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
import '@fortawesome/fontawesome-free/css/all.min.css';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import VendorRegister from './pages/Auth/VendorRegister';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Otp from './pages/Auth/Otp';
import ResetPassword from './pages/Auth/ResetPassword';
import VendorSubmitted from './pages/Auth/VendorSubmitted';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppContent = () => {
  const location = useLocation();
  const isVendorRoute = location.pathname.startsWith('/vendor') && !['/vendor/register', '/vendor/submitted'].includes(location.pathname);
  const hideNavbar = location.pathname === '/venue-designer' || location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/vendor/register' || location.pathname === '/vendor/submitted' || location.pathname === '/forgot-password' || location.pathname === '/otp' || location.pathname === '/reset-password';

  return (
    <div className="App">
      {isVendorRoute ? (
        <div className="vendor-layout">
          <VendorSidebar />
          <div className="vendor-content">
            <Routes>
              <Route path="/vendor/dashboard" element={<VendorDashboard />} />
              <Route path="/vendor/booking-requests" element={<BookingRequests />} />
              <Route path="/vendor/listings" element={<ManageListings />} />
              {/* Add other vendor routes here */}
            </Routes>
          </div>
        </div>
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
              <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/create-project" element={<CreateProject />} />
              <Route path="/project-dashboard" element={<ProjectDashboard />} />
              <Route path="/budget" element={<BudgetManagement />} />
              <Route path="/checklist" element={<ChecklistPage />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/venue-designer" element={<VenueDesigner />} />
              <Route path="/payments" element={<PaymentManagement />} />
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
