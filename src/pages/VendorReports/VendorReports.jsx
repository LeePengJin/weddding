import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#06b6d4'];

export default function VendorReports() {
  const [startDate, setStartDate] = useState(dayjs().subtract(6, 'month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [granularity, setGranularity] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [bookingsOverTime, setBookingsOverTime] = useState([]);
  const [bookingsByService, setBookingsByService] = useState([]);
  const [bookingConversion, setBookingConversion] = useState(null);
  const [revenueOverTime, setRevenueOverTime] = useState([]);
  const [revenueByService, setRevenueByService] = useState([]);
  const [revenueByPaymentType, setRevenueByPaymentType] = useState([]);
  const [mostBookedListings, setMostBookedListings] = useState([]);
  const [averageRatingByListing, setAverageRatingByListing] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);

  const reportRef = useRef(null);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        granularity,
      });

      const [
        bookingsOverTimeRes,
        bookingsByServiceRes,
        bookingConversionRes,
        revenueOverTimeRes,
        revenueByServiceRes,
        revenueByPaymentTypeRes,
        mostBookedListingsRes,
        averageRatingByListingRes,
        financialSummaryRes,
      ] = await Promise.all([
        apiFetch(`/vendor/reports/bookings-over-time?${params}`),
        apiFetch(`/vendor/reports/bookings-by-service?${params}`),
        apiFetch(`/vendor/reports/booking-conversion?${params}`),
        apiFetch(`/vendor/reports/revenue-over-time?${params}`),
        apiFetch(`/vendor/reports/revenue-by-service?${params}`),
        apiFetch(`/vendor/reports/revenue-by-payment-type?${params}`),
        apiFetch(`/vendor/reports/most-booked-listings?${params}`),
        apiFetch(`/vendor/reports/average-rating-by-listing?${params}`),
        apiFetch(`/vendor/reports/financial-summary?${params}&period=${granularity === 'monthly' ? 'monthly' : 'quarterly'}`),
      ]);

      setBookingsOverTime(bookingsOverTimeRes.data || []);
      setBookingsByService(bookingsByServiceRes.data || []);
      setBookingConversion(bookingConversionRes.data || null);
      setRevenueOverTime(revenueOverTimeRes.data || []);
      setRevenueByService(revenueByServiceRes.data || []);
      setRevenueByPaymentType(revenueByPaymentTypeRes.data || []);
      setMostBookedListings(mostBookedListingsRes.data || []);
      setAverageRatingByListing(averageRatingByListingRes.data || []);
      setFinancialSummary(financialSummaryRes.data || null);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, granularity]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    setLoading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `vendor-report-${dayjs().format('YYYY-MM-DD')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const totalBookings = bookingsOverTime.reduce((sum, item) => sum + item.count, 0);
  const totalRevenue = revenueOverTime.reduce((sum, item) => sum + item.revenue, 0);
  const avgRating = averageRatingByListing.length > 0
    ? averageRatingByListing.reduce((sum, item) => sum + item.averageRating, 0) / averageRatingByListing.length
    : 0;

  // Calculate previous period for comparison
  // "Last period" = the previous equivalent time period before the selected date range
  // e.g., if selected range is June-December (6 months), last period is December previous year - June
  const dateRangeDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const previousPeriodStart = new Date(startDate);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - dateRangeDays);
  const previousPeriodEnd = new Date(startDate);

  // Calculate totals for previous period
  const previousPeriodBookings = bookingsOverTime
    .filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= previousPeriodStart && itemDate < previousPeriodEnd;
    })
    .reduce((sum, item) => sum + item.count, 0);

  const previousPeriodRevenue = revenueOverTime
    .filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= previousPeriodStart && itemDate < previousPeriodEnd;
    })
    .reduce((sum, item) => sum + item.revenue, 0);

  const bookingsTrend = previousPeriodBookings > 0 
    ? ((totalBookings - previousPeriodBookings) / previousPeriodBookings) * 100 
    : 0;
  const revenueTrend = previousPeriodRevenue > 0
    ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
    : 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ pb: 4, backgroundColor: '#f5f6fa', minHeight: '100vh' }}>
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
            Reports
          </Typography>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportPDF}
            disabled={loading}
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
              Export PDF
            </Button>
        </Box>

        {/* Filters */}
        <Card
          sx={{
            borderRadius: '12px',
            mb: 4,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  maxDate={endDate}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      sx: { 
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: '8px',
                          backgroundColor: '#ffffff'
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: '14px',
                          color: '#6b7280'
                        }
                      },
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  minDate={startDate}
                  maxDate={dayjs()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      sx: { 
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: '8px',
                          backgroundColor: '#ffffff'
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: '14px',
                          color: '#6b7280'
                        }
                      },
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: '14px', color: '#6b7280' }}>Data Granularity</InputLabel>
                  <Select
                    value={granularity}
                    label="Data Granularity"
                    onChange={(e) => setGranularity(e.target.value)}
                    sx={{ 
                      borderRadius: '8px',
                      fontSize: '14px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#e5e7eb'
                      }
                    }}
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </CardContent>
        </Card>

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

        {loading && !bookingsOverTime.length && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress sx={{ color: '#6366f1' }} />
          </Box>
        )}

        <Box ref={reportRef}>
          {/* KPI Cards */}
          <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
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
                        Total Revenue
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
                        RM {totalRevenue.toFixed(2)}
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
                      <Typography sx={{ fontSize: '24px', color: '#10b981' }}>₿</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    {revenueTrend >= 0 ? (
                      <>
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#10b981', mr: 0.5 }} />
                        <Typography variant="body2" sx={{ color: '#10b981', fontSize: '13px', fontWeight: 500 }}>
                          {Math.abs(revenueTrend).toFixed(1)}% vs last period
                        </Typography>
                      </>
                    ) : (
                      <>
                        <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444', mr: 0.5 }} />
                        <Typography variant="body2" sx={{ color: '#ef4444', fontSize: '13px', fontWeight: 500 }}>
                          {Math.abs(revenueTrend).toFixed(1)}% vs last period
                        </Typography>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
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
                        Total Bookings
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
                        {totalBookings}
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
                      <Typography sx={{ fontSize: '24px', color: '#3b82f6' }}>📅</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    {bookingsTrend >= 0 ? (
                      <>
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#10b981', mr: 0.5 }} />
                        <Typography variant="body2" sx={{ color: '#10b981', fontSize: '13px', fontWeight: 500 }}>
                          {Math.abs(bookingsTrend).toFixed(1)}% vs last period
                        </Typography>
                      </>
                    ) : (
                      <>
                        <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444', mr: 0.5 }} />
                        <Typography variant="body2" sx={{ color: '#ef4444', fontSize: '13px', fontWeight: 500 }}>
                          {Math.abs(bookingsTrend).toFixed(1)}% vs last period
                        </Typography>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
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
                        Conversion Rate
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
                        {bookingConversion?.conversionRate?.toFixed(2) || '0.00'}%
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
                      <TrendingUpIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                      {bookingConversion?.total || 0} total bookings
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
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
                        Average Rating
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
                        {avgRating.toFixed(1)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        backgroundColor: '#fce7f3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: '24px' }}>⭐</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                      {averageRatingByListing.length} listings rated
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Charts Section */}
          <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
            {/* Revenue Overview */}
            <Box sx={{ flex: '1 1 65%', minWidth: '400px' }}>
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
                    Revenue Overview
                  </Typography>
                  {revenueOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={revenueOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#9ca3af"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={false}
                          tickFormatter={(value) => `RM ${value}`}
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
                        No data available for the selected period
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Booking Conversion */}
            <Box sx={{ flex: '1 1 30%', minWidth: '300px' }}>
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
                    Booking Status
                  </Typography>
                  {bookingConversion ? (
                    <Box>
                      <Box sx={{ textAlign: 'center', mb: 3, p: 2, backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: '#6366f1', mb: 0.5 }}>
                          {bookingConversion.conversionRate.toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '13px' }}>
                          Conversion Rate
                        </Typography>
                      </Box>
                      <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                          <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                            Confirmed
                          </Typography>
                          <Chip 
                            label={bookingConversion.confirmed} 
                            size="small" 
                            sx={{ 
                              backgroundColor: '#d1fae5',
                              color: '#065f46',
                              fontWeight: 500,
                              fontSize: '12px'
                            }} 
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                          <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                            Pending
                          </Typography>
                          <Chip 
                            label={bookingConversion.pending} 
                            size="small" 
                            sx={{ 
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              fontWeight: 500,
                              fontSize: '12px'
                            }} 
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                          <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                            Rejected
                          </Typography>
                          <Chip 
                            label={bookingConversion.rejected} 
                            size="small" 
                            sx={{ 
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              fontWeight: 500,
                              fontSize: '12px'
                            }} 
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                          <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                            Cancelled
                          </Typography>
                          <Chip 
                            label={bookingConversion.cancelled} 
                            size="small" 
                            sx={{ 
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 500,
                              fontSize: '12px'
                            }} 
                          />
                        </Box>
                      </Stack>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Additional Charts */}
          <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
            {/* Bookings Over Time */}
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
                    Bookings Over Time
                  </Typography>
                  {bookingsOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={bookingsOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          stroke="#9ca3af"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#9ca3af"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
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
                        No data available
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Revenue by Payment Type */}
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
                    Revenue by Payment Type
                  </Typography>
                  {revenueByPaymentType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={revenueByPaymentType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="revenue"
                          nameKey="type"
                        >
                          {revenueByPaymentType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => {
                            // For PieChart, props.payload contains the data object
                            const paymentType = props?.payload?.type || props?.name || name || 'Payment Type';
                            return [`RM ${parseFloat(value).toFixed(2)}`, paymentType];
                          }}
                          labelFormatter={() => ''}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Top Services Lists */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* Most Booked Listings */}
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
                    Top Booked Services
                  </Typography>
                  {mostBookedListings.length > 0 ? (
                    <Stack spacing={0}>
                      {mostBookedListings.slice(0, 5).map((item, index) => (
                        <Box key={item.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 600, 
                                  color: '#111827',
                                  fontSize: '15px',
                                  mb: 0.5
                                }}
                              >
                                {item.name}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: '#6b7280',
                                  fontSize: '13px'
                                }}
                              >
                                {item.bookings} bookings
                              </Typography>
                            </Box>
                            <Chip 
                              label={item.bookings} 
                              size="small"
                              sx={{
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                fontWeight: 600,
                                fontSize: '13px'
                              }}
                            />
                          </Box>
                          {index < mostBookedListings.slice(0, 5).length - 1 && (
                            <Divider sx={{ borderColor: '#e5e7eb' }} />
                          )}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Top Revenue Services */}
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
                    Top Revenue Services
                  </Typography>
                  {revenueByService.length > 0 ? (
                    <Stack spacing={0}>
                      {revenueByService.slice(0, 5).map((item, index) => (
                        <Box key={item.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 600, 
                                  color: '#111827',
                                  fontSize: '15px',
                                  mb: 0.5
                                }}
                              >
                                {item.name}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: '#6b7280',
                                  fontSize: '13px'
                                }}
                              >
                                RM {item.revenue.toFixed(2)}
                              </Typography>
                            </Box>
                            <Chip 
                              label={`RM ${item.revenue.toFixed(0)}`} 
                              size="small"
                              sx={{
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                fontWeight: 600,
                                fontSize: '13px'
                              }}
                            />
                          </Box>
                          {index < revenueByService.slice(0, 5).length - 1 && (
                            <Divider sx={{ borderColor: '#e5e7eb' }} />
                          )}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
