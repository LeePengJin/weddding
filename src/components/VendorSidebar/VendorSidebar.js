import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './VendorSidebar.styles.css';

const VendorSidebar = () => {
  const location = useLocation();

  const menuItems = [
    {
      icon: 'fas fa-th-large',
      label: 'Dashboard',
      path: '/vendor/dashboard'
    },
    {
      icon: 'fas fa-calendar-alt',
      label: 'Booking Requests',
      path: '/vendor/booking-requests'
    },
    {
      icon: 'fas fa-clock',
      label: 'Availability',
      path: '/vendor/availability'
    },
    {
      icon: 'fas fa-list',
      label: 'Manage Listings',
      path: '/vendor/listings'
    }
  ];

  return (
    <div className="vendor-sidebar">
      <div className="sidebar-header">
        <i className="fas fa-heart"></i>
        <h1>Weddding</h1>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <i className={item.icon}></i>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link to="/logout" className="logout-btn">
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </Link>
      </div>
    </div>
  );
};

export default VendorSidebar; 