import React from 'react';
import { Link } from 'react-router-dom';
import './Home.styles.css';

const Home = () => {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Design Your Dream Wedding in 3D</h1>
          <p>Create, visualize, and plan your perfect wedding venue with our innovative 3D platform</p>
          <div className="hero-buttons">
            <Link to="/create-project" className="cta-button">Start Planning</Link>
            <Link to="/vendor/dashboard" className="vendor-button">Vendor Access</Link>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>Our Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <i className="fas fa-cube"></i>
            <h3>3D Venue Design</h3>
            <p>Design your wedding venue in an immersive 3D space</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-tasks"></i>
            <h3>Smart Planning Tools</h3>
            <p>Comprehensive checklist and timeline management</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-wallet"></i>
            <h3>Budget Management</h3>
            <p>Track and manage your wedding expenses effortlessly</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-users"></i>
            <h3>Real-time Collaboration</h3>
            <p>Work together with your partner and wedding planner</p>
          </div>
        </div>
      </section>

      <section className="statistics">
        <div className="stat-item">
          <h3>1000+</h3>
          <p>Successful Weddings</p>
        </div>
        <div className="stat-item">
          <h3>5000+</h3>
          <p>Active Users</p>
        </div>
        <div className="stat-item">
          <h3>100+</h3>
          <p>Venue Templates</p>
        </div>
      </section>
    </div>
  );
};

export default Home;