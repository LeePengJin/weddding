import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar } from '@mui/material';
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
      icon: 'https://www.figma.com/api/mcp/asset/2e132df0-c9c2-46c2-92aa-cd94095244a1',
    },
    {
      label: 'Booking Requests',
      path: '/vendor/booking-requests',
      icon: 'https://www.figma.com/api/mcp/asset/4f315dc4-7386-4251-9342-19e8fa3f6950',
    },
    {
      label: 'Availability',
      path: '/vendor/availability',
      icon: 'https://www.figma.com/api/mcp/asset/6588c2b4-18b1-43cc-9f42-dcfad8aa0ed1',
    },
    {
      label: 'Manage Listings',
      path: '/vendor/listings',
      icon: 'https://www.figma.com/api/mcp/asset/a0149be4-7f80-44ab-b262-e8d6228fdb81',
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
            <img src="https://www.figma.com/api/mcp/asset/38fa94e3-ae67-49b8-b8dd-8a452be60b35" alt="" />
          </Box>

          {/* Menu Items */}
          <Box className="vendor-sidebar-nav">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`vendor-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <Box className="vendor-nav-icon">
                  <img src={item.icon} alt="" />
                </Box>
                <Box className="vendor-nav-label">{item.label}</Box>
              </Link>
            ))}

            {/* Logout */}
            <Box className="vendor-nav-item vendor-logout-item" onClick={handleLogout}>
              <Box className="vendor-nav-icon">
                <img src="https://www.figma.com/api/mcp/asset/76d764b2-eb08-4515-a5c8-e21a6d6d6ed0" alt="" />
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
          position="static"
          sx={{
            backgroundColor: '#ffffff',
            color: '#000000',
            boxShadow: 'none',
            borderBottom: '1px solid #d9d9d9',
            height: '54px',
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

