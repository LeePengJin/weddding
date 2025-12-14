import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PaymentIcon from '@mui/icons-material/Payment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Statistics
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCouples: 0,
    totalVendors: 0,
    activeVendors: 0,
    pendingVendors: 0,
    totalBookings: 0,
    totalRevenue: 0,
    recentBookings: 0,
  });

  // Data for charts
  const [revenueData, setRevenueData] = useState([]);
  const [bookingsData, setBookingsData] = useState([]);
  const [userGrowthData, setUserGrowthData] = useState([]);

  // Lists
  const [pendingVendors, setPendingVendors] = useState([]);
  const [activeVendorsList, setActiveVendorsList] = useState([]);
  const [topVendors, setTopVendors] = useState([]);
  
  // Approval confirmation dialog
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState(null);

  useEffect(() => {
    apiFetch('/admin/auth/me').catch(() => navigate('/admin/login'));
  }, [navigate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = dayjs();
        const thirtyDaysAgo = now.subtract(30, 'day');
        const params = new URLSearchParams({
          startDate: thirtyDaysAgo.format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
          granularity: 'daily',
        });

        // Fetch all dashboard data in parallel
        const [
          vendorsPendingRes,
          vendorsActiveRes,
          accountsAllRes,
          accountsCouplesRes,
          accountsVendorsRes,
          summaryRes,
          revenueRes,
          bookingsRes,
          userGrowthRes,
          topVendorsRes,
        ] = await Promise.all([
          apiFetch('/admin/vendors?status=pending_verification&limit=5'),
          apiFetch('/admin/vendors?status=active&limit=10'),
          apiFetch('/admin/accounts?limit=1'), // Just to get total count
          apiFetch('/admin/accounts?role=couple&limit=1'), // Just to get couples count
          apiFetch('/admin/accounts?role=vendor&limit=1'), // Just to get vendors count
          apiFetch(`/admin/reports/summary?${params}`),
          apiFetch(`/admin/reports/revenue-over-time?${params}`),
          apiFetch(`/admin/reports/bookings-over-time?${params}`),
          apiFetch(`/admin/reports/user-growth?${params}`),
          apiFetch(`/admin/reports/top-vendors-by-revenue?${params}&limit=5`),
        ]);

        // Process vendor data
        const pending = vendorsPendingRes?.data || [];
        const active = vendorsActiveRes?.data || [];
        setPendingVendors(Array.isArray(pending) ? pending : []);
        setActiveVendorsList(Array.isArray(active) ? active : []);

        // Process accounts to get user counts
        const totalUsers = accountsAllRes?.pagination?.total || 0;
        const totalCouples = accountsCouplesRes?.pagination?.total || 0;
        const totalVendors = accountsVendorsRes?.pagination?.total || 0;

        // Process summary
        const summary = summaryRes?.data || {};
        
        // Process chart data
        setRevenueData(revenueRes?.data || []);
        setBookingsData(bookingsRes?.data || []);
        setUserGrowthData(userGrowthRes?.data || []);

        // Process top vendors
        setTopVendors(topVendorsRes?.data || []);

        // Set statistics
        setStats({
          totalUsers,
          totalCouples,
          totalVendors,
          activeVendors: Array.isArray(active) ? active.length : 0,
          pendingVendors: pending.length,
          totalBookings: summary.totalBookings || 0,
          totalRevenue: summary.totalRevenue || 0,
          recentBookings: 0,
        });
      } catch (err) {
        console.error('Dashboard data fetch failed', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const handleApproveClick = (userId) => {
    setApprovingUserId(userId);
    setApproveDialogOpen(true);
  };

  const handleApproveCancel = () => {
    setApproveDialogOpen(false);
    setApprovingUserId(null);
  };

  const handleApproveVendor = async () => {
    if (!approvingUserId) return;
    
    try {
      await apiFetch(`/admin/vendors/${approvingUserId}/approve`, { method: 'POST' });
      handleApproveCancel();
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Failed to approve vendor', err);
      setError(err.message || 'Failed to approve vendor');
      handleApproveCancel();
    }
  };

  const handleRejectVendor = async (userId) => {
    try {
      await apiFetch(`/admin/vendors/${userId}/reject`, { 
        method: 'POST',
        body: JSON.stringify({ reason: 'Rejected from dashboard' })
      });
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Failed to reject vendor', err);
      setError(err.message || 'Failed to reject vendor');
    }
  };

  // Calculate trends (comparing last 15 days vs previous 15 days)
  const revenueTrend = useMemo(() => {
    if (revenueData.length < 2) return 0;
    const recent = revenueData.slice(-15).reduce((sum, item) => sum + item.revenue, 0);
    const previous = revenueData.slice(0, 15).reduce((sum, item) => sum + item.revenue, 0);
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  }, [revenueData]);

  const bookingsTrend = useMemo(() => {
    if (bookingsData.length < 2) return 0;
    const recent = bookingsData.slice(-15).reduce((sum, item) => sum + item.count, 0);
    const previous = bookingsData.slice(0, 15).reduce((sum, item) => sum + item.count, 0);
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  }, [bookingsData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 700, 
            color: '#111827', 
            fontSize: '28px',
            letterSpacing: '-0.02em'
          }}
        >
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AssessmentIcon />}
          component={Link}
          to="/admin/reports"
          sx={{
            backgroundColor: '#111827',
            color: '#fff',
            textTransform: 'none',
            fontSize: '14px',
            px: 2,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            '&:hover': {
              backgroundColor: '#1f2937',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }
          }}
        >
          View Reports
        </Button>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3, 
            borderRadius: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b'
          }} 
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: 500,
                      mb: 1
                    }}
                  >
                    Total Users
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 700,
                      color: '#111827',
                      fontSize: '28px',
                      lineHeight: 1.2
                    }}
                  >
                    {stats.totalUsers}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PeopleAltIcon sx={{ fontSize: 24, color: '#3b82f6' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                  {stats.totalCouples} couples
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                  {stats.totalVendors} vendors
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: 500,
                      mb: 1
                    }}
                  >
                    Total Revenue (30d)
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 700,
                      color: '#111827',
                      fontSize: '28px',
                      lineHeight: 1.2
                    }}
                  >
                    RM {stats.totalRevenue.toFixed(2)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: '#d1fae5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PaymentIcon sx={{ fontSize: 24, color: '#10b981' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                {revenueTrend >= 0 ? (
                  <>
                    <TrendingUpIcon sx={{ fontSize: 16, color: '#10b981', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#10b981', fontSize: '13px', fontWeight: 500 }}>
                      {Math.abs(revenueTrend).toFixed(1)}% vs previous
                    </Typography>
                  </>
                ) : (
                  <>
                    <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#ef4444', fontSize: '13px', fontWeight: 500 }}>
                      {Math.abs(revenueTrend).toFixed(1)}% vs previous
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: 500,
                      mb: 1
                    }}
                  >
                    Total Bookings (30d)
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 700,
                      color: '#111827',
                      fontSize: '28px',
                      lineHeight: 1.2
                    }}
                  >
                    {stats.totalBookings}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                {bookingsTrend >= 0 ? (
                  <>
                    <TrendingUpIcon sx={{ fontSize: 16, color: '#10b981', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#10b981', fontSize: '13px', fontWeight: 500 }}>
                      {Math.abs(bookingsTrend).toFixed(1)}% vs previous
                    </Typography>
                  </>
                ) : (
                  <>
                    <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#ef4444', fontSize: '13px', fontWeight: 500 }}>
                      {Math.abs(bookingsTrend).toFixed(1)}% vs previous
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: 500,
                      mb: 1
                    }}
                  >
                    Pending Vendors
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 700,
                      color: '#111827',
                      fontSize: '28px',
                      lineHeight: 1.2
                    }}
                  >
                    {stats.pendingVendors}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StorefrontIcon sx={{ fontSize: 24, color: '#ef4444' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  to="/admin/vendors"
                  sx={{ 
                    textTransform: 'none',
                    fontSize: '12px',
                    borderColor: '#e5e7eb',
                    color: '#374151',
                    '&:hover': {
                      borderColor: '#d1d5db',
                      backgroundColor: '#f9fafb'
                    }
                  }}
                >
                  Review Now
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Charts and Lists */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        {/* Revenue Chart */}
        <Box sx={{ flex: '1 1 48%', minWidth: '400px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 3, 
                  color: '#111827',
                  fontSize: '18px'
                }}
              >
                Revenue Trend (Last 30 Days)
              </Typography>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="#9ca3af"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickFormatter={(value) => `RM${value}`}
                    />
                    <Tooltip
                      formatter={(value) => [`RM ${value.toFixed(2)}`, 'Revenue']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: '#6b7280', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No revenue data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Bookings Chart */}
        <Box sx={{ flex: '1 1 48%', minWidth: '400px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 3, 
                  color: '#111827',
                  fontSize: '18px'
                }}
              >
                Bookings Trend (Last 30 Days)
              </Typography>
              {bookingsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={bookingsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="#9ca3af"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: '#6b7280', fontSize: '12px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ fill: '#6366f1', r: 3 }}
                      name="Bookings"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No bookings data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Action Items and Lists */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Pending Vendors */}
        <Box sx={{ flex: '1 1 32%', minWidth: '300px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#111827',
                    fontSize: '18px'
                  }}
                >
                  Pending Vendor Verifications
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/admin/vendors"
                  sx={{ 
                    textTransform: 'none',
                    fontSize: '12px',
                    color: '#6366f1'
                  }}
                >
                  View All
                </Button>
              </Box>
              {pendingVendors.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No pending vendors
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {pendingVendors.slice(0, 5).map((vendor, idx) => (
                    <React.Fragment key={vendor.id}>
                      <ListItem 
                        sx={{ 
                          px: 0,
                          py: 1.5,
                          '&:hover': {
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px'
                          }
                        }}
                        secondaryAction={
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => handleApproveClick(vendor.id)}
                              sx={{ 
                                color: '#10b981',
                                '&:hover': { backgroundColor: '#d1fae5' }
                              }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleRejectVendor(vendor.id)}
                              sx={{ 
                                color: '#ef4444',
                                '&:hover': { backgroundColor: '#fee2e2' }
                              }}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        }
                      >
                        <ListItemText
                          primary={
                            <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                              {vendor.name || vendor.email}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                              {vendor.vendor?.category || 'N/A'} • {dayjs(vendor.createdAt).format('MMM D, YYYY')}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < pendingVendors.slice(0, 5).length - 1 && <Divider sx={{ borderColor: '#e5e7eb' }} />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Active Vendors */}
        <Box sx={{ flex: '1 1 32%', minWidth: '300px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#111827',
                    fontSize: '18px'
                  }}
                >
                  Active Vendors
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/admin/vendors"
                  sx={{ 
                    textTransform: 'none',
                    fontSize: '12px',
                    color: '#6366f1'
                  }}
                >
                  View All
                </Button>
              </Box>
              {activeVendorsList.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No active vendors
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {activeVendorsList.slice(0, 5).map((vendor, idx) => (
                    <React.Fragment key={vendor.id}>
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemText
                          primary={
                            <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                              {vendor.name || vendor.email}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                              {vendor.vendor?.category || 'N/A'} • {dayjs(vendor.updatedAt || vendor.createdAt).format('MMM D, YYYY')}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < activeVendorsList.slice(0, 5).length - 1 && <Divider sx={{ borderColor: '#e5e7eb' }} />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Top Vendors */}
        <Box sx={{ flex: '1 1 32%', minWidth: '300px' }}>
          <Card
            sx={{
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 2, 
                  color: '#111827',
                  fontSize: '18px'
                }}
              >
                Top Performing Vendors
              </Typography>
              {topVendors.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No vendor data available
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {topVendors.map((vendor, idx) => (
                    <React.Fragment key={vendor.id}>
                      <ListItem 
                        sx={{ 
                          px: 0,
                          py: 1.5,
                        }}
                        secondaryAction={
                          <Chip 
                            label={`RM ${vendor.revenue.toFixed(0)}`} 
                            size="small"
                            sx={{
                              fontSize: '11px',
                              height: '20px',
                              backgroundColor: '#f3f4f6',
                              color: '#374151',
                              fontWeight: 600,
                            }}
                          />
                        }
                      >
                        <ListItemText
                          primary={
                            <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                              {vendor.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                              {vendor.bookings || 0} bookings
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < topVendors.length - 1 && <Divider sx={{ borderColor: '#e5e7eb' }} />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Quick Actions */}
      <Card
        sx={{
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          mt: 3,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600, 
              mb: 3, 
              color: '#111827',
              fontSize: '18px'
            }}
          >
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<AssignmentIcon />}
              component={Link}
              to="/admin/vendors"
              sx={{ 
                textTransform: 'none',
                borderColor: '#e5e7eb',
                color: '#374151',
                '&:hover': {
                  borderColor: '#d1d5db',
                  backgroundColor: '#f9fafb'
                }
              }}
            >
              Review Pending Vendors
            </Button>
            <Button
              variant="outlined"
              startIcon={<LocalOfferIcon />}
              component={Link}
              to="/admin/packages"
              sx={{ 
                textTransform: 'none',
                borderColor: '#e5e7eb',
                color: '#374151',
                '&:hover': {
                  borderColor: '#d1d5db',
                  backgroundColor: '#f9fafb'
                }
              }}
            >
              Manage Packages
            </Button>
            <Button
              variant="outlined"
              startIcon={<AccountCircleIcon />}
              component={Link}
              to="/admin/accounts"
              sx={{ 
                textTransform: 'none',
                borderColor: '#e5e7eb',
                color: '#374151',
                '&:hover': {
                  borderColor: '#d1d5db',
                  backgroundColor: '#f9fafb'
                }
              }}
            >
              Account Management
            </Button>
            <Button
              variant="outlined"
              startIcon={<PaymentIcon />}
              component={Link}
              to="/admin/vendor-payment"
              sx={{ 
                textTransform: 'none',
                borderColor: '#e5e7eb',
                color: '#374151',
                '&:hover': {
                  borderColor: '#d1d5db',
                  backgroundColor: '#f9fafb'
                }
              }}
            >
              Vendor Payments
            </Button>
            <Button
              variant="outlined"
              startIcon={<AssessmentIcon />}
              component={Link}
              to="/admin/reports"
              sx={{ 
                textTransform: 'none',
                borderColor: '#e5e7eb',
                color: '#374151',
                '&:hover': {
                  borderColor: '#d1d5db',
                  backgroundColor: '#f9fafb'
                }
              }}
            >
              View Reports
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onClose={handleApproveCancel} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#059669' }}>
          Confirm Vendor Approval
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, color: '#4b5563' }}>
            Are you sure you want to approve this vendor account? Once approved, the vendor will be able to:
          </Typography>
          <List dense sx={{ mb: 2 }}>
            <ListItem sx={{ px: 0 }}>
              <ListItemText primary="• Log in to their vendor account" />
            </ListItem>
            <ListItem sx={{ px: 0 }}>
              <ListItemText primary="• Create and manage service listings" />
            </ListItem>
            <ListItem sx={{ px: 0 }}>
              <ListItemText primary="• Receive booking requests from couples" />
            </ListItem>
          </List>
          {approvingUserId && (() => {
            const vendor = pendingVendors.find((v) => v.id === approvingUserId);
            return vendor ? (
              <Typography variant="body2" sx={{ color: '#6b7280', fontStyle: 'italic' }}>
                Vendor: {vendor.name || vendor.email}
              </Typography>
            ) : null;
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleApproveCancel} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleApproveVendor} variant="contained" color="success" sx={{ ml: 1 }}>
            Confirm Approval
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
