import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, IconButton, Tooltip } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  VerifiedUser as VerifiedUserIcon,
  Logout as LogoutIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Payment as PaymentIcon,
  Assessment as AssessmentIcon,
  Cancel as CancelIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import UserAvatar from '../../../components/UserAvatar/UserAvatar';
import './AdminLayout.css';

const drawerWidth = 213;
const collapsedDrawerWidth = 80;

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const onLogout = async () => {
    try {
      await apiFetch('/admin/auth/logout', { method: 'POST' });
    } catch {}
    navigate('/admin/login');
  };

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: DashboardIcon,
    },
    {
      label: 'Vendor Verification',
      path: '/admin/vendors',
      icon: VerifiedUserIcon,
    },
    {
      label: 'Package Management',
      path: '/admin/packages',
      icon: InventoryIcon,
    },
    {
      label: 'Account Management',
      path: '/admin/accounts',
      icon: PeopleIcon,
    },
    {
      label: 'Vendor Payment',
      path: '/admin/vendor-payment',
      icon: PaymentIcon,
    },
    {
      label: 'Refunds & Cancellations',
      path: '/admin/refunds-cancellations',
      icon: CancelIcon,
    },
    {
      label: 'Report',
      path: '/admin/reports',
      icon: AssessmentIcon,
    },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f6fa' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: collapsed ? collapsedDrawerWidth : drawerWidth,
          flexShrink: 0,
          transition: 'width 0.3s ease',
          [`& .MuiDrawer-paper`]: {
            width: collapsed ? collapsedDrawerWidth : drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #d9d9d9',
            borderTop: 'none',
            borderBottom: 'none',
            borderLeft: 'none',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
          },
        }}
      >
        <Box className="admin-sidebar-content" sx={{ padding: collapsed ? '10px' : '10px 20px' }}>
          {/* Logo */}
          <Box className="admin-sidebar-header" sx={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
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
            {!collapsed && <Box className="admin-logo-text">Weddding</Box>}
          </Box>

          {/* Divider */}
          {!collapsed && (
            <Box className="admin-sidebar-divider">
              <Box sx={{ width: '100%', height: '1px', backgroundColor: '#d9d9d9' }} />
            </Box>
          )}

          {/* Menu Items */}
          <Box className="admin-sidebar-nav">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const menuItem = (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px' : '10px',
                    maxWidth: collapsed ? '60px' : '193px',
                  }}
                >
                  <Box className="admin-nav-icon">
                    <IconComponent sx={{ fontSize: '15px', color: 'inherit' }} />
                  </Box>
                  {!collapsed && <Box className="admin-nav-label">{item.label}</Box>}
                </Link>
              );
              
              return collapsed ? (
                <Tooltip key={item.path} title={item.label} placement="right" arrow>
                  {menuItem}
                </Tooltip>
              ) : (
                menuItem
              );
            })}

            {/* Logout */}
            {collapsed ? (
              <Tooltip title="Logout" placement="right" arrow>
                <Box 
                  className="admin-nav-item admin-logout-item" 
                  onClick={onLogout}
                  sx={{
                    justifyContent: 'center',
                    padding: '10px',
                    maxWidth: '60px',
                  }}
                >
                  <Box className="admin-nav-icon">
                    <LogoutIcon sx={{ fontSize: '15px', color: 'inherit' }} />
                  </Box>
                </Box>
              </Tooltip>
            ) : (
              <Box className="admin-nav-item admin-logout-item" onClick={onLogout}>
                <Box className="admin-nav-icon">
                  <LogoutIcon sx={{ fontSize: '15px', color: 'inherit' }} />
                </Box>
                <Box className="admin-nav-label">Logout</Box>
              </Box>
            )}
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
          <Toolbar sx={{ minHeight: '54px !important', justifyContent: 'space-between', paddingX: 2 }}>
            <IconButton
              onClick={toggleSidebar}
              sx={{
                color: '#000000',
                padding: '8px',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <MenuIcon />
            </IconButton>
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
