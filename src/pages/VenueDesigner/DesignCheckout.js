import React, { useState } from 'react';
import './DesignCheckout.styles.css';

const DesignCheckout = ({ onClose, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Mock data for demonstration
  const itemsByVendor = {
    "Elegant Eats Catering": [
      {
        name: "Classic Round Table (x12)",
        category: "Furniture",
        price: 1200
      },
      {
        name: "Linen Tablecloth (x12)",
        category: "Table Settings",
        price: 300
      }
    ],
    "Blooms & Petals": [
      {
        name: "Rose Centerpiece (x12)",
        category: "Floral Arrangements",
        price: 900
      },
      {
        name: "Bridal Bouquet",
        category: "Bridal Flowers",
        price: 350
      }
    ],
    "Groove Masters DJ": [
      {
        name: "4-Hour DJ Set with Lighting",
        category: "Entertainment",
        price: 1000
      }
    ]
  };

  const placedItems = Object.values(itemsByVendor).flat();

  const calculateVendorTotal = (items) => {
    return items.reduce((total, item) => total + item.price, 0);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsSubmitted(true);
      setTimeout(() => {
        onSubmit();
      }, 2000);
    } catch (error) {
      console.error('Error submitting booking requests:', error);
    }
  };

  if (isSubmitted) {
    return (
      <div className="design-checkout-container">
        <div className="checkout-success">
          <div className="success-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <h2>Booking Requests Sent!</h2>
          <p>We've notified all vendors about your requests. You'll receive updates via email as vendors confirm your bookings.</p>
          <div className="next-steps">
            <h3>Next Steps:</h3>
            <ol>
              <li>Vendors will review your requests</li>
              <li>You'll receive confirmation emails</li>
              <li>Proceed with payments once vendors confirm</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="design-checkout-container">
      <div>
        <div className="checkout-header">
          <h2>Review Your Design Selections</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="checkout-content">
          {/* Left Column - Vendor List */}
          <div className="vendor-list">
            {Object.keys(itemsByVendor).map((vendor, index) => (
              <div 
                key={vendor} 
                className={`vendor-card ${selectedVendor === vendor ? 'selected' : ''}`}
                onClick={() => setSelectedVendor(vendor)}
              >
                <span className="vendor-number">Vendor {index + 1}</span>
              </div>
            ))}
          </div>

          {/* Middle Column - Selected Vendor Details */}
          <div className="vendor-details">
            {selectedVendor ? (
              <div className="vendor-section">
                <div className="vendor-header">
                  <h3>{selectedVendor}</h3>
                </div>
                <div className="vendor-items">
                  {itemsByVendor[selectedVendor].map((item, index) => (
                    <div key={index} className="item-row">
                      <span className="item-name">{item.name}</span>
                      <span className="item-price">RM{item.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="vendor-total">
                  <span className="amount">Vendor Total: RM{calculateVendorTotal(itemsByVendor[selectedVendor]).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="no-vendor-selected">
                <p>Select a vendor to view details</p>
              </div>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="summary-section">
            <div className="summary-header">
              <h3>Summary</h3>
            </div>
            <div className="summary-details">
              <div className="summary-row">
                <span>Total Items</span>
                <span>{placedItems.length}</span>
              </div>
              <div className="summary-row">
                <span>Total Vendors</span>
                <span>{Object.keys(itemsByVendor).length}</span>
              </div>
              <div className="summary-row total">
                <span>Total Amount</span>
                <span>RM {placedItems.reduce((total, item) => total + item.price, 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="summary-note">
              <i className="fas fa-info-circle"></i>
              <p>Submitting this request will notify all vendors. Prices and availability will be confirmed by vendors.</p>
            </div>

            <button 
              className={`submit-btn ${isSubmitting ? 'submitting' : ''}`}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Sending Requests...
                </>
              ) : (
                'Submit Booking Requests'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignCheckout; 
export default DesignCheckout; 