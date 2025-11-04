import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './PaymentManagement.styles.css';

const PaymentManagement = () => {
  const [selectedView, setSelectedView] = useState('pending'); // 'pending', 'history'
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Mock payment data
  const [paymentData] = useState({
    upcomingPayments: [
      {
        id: 1,
        vendor: "Sunset Resort",
        service: "Venue Booking",
        amount: 5000,
        type: "Final Payment",
        dueDate: "2024-09-01",
        status: "pending",
        description: "Final payment for wedding venue booking including reception hall and ceremony setup"
      },
      {
        id: 2,
        vendor: "Elegant Eats Catering",
        service: "Catering Services",
        amount: 3200,
        type: "Deposit",
        dueDate: "2024-12-15",
        status: "pending",
        description: "Catering deposit for wedding reception dinner service"
      },
      {
        id: 3,
        vendor: "Blooming Gardens Florist",
        service: "Floral Arrangements",
        amount: 800,
        type: "Deposit",
        dueDate: "2025-01-10",
        status: "pending",
        description: "Floral arrangement deposit for bridal bouquet and centerpieces"
      }
    ],
    paymentHistory: [
      {
        id: 4,
        vendor: "Timeless Photos",
        service: "Photography Deposit",
        amount: 1000,
        type: "Deposit",
        date: "2024-07-15",
        status: "completed",
        paymentMethod: "Credit Card",
        transactionId: "TXN001",
        description: "Photography service deposit payment for wedding day coverage"
      },
      {
        id: 5,
        vendor: "Groove Masters DJ",
        service: "DJ Services",
        amount: 800,
        type: "Full Payment",
        date: "2024-08-20",
        status: "completed",
        paymentMethod: "Bank Transfer",
        transactionId: "TXN002",
        description: "Complete payment for wedding reception DJ services"
      },
      {
        id: 6,
        vendor: "Dreamy Decorations",
        service: "Decoration Setup",
        amount: 1200,
        type: "Deposit",
        date: "2024-09-10",
        status: "completed",
        paymentMethod: "Credit Card",
        transactionId: "TXN003",
        description: "Decoration service deposit for wedding venue setup"
      }
    ]
  });

  // Set first payment as selected initially
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(
    selectedView === 'pending' ? paymentData.upcomingPayments[0] : paymentData.paymentHistory[0]
  );

  const handleMakePayment = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  const handleSelectPayment = (payment) => {
    setSelectedPaymentDetail(payment);
  };

  const handleViewChange = (view) => {
    setSelectedView(view);
    // Set the first payment as selected when switching views
    if (view === 'pending') {
      setSelectedPaymentDetail(paymentData.upcomingPayments[0]);
    } else {
      setSelectedPaymentDetail(paymentData.paymentHistory[0]);
    }
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="payment-management-container">
      {/* Header */}
      <div className="payment-header">
        <div className="header-top">
          <Link to="/project-dashboard" className="back-to-dashboard">
            <i className="fas fa-arrow-left"></i>
            Back to Dashboard
          </Link>
        </div>
        <div className="header-content">
          <h1>Manage Your Payments</h1>
          <p>Keep track of all your wedding-related expenses, from deposits to final payments, all in one place.</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="payment-navigation">
        <button 
          className={`nav-tab ${selectedView === 'pending' ? 'active' : ''}`}
          onClick={() => handleViewChange('pending')}
        >
          <i className="fas fa-calendar-alt"></i>
          Pending Payments
        </button>
        <button 
          className={`nav-tab ${selectedView === 'history' ? 'active' : ''}`}
          onClick={() => handleViewChange('history')}
        >
          <i className="fas fa-history"></i>
          Payment History
        </button>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="payment-main-content">
        {/* Left Column - Payment List */}
        <div className="payment-list-section">
          <div className="section-header">
            <h3>{selectedView === 'pending' ? 'Upcoming Payments' : 'Completed Payments'}</h3>
          </div>
          
          <div className="payment-list">
            {(selectedView === 'pending' ? paymentData.upcomingPayments : paymentData.paymentHistory).map(payment => (
              <div 
                key={payment.id} 
                className={`payment-list-item ${selectedPaymentDetail?.id === payment.id ? 'selected' : ''}`}
                onClick={() => handleSelectPayment(payment)}
              >
                <div className="payment-list-content">
                  <div className="vendor-name">{payment.vendor}</div>
                  <div className="service-type">{payment.service}</div>
                </div>
                <i className="fas fa-chevron-right"></i>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Payment Details */}
        <div className="payment-detail-section">
          {selectedPaymentDetail && (
            <div className="payment-detail-card">
              <div className="detail-header">
                <div className="vendor-info">
                  <h2>{selectedPaymentDetail.vendor}</h2>
                  <p className="service-name">{selectedPaymentDetail.service}</p>
                </div>
                <div className="status-badge">
                  {selectedView === 'pending' ? (
                    <span className="pending-badge">Pending</span>
                  ) : (
                    <span className="completed-badge">Completed</span>
                  )}
                </div>
              </div>

              <div className="detail-content">
                <div className="detail-row">
                  <div className="detail-item">
                    <i className="fas fa-building detail-icon"></i>
                    <div className="detail-info">
                      <span className="detail-label">Vendor</span>
                      <span className="detail-value">{selectedPaymentDetail.vendor}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="detail-item">
                    <i className="fas fa-concierge-bell detail-icon"></i>
                    <div className="detail-info">
                      <span className="detail-label">Service</span>
                      <span className="detail-value">{selectedPaymentDetail.service}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="detail-item">
                    <i className="fas fa-dollar-sign detail-icon"></i>
                    <div className="detail-info">
                      <span className="detail-label">Amount</span>
                      <span className="detail-value amount">RM {selectedPaymentDetail.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="detail-item">
                    <i className="fas fa-calendar detail-icon"></i>
                    <div className="detail-info">
                      <span className="detail-label">
                        {selectedView === 'pending' ? 'Due Date' : 'Payment Date'}
                      </span>
                      <span className="detail-value">
                        {formatDate(selectedView === 'pending' ? selectedPaymentDetail.dueDate : selectedPaymentDetail.date)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedView === 'history' && selectedPaymentDetail.transactionId && (
                  <div className="detail-row">
                    <div className="detail-item">
                      <i className="fas fa-receipt detail-icon"></i>
                      <div className="detail-info">
                        <span className="detail-label">Transaction ID</span>
                        <span className="detail-value">{selectedPaymentDetail.transactionId}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-actions">
                {selectedView === 'pending' ? (
                  <button 
                    className="primary-action-btn"
                    onClick={() => handleMakePayment(selectedPaymentDetail)}
                  >
                    <i className="fas fa-arrow-right"></i>
                    Pay Now
                  </button>
                ) : (
                  <button className="secondary-action-btn">
                    <i className="fas fa-download"></i>
                    Download Receipt
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="payment-modal-overlay">
          <div className="payment-modal">
            <div className="modal-header">
              <h3>Make Payment</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowPaymentModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="payment-details">
                <h4>{selectedPayment.vendor}</h4>
                <p className="payment-description">{selectedPayment.description}</p>
                <div className="amount-due">
                  <span className="label">Amount Due:</span>
                  <span className="amount">RM {selectedPayment.amount.toLocaleString()}</span>
                </div>
                <div className="due-date-info">
                  <span className="label">Due Date:</span>
                  <span className={isOverdue(selectedPayment.dueDate) ? 'overdue' : ''}>
                    {formatDate(selectedPayment.dueDate)}
                  </span>
                </div>
              </div>
              <div className="payment-methods">
                <h5>Select Payment Method</h5>
                <div className="method-options">
                  <button className="payment-method-btn">
                    <i className="fas fa-credit-card"></i>
                    Credit Card
                  </button>
                  <button className="payment-method-btn">
                    <i className="fas fa-university"></i>
                    Bank Transfer
                  </button>
                  <button className="payment-method-btn">
                    <i className="fab fa-paypal"></i>
                    PayPal
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
              <button className="proceed-payment-btn">
                <i className="fas fa-credit-card"></i>
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement; 