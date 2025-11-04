import React, { useState } from 'react';
import './BookingRequests.styles.css';

const BookingRequests = () => {
  // Mock data for booking requests
  const [bookingRequests, setBookingRequests] = useState([
    {
      id: 1,
      coupleName: 'Sarah & John',
      projectName: 'Garden Wedding',
      items: [
        {
          name: 'Classic Round Table',
          quantity: 12,
          price: 100
        },
        {
          name: 'Linen Tablecloth',
          quantity: 12,
          price: 25
        }
      ],
      totalAmount: 1500,
      requestDate: '2025-08-15',
      eventDate: '2025-12-20',
      status: 'pending'
    },
    {
      id: 2,
      coupleName: 'Emily & Michael',
      projectName: 'Rustic Wedding',
      items: [
        {
          name: 'Wooden Arch',
          quantity: 1,
          price: 800
        },
        {
          name: 'Vintage Chairs',
          quantity: 100,
          price: 15
        }
      ],
      totalAmount: 2300,
      requestDate: '2025-08-14',
      eventDate: '2025-11-15',
      status: 'pending'
    }
  ]);

  const handleAccept = (requestId) => {
    setBookingRequests(requests =>
      requests.map(request =>
        request.id === requestId
          ? { ...request, status: 'accepted' }
          : request
      )
    );
  };

  const handleReject = (requestId) => {
    setBookingRequests(requests =>
      requests.map(request =>
        request.id === requestId
          ? { ...request, status: 'rejected' }
          : request
      )
    );
  };

  return (
    <div className="booking-requests">
      <div className="page-header">
        <h1>Booking Requests</h1>
      </div>

      <div className="requests-list">
        {bookingRequests.map(request => (
          <div key={request.id} className={`request-card ${request.status}`}>
            <div className="request-header">
              <div className="couple-info">
                <h3>{request.coupleName}</h3>
                <span className="project-name">{request.projectName}</span>
              </div>
              <div className="request-dates">
                <div className="date-item">
                  <span className="label">Request Date:</span>
                  <span className="value">{request.requestDate}</span>
                </div>
                <div className="date-item">
                  <span className="label">Event Date:</span>
                  <span className="value">{request.eventDate}</span>
                </div>
              </div>
            </div>

            <div className="items-list">
              <h4>Requested Items</h4>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price (RM)</th>
                    <th>Total (RM)</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.price.toLocaleString()}</td>
                      <td>{(item.quantity * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3">Total Amount</td>
                    <td>RM {request.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {request.status === 'pending' && (
              <div className="request-actions">
                <button 
                  className="accept-btn"
                  onClick={() => handleAccept(request.id)}
                >
                  Accept Request
                </button>
                <button 
                  className="reject-btn"
                  onClick={() => handleReject(request.id)}
                >
                  Reject Request
                </button>
              </div>
            )}

            {request.status !== 'pending' && (
              <div className="request-status">
                <span className={`status-badge ${request.status}`}>
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookingRequests; 