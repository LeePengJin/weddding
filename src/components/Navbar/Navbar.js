import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../UserAvatar/UserAvatar';
import './Navbar.styles.css';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLoginClick = () => navigate('/login');

  const handleWeddingProjectClick = (event) => {
    event.preventDefault();
    if (user) {
      navigate('/projects');
    } else {
      navigate('/login');
    }
  };

  const handleAvatarClick = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleProfileClick = () => {
    setDropdownOpen(false);
    navigate('/profile');
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    logout();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">
          <span className="logo-icon" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16.1111 3C19.6333 3 22 6.3525 22 9.48C22 15.8138 12.1778 21 12 21C11.8222 21 2 15.8138 2 9.48C2 6.3525 4.36667 3 7.88889 3C9.91111 3 11.2333 4.02375 12 4.92375C12.7667 4.02375 14.0889 3 16.1111 3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="logo-text">Weddding</span>
        </Link>
      </div>

      <div className="navbar-center">
        <Link to="/" className="nav-link">Home</Link>
        <a href="/projects" className="nav-link" onClick={handleWeddingProjectClick}>Wedding Project</a>
        <Link to="/about" className="nav-link">About Us</Link>
      </div>

      <div className="navbar-right">
        {!loading && !user && (
          <button className="login-btn" onClick={handleLoginClick}>Log in</button>
        )}
        {!loading && user && (
          <>
            <button className="message-btn" onClick={() => navigate('/messages')} title="Messages">
              <i className="fas fa-comment"></i>
            </button>
            <div className="user-profile-container" ref={dropdownRef}>
              <button className="avatar-btn" onClick={handleAvatarClick}>
                <UserAvatar user={user} size={40} />
              </button>
              {dropdownOpen && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={handleProfileClick}>
                    Profile
                  </button>
                  <button className="dropdown-item" onClick={handleLogoutClick}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;