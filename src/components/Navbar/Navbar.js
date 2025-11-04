import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.styles.css';

const Navbar = () => {
  const navigate = useNavigate();
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">
          <i className="fas fa-heart"></i> Weddding
        </Link>
      </div>
      
      <div className="navbar-center">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/projects" className="nav-link">Wedding Project</Link>
        <Link to="/about" className="nav-link">About Us</Link>
      </div>
      
      <div className="navbar-right">
        <button className="message-btn" onClick={() => navigate('/messages')}>
          <i className="fas fa-comment"></i>
          <span>Message</span>
        </button>
        <div className="user-profile">
          <img src="/images/default-avatar.png" alt="Profile" className="profile-image" />
          <span className="user-name">PENG JIN</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;