import React, { useState } from 'react';
import './DesignSummary.styles.css';

const DesignSummary = ({ onClose, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Mock data for demonstration
  const selectedItems = {
    "Elegant Eats Catering": [
      {
        name: "Classic Round Table (x12)",
        price: 1200
      },
      {
        name: "Linen Tablecloth (x12)",
        price: 300
      }
    ],
    "Blooms & Petals": [
      {
        name: "Rose Centerpiece (x12)",
        price: 900
      },
      {
        name: "Bridal Bouquet",
        price: 350
      }
    ],
    "Groove Masters DJ": [
      {
        name: "4-Hour DJ Set with Lighting",
        price: 1000
      }
    ]
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
      <div className="design-summary-container">
        <div className="success-message">
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

  const totalAmount = Object.values(selectedItems)
    .flat()
    .reduce((total, item) => total + item.price, 0);

  return (
    <div className="design-summary-container">
      <div className="summary-modal">
        <div className="summary-header">
          <h2>Review Your Selections</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="summary-content">
          <div className="summary-items">
            {Object.entries(selectedItems).map(([vendor, items]) => (
              <div key={vendor} className="vendor-section">
                <h3>{vendor}</h3>
                {items.map((item, index) => (
                  <div key={index} className="item-row">
                    <span className="item-name">{item.name}</span>
                    <span className="item-price">RM{item.price.toLocaleString()}</span>
                  </div>
                ))}
                <div className="vendor-total">
                  <span>Vendor Total: RM{items.reduce((total, item) => total + item.price, 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="summary-sidebar">
            <div className="total-section">
              <div className="total-row">
                <span>Total Items</span>
                <span>{Object.values(selectedItems).flat().length}</span>
              </div>
              <div className="total-row">
                <span>Total Vendors</span>
                <span>{Object.keys(selectedItems).length}</span>
              </div>
              <div className="total-row grand-total">
                <span>Total Amount</span>
                <span className="total-amount">RM{totalAmount.toLocaleString()}</span>
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

export default DesignSummary; 