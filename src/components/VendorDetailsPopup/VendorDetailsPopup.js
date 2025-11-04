import React from 'react';
import { Link } from 'react-router-dom';
import './VendorDetailsPopup.styles.css';

const VendorDetailsPopup = ({ vendors, onClose }) => {
  return (
    <div className="vendor-popup-overlay">
      <div className="vendor-popup">
        <div className="vendor-popup-header">
          <h2>Vendor Details</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="vendors-grid">
          {vendors.map(vendor => (
            <div key={vendor.name} className="vendor-card">
              <div className="vendor-header">
                <div className="vendor-avatar">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.name)}&background=E16789&color=fff`}
                    alt={vendor.name}
                  />
                </div>
                <div className="vendor-info">
                  <h3>{vendor.name}</h3>
                  <span className="vendor-type">{vendor.type}</span>
                </div>
              </div>

              <div className="vendor-details">
                <div className="detail-item">
                  <i className="fas fa-phone"></i>
                  <span>{vendor.contact}</span>
                </div>
                <div className="detail-item">
                  <i className="fas fa-envelope"></i>
                  <span>{vendor.email}</span>
                </div>
                {vendor.address && (
                  <div className="detail-item">
                    <i className="fas fa-map-marker-alt"></i>
                    <span>{vendor.address}</span>
                  </div>
                )}
              </div>

              <div className="vendor-actions">
                <Link to="/messages" className="message-vendor-btn">
                  <i className="fas fa-comment"></i>
                  Message
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VendorDetailsPopup; 