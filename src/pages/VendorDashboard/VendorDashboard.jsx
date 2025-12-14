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
import EventIcon from '@mui/icons-material/Event';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PaymentIcon from '@mui/icons-material/Payment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Statistics
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    activeListings: 0,
    totalListings: 0,
  });

  // Data for charts
  const [revenueData, setRevenueData] = useState([]);
  const [bookingsData, setBookingsData] = useState([]);

  // Lists
  const [recentBookings, setRecentBookings] = useState([]);
  const [topListings, setTopListings] = useState([]);


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
          bookingsRes,
          listingsRes,
          paymentsRes,
          revenueRes,
          bookingsChartRes,
          recentBookingsRes,
          topListingsRes,
        ] = await Promise.all([
          apiFetch('/bookings'),
          apiFetch('/service-listings'),
          apiFetch('/bookings/vendor/payments'),
          apiFetch(`/vendor/reports/revenue-over-time?${params}`),
          apiFetch(`/vendor/reports/bookings-over-time?${params}`),
          apiFetch('/bookings?limit=5'),
          apiFetch(`/vendor/reports/most-booked-listings?${params}&limit=5`),
        ]);

        // Process bookings
        const allBookings = bookingsRes || [];
        
        // Categorize bookings: pending, confirmed, completed
        const pendingBookings = allBookings.filter(b => 
          b.status === 'pending_vendor_confirmation'
        );
        const confirmedBookings = allBookings.filter(b => 
          ['confirmed', 'pending_deposit_payment', 'pending_final_payment'].includes(b.status)
        );
        const completedBookings = allBookings.filter(b => 
          b.status === 'completed'
        );

        // Process listings
        const listings = listingsRes || [];
        const activeListings = listings.filter(l => l.isActive);

        // Process chart data
        setRevenueData(revenueRes?.data || []);
        setBookingsData(bookingsChartRes?.data || []);

        // Process recent bookings
        const recent = (recentBookingsRes || []).slice(0, 5);
        setRecentBookings(recent);

        // Process top listings
        setTopListings(topListingsRes?.data || []);

        // Calculate total revenue from payment table (regardless of release status)
        let totalRevenue = 0;
        const payments = paymentsRes || [];
        payments.forEach(payment => {
          totalRevenue += parseFloat(payment.amount || 0);
        });

        // Set statistics
        setStats({
          totalBookings: allBookings.length,
          pendingBookings: pendingBookings.length,
          confirmedBookings: confirmedBookings.length,
          completedBookings: completedBookings.length,
          totalRevenue: totalRevenue,
          activeListings: activeListings.length,
          totalListings: listings.length,
        });
      } catch (err) {
        console.error('Dashboard data fetch failed', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate trends (comparing last 15 days vs previous 15 days)
  const revenueTrend = useMemo(() => {
    if (revenueData.length < 2) return 0;
    const recent = revenueData.slice(-15).reduce((sum, item) => sum + (item.revenue || 0), 0);
    const previous = revenueData.slice(0, 15).reduce((sum, item) => sum + (item.revenue || 0), 0);
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  }, [revenueData]);

  const bookingsTrend = useMemo(() => {
    if (bookingsData.length < 2) return 0;
    const recent = bookingsData.slice(-15).reduce((sum, item) => sum + (item.count || 0), 0);
    const previous = bookingsData.slice(0, 15).reduce((sum, item) => sum + (item.count || 0), 0);
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
          to="/vendor/reports"
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
                    backgroundColor: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EventIcon sx={{ fontSize: 24, color: '#3b82f6' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                  {stats.confirmedBookings} confirmed
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                  {stats.pendingBookings} pending
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                  {stats.completedBookings} completed
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
                    Pending Requests
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
                    {stats.pendingBookings}
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
                  <PendingIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  to="/vendor/booking-requests"
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
                    Active Listings
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
                    {stats.activeListings}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: '#e0e7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StorefrontIcon sx={{ fontSize: 24, color: '#6366f1' }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                  {stats.totalListings} total
                </Typography>
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
        {/* Recent Bookings */}
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
                  Recent Bookings
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/vendor/booking-requests"
                  sx={{ 
                    textTransform: 'none',
                    fontSize: '12px',
                    color: '#6366f1'
                  }}
                >
                  View All
                </Button>
              </Box>
              {recentBookings.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No recent bookings
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {recentBookings.map((booking, idx) => (
                    <Box key={booking.id}>
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
                          <Chip 
                            label={booking.status?.replace(/_/g, ' ')} 
                            size="small"
                            sx={{
                              fontSize: '10px',
                              height: '20px',
                              backgroundColor: 
                                booking.status === 'confirmed' ? '#d1fae5' :
                                booking.status === 'pending_vendor_confirmation' ? '#fef3c7' :
                                '#f3f4f6',
                              color: 
                                booking.status === 'confirmed' ? '#065f46' :
                                booking.status === 'pending_vendor_confirmation' ? '#92400e' :
                                '#374151',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          />
                        }
                      >
                        <ListItemText
                          primary={
                            <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                              {booking.couple?.user?.name || booking.couple?.name || 'Couple'}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                              {dayjs(booking.reservedDate || booking.createdAt).format('MMM D, YYYY')}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < recentBookings.length - 1 && <Divider sx={{ borderColor: '#e5e7eb' }} />}
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Top Performing Listings */}
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
                  Top Performing Listings
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/vendor/listings"
                  sx={{ 
                    textTransform: 'none',
                    fontSize: '12px',
                    color: '#6366f1'
                  }}
                >
                  View All
                </Button>
              </Box>
              {topListings.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No listing data available
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {topListings.map((listing, idx) => (
                    <Box key={listing.id || idx}>
                      <ListItem 
                        sx={{ 
                          px: 0,
                          py: 1.5,
                        }}
                        secondaryAction={
                          <Chip 
                            label={`${listing.bookings || 0} bookings`} 
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
                              {listing.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                              {listing.category || 'Service'} • RM {listing.revenue?.toFixed(0) || 0}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < topListings.length - 1 && <Divider sx={{ borderColor: '#e5e7eb' }} />}
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Quick Stats */}
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
                Booking Status Overview
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                    Confirmed
                  </Typography>
                  <Chip 
                    label={stats.confirmedBookings} 
                    size="small"
                    sx={{
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                    Pending Review
                  </Typography>
                  <Chip 
                    label={stats.pendingBookings} 
                    size="small"
                    sx={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                    Completed
                  </Typography>
                  <Chip 
                    label={stats.completedBookings} 
                    size="small"
                    sx={{
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                    Total Revenue
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827' }}>
                    RM {stats.totalRevenue.toFixed(2)}
                  </Typography>
                </Box>
              </Stack>
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
              to="/vendor/booking-requests"
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
              Review Booking Requests
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddCircleIcon />}
              component={Link}
              to="/vendor/listings"
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
              Add New Listing
            </Button>
            <Button
              variant="outlined"
              startIcon={<StorefrontIcon />}
              component={Link}
              to="/vendor/listings"
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
              Manage Listings
            </Button>
            <Button
              variant="outlined"
              startIcon={<PaymentIcon />}
              component={Link}
              to="/vendor/payments"
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
              View Payments
            </Button>
            <Button
              variant="outlined"
              startIcon={<AssessmentIcon />}
              component={Link}
              to="/vendor/reports"
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
    </Box>
  );
}
