import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import './VendorDashboard.styles.css';

// Asset URLs from Figma
const imgFrame4 = 'https://www.figma.com/api/mcp/asset/44209aa2-4bac-4373-ba5d-be797609c2e0';
const imgFrame5 = 'https://www.figma.com/api/mcp/asset/12223afe-ab7b-498b-977c-a7deb3163b0a';
const imgFrame6 = 'https://www.figma.com/api/mcp/asset/82678cec-5f26-4886-8686-a66b3d87d17c';

const VendorDashboard = () => {
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
    {
      title: 'Payment received',
      description: 'RM 1,200 from Wedding #1024',
      time: 'yesterday',
    },
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
