import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
    // Navigate to profile page when implemented
    // navigate('/profile');
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
                d="M11.9932 5.13581C9.9938 2.7984 6.65975 2.16964 4.15469 4.31001C1.64964 6.45038 1.29697 10.029 3.2642 12.5604C4.89982 14.6651 9.84977 19.1041 11.4721 20.5408C11.6536 20.7016 11.7444 20.7819 11.8502 20.8135C11.9426 20.8411 12.0437 20.8411 12.1361 20.8135C12.2419 20.7819 12.3327 20.7016 12.5142 20.5408C14.1365 19.1041 19.0865 14.6651 20.7221 12.5604C22.6893 10.029 22.3797 6.42787 19.8316 4.31001C17.2835 2.19216 13.9925 2.7984 11.9932 5.13581Z"
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
                <img src="/images/default-avatar.png" alt="Profile" className="profile-image" />
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