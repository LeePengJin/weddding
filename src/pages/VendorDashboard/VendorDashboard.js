import React from 'react';
import { Link } from 'react-router-dom';
import './VendorDashboard.styles.css';

const VendorDashboard = () => {
  // Mock data
  const stats = {
    newBookings: {
      count: 12,
      label: 'New Bookings',
      subtext: 'requests awaiting response'
    },
    confirmedBookings: {
      count: 25,
      label: 'Confirmed Bookings'
    },
    totalListings: {
      count: 58,
      label: 'Total Listings',
      subtext: 'active items and services'
    },
    totalRevenue: {
      amount: 45231.90,
      label: 'Total Revenue'
    }
  };

  const recentActivities = [
    {
      type: 'booking_request',
      title: 'New booking request',
      description: 'From Sarah & John',
      time: '5m ago'
    },
    {
      type: 'listing_update',
      title: 'Listing updated',
      description: 'Classic Rose Bouquet',
      time: '2h ago'
    },
    {
      type: 'review',
      title: 'New review received',
      description: '5 stars for DJ Services',
      time: '6h ago'
    },
    {
      type: 'payment',
      title: 'Payment received',
      description: 'RM 1,500 from Wedding #1024',
      time: 'yesterday'
    }
  ];

  const topListings = [
    {
      name: '4-Hour DJ Set',
      category: 'Entertainment',
      rating: 4.8
    },
    {
      name: 'Classic Rose Bouquet',
      category: 'Florist',
      rating: 4.8
    },
    {
      name: 'Uplighting Package',
      category: 'Decor',
      rating: 4.6
    }
  ];

  return (
    <div className="vendor-dashboard">
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card new-bookings">
          <div className="stat-content">
            <h2>{stats.newBookings.count}</h2>
            <div className="stat-label">
              <span>{stats.newBookings.label}</span>
              <p>{stats.newBookings.subtext}</p>
            </div>
          </div>
          <div className="stat-icon">
            <i className="fas fa-calendar-plus"></i>
          </div>
        </div>

        <div className="stat-card confirmed-bookings">
          <div className="stat-content">
            <h2>{stats.confirmedBookings.count}</h2>
            <div className="stat-label">
              <span>{stats.confirmedBookings.label}</span>
            </div>
          </div>
          <div className="stat-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
        </div>

        <div className="stat-card total-listings">
          <div className="stat-content">
            <h2>{stats.totalListings.count}</h2>
            <div className="stat-label">
              <span>{stats.totalListings.label}</span>
              <p>{stats.totalListings.subtext}</p>
            </div>
          </div>
          <div className="stat-icon">
            <i className="fas fa-list"></i>
          </div>
        </div>

        <div className="stat-card total-revenue">
          <div className="stat-content">
            <h2>RM {stats.totalRevenue.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</h2>
            <div className="stat-label">
              <span>{stats.totalRevenue.label}</span>
            </div>
          </div>
          <div className="stat-icon">
            <i className="fas fa-dollar-sign"></i>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Recent Activities */}
        <div className="activities-section">
          <div className="section-header">
            <h3>Recent Activities</h3>
            <Link to="/activities" className="view-all">View All</Link>
          </div>
          <div className="activities-list">
            {recentActivities.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-content">
                  <h4>{activity.title}</h4>
                  <p>{activity.description}</p>
                </div>
                <span className="activity-time">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Listings */}
        <div className="top-listings-section">
          <div className="section-header">
            <h3>Top Performing Listings</h3>
            <p className="section-subtext">Your most popular items this month</p>
          </div>
          <div className="listings-list">
            {topListings.map((listing, index) => (
              <div key={index} className="listing-item">
                <div className="listing-info">
                  <h4>{listing.name}</h4>
                  <p>{listing.category}</p>
                </div>
                <div className="listing-rating">
                  <span>{listing.rating}</span>
                  <i className="fas fa-star"></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/booking-requests" className="action-btn review-btn">
          <i className="fas fa-calendar-alt"></i>
          Review Booking Requests
        </Link>
        <Link to="/listings/new" className="action-btn add-listing-btn">
          <i className="fas fa-plus"></i>
          Add New Listing
        </Link>
      </div>
    </div>
  );
};

export default VendorDashboard; 