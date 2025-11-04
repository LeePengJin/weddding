import React, { useState } from 'react';
import './ManageListings.styles.css';

const ManageListings = () => {
  const [listings, setListings] = useState([
    {
      id: 1,
      name: 'Classic Round Table',
      category: 'Furniture',
      description: 'A beautiful wooden round table that seats 8 guests comfortably.',
      price: 100,
      image: '/images/default-product.jpg'
    },
    {
      id: 2,
      name: 'Chiavari Chair',
      category: 'Furniture',
      description: 'Elegant gold Chiavari chair, perfect for classic and romantic themes.',
      price: 15,
      image: '/images/default-product.jpg'
    },
    {
      id: 3,
      name: 'Rose Centerpiece',
      category: 'Florals',
      description: 'A lush centerpiece with white and pink roses, and eucalyptus.',
      price: 75,
      image: '/images/default-product.jpg'
    },
    {
      id: 4,
      name: '4-Hour DJ Set',
      category: 'Entertainment',
      description: 'Professional DJ services including a sound system and basic lighting.',
      price: 1000,
      image: '/images/default-product.jpg'
    }
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);

  const handleEdit = (listing) => {
    setEditingListing(listing);
    setShowCreateModal(true);
  };

  const handleDelete = (listingId) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      setListings(listings.filter(listing => listing.id !== listingId));
    }
  };

  const handleCreateNew = () => {
    setEditingListing(null);
    setShowCreateModal(true);
  };

  return (
    <div className="manage-listings">
      <div className="page-header">
        <div className="header-content">
          <h1>Manage Listings</h1>
          <p>Add, edit, or remove your services and items.</p>
        </div>
        <button className="create-btn" onClick={handleCreateNew}>
          <i className="fas fa-plus"></i>
          Create New Listing
        </button>
      </div>

      <div className="listings-grid">
        {listings.map(listing => (
          <div key={listing.id} className="listing-card">
            <div className="listing-image">
              <img src={listing.image} alt={listing.name} />
            </div>
            <div className="listing-content">
              <div className="listing-header">
                <h3>{listing.name}</h3>
                <div className="listing-actions">
                  <button 
                    className="action-btn"
                    onClick={() => handleEdit(listing)}
                  >
                    <i className="fas fa-ellipsis-v"></i>
                  </button>
                </div>
              </div>
              <span className="listing-category">{listing.category}</span>
              <p className="listing-description">{listing.description}</p>
              <div className="listing-price">
                <span>RM{listing.price.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal would go here */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingListing ? 'Edit Listing' : 'Create New Listing'}</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Create/Edit form would go here...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageListings; 