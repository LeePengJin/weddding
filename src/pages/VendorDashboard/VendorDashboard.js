import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip, Paper } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import './VendorDashboard.styles.css';

// Asset URLs from Figma
const imgFrame4 = 'https://www.figma.com/api/mcp/asset/44209aa2-4bac-4373-ba5d-be797609c2e0';
const imgFrame5 = 'https://www.figma.com/api/mcp/asset/12223afe-ab7b-498b-977c-a7deb3163b0a';
const imgFrame6 = 'https://www.figma.com/api/mcp/asset/82678cec-5f26-4886-8686-a66b3d87d17c';

const VendorDashboard = () => {
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      const data = await apiFetch('/bookings/vendor/payments');
      setPayments(data || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const pendingPayments = payments.filter((p) => !p.releasedToVendor);
  const releasedPayments = payments.filter((p) => p.releasedToVendor);
  const totalPending = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const totalReleased = releasedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const stats = [
    {
      label: 'New Bookings',
      value: '12',
      subtext: 'requests awaiting response',
      icon: imgFrame4,
    },
    {
      label: 'Confirmed Bookings',
      value: '25',
      subtext: null,
      icon: imgFrame5,
    },
    {
      label: 'Total Listings',
      value: '58',
      subtext: 'active items and services',
      icon: imgFrame4,
    },
    {
      label: 'Total Revenue',
      value: 'RM 45,231.90',
      subtext: null,
      icon: imgFrame6,
    },
  ];

  const recentActivities = [
    {
      title: 'New booking request',
      description: 'From Sarah & John',
      time: '5m ago',
    },
    {
      title: 'Listing updated',
      description: 'Classic Rose Bouquet',
      time: '2h ago',
    },
    {
      title: 'New review received',
      description: '5 stars for DJ Services',
      time: '18h ago',
    },
    ...(payments.slice(0, 1).map((payment) => ({
      title: payment.releasedToVendor ? 'Payment released' : 'Payment pending',
      description: `RM ${formatCurrency(payment.amount)} from ${payment.couple?.name || 'Couple'}`,
      time: payment.releasedAt 
        ? formatDate(payment.releasedAt) 
        : formatDate(payment.paymentDate),
    }))),
  ];

  const topListings = [
    {
      name: '4-Hour DJ Set',
      category: 'Entertainment',
      rating: 4.9,
    },
    {
      name: 'Classic Rose Bouquet',
      category: 'Florals',
      rating: 4.8,
    },
    {
      name: 'Uplighting Package',
      category: 'Decor',
      rating: 4.6,
    },
  ];

  return (
    <Box className="vendor-dashboard-container">
      {/* Stats Cards */}
      <Box className="vendor-stats-grid">
        {stats.map((stat, index) => (
          <Box key={index} className="vendor-stat-card">
            <Box className="vendor-stat-content">
              <Typography className="vendor-stat-label">{stat.label}</Typography>
              <Box className="vendor-stat-icon">
                <img src={stat.icon} alt="" />
              </Box>
              <Box className="vendor-stat-value-container">
                <Typography className="vendor-stat-value">{stat.value}</Typography>
                {stat.subtext && (
                  <Typography className="vendor-stat-subtext">{stat.subtext}</Typography>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Recent Activities and Right Panel */}
      <Box className="vendor-dashboard-bottom">
        {/* Recent Activities */}
        <Box className="vendor-activities-card">
          <Box className="vendor-section-header">
            <Typography className="vendor-section-title">Recent Activities</Typography>
            <Link to="/vendor/activities" className="vendor-view-all">
              View All
            </Link>
          </Box>
          <Box className="vendor-activities-list">
            {recentActivities.map((activity, index) => (
              <Box key={index} className="vendor-activity-item">
                <Box className="vendor-activity-content">
                  <Typography className="vendor-activity-title">{activity.title}</Typography>
                  <Typography className="vendor-activity-description">{activity.description}</Typography>
                </Box>
                <Typography className="vendor-activity-time">{activity.time}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right Panel - Top Performing Listings & Quick Actions */}
        <Box className="vendor-right-panel">
          {/* Top Performing Listings */}
          <Box className="vendor-listings-card">
            <Typography className="vendor-section-title">Top Performing Listings</Typography>
            <Typography className="vendor-section-subtitle">Your most popular items this month.</Typography>
            <Box className="vendor-listings-list">
              {topListings.map((listing, index) => (
                <Box key={index} className="vendor-listing-item">
                  <Box className="vendor-listing-info">
                    <Typography className="vendor-listing-name">{listing.name}</Typography>
                    <Typography className="vendor-listing-category">{listing.category}</Typography>
                  </Box>
                  <Box className="vendor-listing-rating">
                    <Typography className="vendor-rating-value">{listing.rating}</Typography>
                    <Box className="vendor-star-icon">★</Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Payment Status */}
          <Box className="vendor-actions-card" sx={{ mb: 2 }}>
            <Typography className="vendor-section-title">Payment Status</Typography>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffc107' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#856404' }}>
                    Pending Release
                  </Typography>
                  <Chip 
                    label={pendingPayments.length} 
                    size="small" 
                    color="warning"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#856404' }}>
                  RM {formatCurrency(totalPending)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Awaiting admin release
                </Typography>
              </Box>
              <Box sx={{ p: 2, bgcolor: '#d1e7dd', borderRadius: 1, border: '1px solid #198754' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f5132' }}>
                    Released
                  </Typography>
                  <Chip 
                    label={releasedPayments.length} 
                    size="small" 
                    color="success"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f5132' }}>
                  RM {formatCurrency(totalReleased)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payments released to you
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Quick Actions */}
          <Box className="vendor-actions-card">
            <Typography className="vendor-section-title">Quick Actions</Typography>
            <Box className="vendor-actions-buttons">
              <Button
                component={Link}
                to="/vendor/booking-requests"
                className="vendor-action-btn vendor-action-btn-review"
                startIcon={<i className="fas fa-eye"></i>}
              >
                Review Booking Requests
              </Button>
              <Button
                component={Link}
                to="/vendor/listings/new"
                className="vendor-action-btn vendor-action-btn-add"
                startIcon={<i className="fas fa-plus"></i>}
              >
                Add New Listing
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default VendorDashboard;
