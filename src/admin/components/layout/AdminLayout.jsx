import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton, ListItemText, Button } from '@mui/material';
import { apiFetch } from '../../../lib/api';

const drawerWidth = 240;

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
    try {
      await apiFetch('/admin/auth/logout', { method: 'POST' });
    } catch {}
    navigate('/admin/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f6fa' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, backgroundColor: 'white', color: 'black', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Inline SVG logo from Figma */}
            <Box component="span" sx={{ display: 'inline-flex', width: 24, height: 24, color: '#e66d6c' }} aria-label="Weddding logo">
              <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M11.9932 5.13581C9.9938 2.7984 6.65975 2.16964 4.15469 4.31001C1.64964 6.45038 1.29697 10.029 3.2642 12.5604C4.89982 14.6651 9.84977 19.1041 11.4721 20.5408C11.6536 20.7016 11.7444 20.7819 11.8502 20.8135C11.9426 20.8411 12.0437 20.8411 12.1361 20.8135C12.2419 20.7819 12.3327 20.7016 12.5142 20.5408C14.1365 19.1041 19.0865 14.6651 20.7221 12.5604C22.6893 10.029 22.3797 6.42787 19.8316 4.31001C17.2835 2.19216 13.9925 2.7984 11.9932 5.13581Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Box>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
              Weddding Admin
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" size="small" onClick={onLogout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItemButton component={Link} to="/admin/dashboard" selected={location.pathname === '/admin/dashboard'}>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton component={Link} to="/admin/vendors" selected={location.pathname === '/admin/vendors'}>
              <ListItemText primary="Vendor Verification" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
