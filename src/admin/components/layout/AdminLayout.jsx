import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar } from '@mui/material';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import UserAvatar from '../../../components/UserAvatar/UserAvatar';
import './AdminLayout.css';

const drawerWidth = 213;

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const onLogout = async () => {
    try {
      await apiFetch('/admin/auth/logout', { method: 'POST' });
    } catch {}
    navigate('/admin/login');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: 'https://www.figma.com/api/mcp/asset/2e132df0-c9c2-46c2-92aa-cd94095244a1',
    },
    {
      label: 'Vendor Verification',
      path: '/admin/vendors',
      icon: 'https://www.figma.com/api/mcp/asset/4f315dc4-7386-4251-9342-19e8fa3f6950',
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
        <Box className="admin-sidebar-content">
          {/* Logo */}
          <Box className="admin-sidebar-header">
            <Box className="admin-logo-icon">
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
            <Box className="admin-logo-text">Weddding</Box>
          </Box>

          {/* Divider */}
          <Box className="admin-sidebar-divider">
            <img src="https://www.figma.com/api/mcp/asset/38fa94e3-ae67-49b8-b8dd-8a452be60b35" alt="" />
          </Box>

          {/* Menu Items */}
          <Box className="admin-sidebar-nav">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <Box className="admin-nav-icon">
                  <img src={item.icon} alt="" />
                </Box>
                <Box className="admin-nav-label">{item.label}</Box>
              </Link>
            ))}

            {/* Logout */}
            <Box className="admin-nav-item admin-logout-item" onClick={onLogout}>
              <Box className="admin-nav-icon">
                <img src="https://www.figma.com/api/mcp/asset/76d764b2-eb08-4515-a5c8-e21a6d6d6ed0" alt="" />
              </Box>
              <Box className="admin-nav-label">Logout</Box>
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
              onClick={() => navigate('/admin/profile')}
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
