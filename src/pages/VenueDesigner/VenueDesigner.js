import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './VenueDesigner.styles.css';
import DesignSummary from './DesignSummary';

const VenueDesigner = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [totalBudget] = useState(15000);
  const [currentExpenses, setCurrentExpenses] = useState(3200);
  const [placedItems, setPlacedItems] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedItemInfo, setSelectedItemInfo] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Mock vendor items catalog
  const [vendorItems] = useState([
    {
      id: 1,
      name: "Round Dining Table",
      category: "Tables",
      vendor: "Elegant Furniture Co.",
      price: 450,
      image: "/images/default-product.jpg",
      description: "8-seater round table perfect for wedding receptions"
    },
    {
      id: 2,
      name: "Chiavari Chairs (Set of 8)",
      category: "Chairs",
      vendor: "Classic Seating",
      price: 320,
      image: "/images/default-product.jpg",
      description: "Gold chiavari chairs, elegant and comfortable"
    },
    {
      id: 3,
      name: "Fairy Light Backdrop",
      category: "Decorations",
      vendor: "Dreamy Decorations",
      price: 280,
      image: "/images/default-product.jpg",
      description: "Beautiful fairy light backdrop for ceremony"
    },
    {
      id: 4,
      name: "Floral Centerpiece",
      category: "Flowers",
      vendor: "Blooming Gardens",
      price: 150,
      image: "/images/default-product.jpg",
      description: "Elegant rose and eucalyptus centerpiece"
    },
    {
      id: 5,
      name: "White Linens (Per Table)",
      category: "Linens",
      vendor: "Luxury Linens",
      price: 35,
      image: "/images/default-product.jpg",
      description: "Premium white table linens"
    },
    {
      id: 6,
      name: "Photo Booth Setup",
      category: "Entertainment",
      vendor: "Fun Moments",
      price: 650,
      image: "/images/default-product.jpg",
      description: "Complete photo booth with props and backdrop"
    }
  ]);

  const categories = ['All Categories', 'Tables', 'Chairs', 'Decorations', 'Flowers', 'Linens', 'Entertainment'];

  const filteredItems = vendorItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddItem = (item) => {
    setCurrentExpenses(prev => prev + item.price);
    setPlacedItems(prev => [...prev, { ...item, placedId: Date.now() }]);
  };

  const remainingBudget = totalBudget - currentExpenses;
  const budgetProgress = (currentExpenses / totalBudget) * 100;

  return (
    <div className="venue-designer">
      {/* Custom Navigation Bar */}
      <div className="designer-navbar">
        <div className="navbar-left">
          <Link to="/project-dashboard" className="back-link">
            <i className="fas fa-arrow-left"></i>
            3D Venue Designer
          </Link>
        </div>

        <div className="navbar-center">
          <div className="budget-tracker">
            <div className="budget-item">
              <span className="budget-label">Total Budget</span>
              <span className="budget-value">RM {totalBudget.toLocaleString()}</span>
            </div>
            <div className="budget-item">
              <span className="budget-label">Spent</span>
              <span className="budget-value spent">RM {currentExpenses.toLocaleString()}</span>
            </div>
            <div className="budget-item">
              <span className="budget-label">Remaining</span>
              <span className={`budget-value ${remainingBudget < 1000 ? 'warning' : 'remaining'}`}>
                RM {remainingBudget.toLocaleString()}
              </span>
            </div>
            <div className="budget-progress">
              <div className="budget-bar">
                <div 
                  className="budget-fill" 
                  style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                ></div>
              </div>
              <span className="budget-percentage">{budgetProgress.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="navbar-right">
          <button className="save-design-btn">
            <i className="fas fa-save"></i>
            Save Design
          </button>
          <button className="summary-btn">
            <i className="fas fa-list-alt"></i>
            Summary
          </button>
          <button 
            className="checkout-btn"
            onClick={() => setShowCheckout(true)}
          >
            <i className="fas fa-shopping-cart"></i>
            Proceed to Checkout
          </button>
        </div>
      </div>

      <div className="designer-content">
        {/* Left Sidebar - Item Catalog */}
        <div className={`catalog-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-title">
              <h3>Item Catalog</h3>
              {!sidebarCollapsed && <p>Drag items to your venue space</p>}
            </div>
            <button 
              className="collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <i className={`fas fa-chevron-${sidebarCollapsed ? 'right' : 'left'}`}></i>
            </button>
          </div>

          {/* Search and Filter */}
          {!sidebarCollapsed && (
            <div className="catalog-controls">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="category-filter">
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Items Grid */}
          {!sidebarCollapsed && (
            <div className="items-grid">
              {filteredItems.map(item => (
                <div key={item.id} className="catalog-item" draggable="true">
                  <div className="item-image">
                    <img src={item.image} alt={item.name} />
                    <div className="item-overlay">
                      <button 
                        className="add-item-btn"
                        onClick={() => handleAddItem(item)}
                        disabled={remainingBudget < item.price}
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                      <button 
                        className="info-item-btn"
                        onClick={() => setSelectedItemInfo(item)}
                      >
                        <i className="fas fa-info"></i>
                      </button>
                    </div>
                  </div>
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <p className="item-vendor">{item.vendor}</p>
                    <p className="item-price">RM {item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="no-items">
              <i className="fas fa-search"></i>
              <p>No items found</p>
            </div>
          )}
        </div>

        {/* Main 3D Venue Space */}
        <div className="venue-space">
          <div className="space-header">
            <h3>Wedding Venue Design</h3>
          </div>

          <div className="design-canvas">
            <div className="canvas-placeholder">
              <div className="venue-outline">
                <div className="venue-floor">
                  {placedItems.map(item => (
                    <div key={item.placedId} className="placed-item">
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="canvas-hint">
                <i className="fas fa-mouse-pointer"></i>
                <p>Drag items from the catalog to place them in your venue</p>
                <p className="hint-secondary">Items placed: {placedItems.length}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Item Details Modal */}
        {selectedItemInfo && (
          <div className="item-details-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Item Details</h3>
                <button 
                  className="close-modal-btn"
                  onClick={() => setSelectedItemInfo(null)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="item-details-grid">
                  <div className="item-image-large">
                    <img src={selectedItemInfo.image} alt={selectedItemInfo.name} />
                  </div>
                  
                  <div className="item-details-info">
                    <h4>{selectedItemInfo.name}</h4>
                    <p className="item-description">{selectedItemInfo.description}</p>
                    <div className="item-price-large">RM {selectedItemInfo.price}</div>
                    
                    <div className="vendor-info">
                      <h5>Vendor Information</h5>
                      <p><strong>Vendor:</strong> {selectedItemInfo.vendor}</p>
                      <p><strong>Category:</strong> {selectedItemInfo.category}</p>
                    </div>
                    
                    <div className="item-actions">
                      <button 
                        className="add-to-design-btn"
                        onClick={() => {
                          handleAddItem(selectedItemInfo);
                          setSelectedItemInfo(null);
                        }}
                        disabled={remainingBudget < selectedItemInfo.price}
                      >
                        <i className="fas fa-plus"></i>
                        Add to Design
                      </button>
                      <button 
                        className="message-vendor-btn"
                        onClick={() => {
                          // Navigate to messages - in real app would open chat with specific vendor
                          window.location.href = '/messages';
                        }}
                      >
                        <i className="fas fa-comment"></i>
                        Message Vendor
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkout Summary Modal */}
        {showCheckout && (
          <DesignSummary
            onClose={() => setShowCheckout(false)}
            onSubmit={() => {
              setShowCheckout(false);
              // In a real app, we would save the design and redirect to the dashboard
            }}
          />
        )}
      </div>
    </div>
  );
};

export default VenueDesigner; 