import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  EventNote as EventNoteIcon,
  EventAvailable as EventAvailableIcon,
  List as ListIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';
import UserAvatar from '../../../components/UserAvatar/UserAvatar';
import './VendorLayout.css';

const drawerWidth = 213;

export default function VendorLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/vendor/dashboard',
      icon: DashboardIcon,
      isSvg: false,
    },
    {
      label: 'Booking Requests',
      path: '/vendor/booking-requests',
      icon: EventNoteIcon,
      isSvg: false,
    },
    {
      label: 'Availability',
      path: '/vendor/availability',
      icon: EventAvailableIcon,
      isSvg: false,
    },
    {
      label: 'Manage Listings',
      path: '/vendor/listings',
      icon: ListIcon,
      isSvg: false,
    },
    {
      label: 'Design Elements',
      path: '/vendor/design-elements',
      icon: 'design-elements',
      isSvg: true,
    },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f6fa' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #d9d9d9',
            borderTop: 'none',
            borderBottom: 'none',
            borderLeft: 'none',
            overflow: 'hidden',
          },
        }}
      >
        <Box className="vendor-sidebar-content">
          {/* Logo */}
          <Box className="vendor-sidebar-header">
            <Box className="vendor-logo-icon">
              <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M16.1111 3C19.6333 3 22 6.3525 22 9.48C22 15.8138 12.1778 21 12 21C11.8222 21 2 15.8138 2 9.48C2 6.3525 4.36667 3 7.88889 3C9.91111 3 11.2333 4.02375 12 4.92375C12.7667 4.02375 14.0889 3 16.1111 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Box>
            <Box className="vendor-logo-text">Weddding</Box>
          </Box>

          {/* Divider */}
          <Box className="vendor-sidebar-divider">
            <Box sx={{ width: '100%', height: '1px', backgroundColor: '#d9d9d9' }} />
          </Box>

          {/* Menu Items */}
          <Box className="vendor-sidebar-nav">
            {menuItems.map((item) => {
              if (item.isSvg && item.icon === 'design-elements') {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`vendor-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <Box className="vendor-nav-icon">
                      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2.50008V12.0001M12 12.0001L20.5 7.27779M12 12.0001L3.5 7.27779M12 12.0001V21.5001M20.5 16.7223L12.777 12.4318C12.4934 12.2742 12.3516 12.1954 12.2015 12.1645C12.0685 12.1372 11.9315 12.1372 11.7986 12.1645C11.6484 12.1954 11.5066 12.2742 11.223 12.4318L3.5 16.7223M21 16.0586V7.94153C21 7.59889 21 7.42757 20.9495 7.27477C20.9049 7.13959 20.8318 7.01551 20.7354 6.91082C20.6263 6.79248 20.4766 6.70928 20.177 6.54288L12.777 2.43177C12.4934 2.27421 12.3516 2.19543 12.2015 2.16454C12.0685 2.13721 11.9315 2.13721 11.7986 2.16454C11.6484 2.19543 11.5066 2.27421 11.223 2.43177L3.82297 6.54288C3.52345 6.70928 3.37369 6.79248 3.26463 6.91082C3.16816 7.01551 3.09515 7.13959 3.05048 7.27477C3 7.42757 3 7.59889 3 7.94153V16.0586C3 16.4013 3 16.5726 3.05048 16.7254C3.09515 16.8606 3.16816 16.9847 3.26463 17.0893C3.37369 17.2077 3.52345 17.2909 3.82297 17.4573L11.223 21.5684C11.5066 21.726 11.6484 21.8047 11.7986 21.8356C11.9315 21.863 12.0685 21.863 12.2015 21.8356C12.3516 21.8047 12.4934 21.726 12.777 21.5684L20.177 17.4573C20.4766 17.2909 20.6263 17.2077 20.7354 17.0893C20.8318 16.9847 20.9049 16.8606 20.9495 16.7254C21 16.5726 21 16.4013 21 16.0586Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Box>
                    <Box className="vendor-nav-label">{item.label}</Box>
                  </Link>
                );
              }
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`vendor-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <Box className="vendor-nav-icon">
                    <IconComponent sx={{ fontSize: '15px', color: 'inherit' }} />
                  </Box>
                  <Box className="vendor-nav-label">{item.label}</Box>
                </Link>
              );
            })}

            {/* Logout */}
            <Box className="vendor-nav-item vendor-logout-item" onClick={handleLogout}>
              <Box className="vendor-nav-icon">
                <LogoutIcon sx={{ fontSize: '15px', color: 'inherit' }} />
              </Box>
              <Box className="vendor-nav-label">Logout</Box>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <AppBar
          position="sticky"
          sx={{
            backgroundColor: '#ffffff',
            color: '#000000',
            boxShadow: 'none',
            borderBottom: '1px solid #d9d9d9',
            height: '54px',
            top: 0,
            zIndex: 1100,
          }}
        >
          <Toolbar sx={{ minHeight: '54px !important', justifyContent: 'flex-end', paddingX: 2 }}>
            <UserAvatar
              user={user}
              size={35}
              onClick={() => navigate('/vendor/profile')}
            />
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flexGrow: 1, backgroundColor: '#f5f6fa', padding: '10px 20px' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

