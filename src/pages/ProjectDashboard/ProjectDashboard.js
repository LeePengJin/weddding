import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import VendorDetailsPopup from '../../components/VendorDetailsPopup/VendorDetailsPopup';
import './ProjectDashboard.styles.css';

const ProjectDashboard = () => {
  // Mock project data - in real app this would come from props/context/API
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [projectData] = useState({
    projectName: "Sarah & John's Dream Wedding",
    date: "2024-06-15",
    time: "18:00",
    venue: "Beach",
    preparationType: "Self-Organized",
    budget: {
      total: 25000,
      spent: 18500,
      categories: {
        venue: 12000,
        catering: 3500,
        photography: 3000,
        decorations: 3000
      }
    },
    checklist: {
      total: 20,
      completed: 12,
      categories: {
        venue: { total: 6, completed: 3 },
        catering: { total: 8, completed: 2 },
        photography: { total: 4, completed: 2 },
        flowers: { total: 6, completed: 1 }
      }
    },
    payments: {
      totalBudget: 15000,
      totalPaid: 4500,
      totalOutstanding: 10500,
      recentPayments: [
        {
          vendor: "Elegant Moments Photography",
          amount: 1500,
          type: "Deposit",
          date: "2024-11-15",
          status: "completed"
        },
        {
          vendor: "Golden Palace Catering",
          amount: 3000,
          type: "Advance Payment", 
          date: "2024-11-20",
          status: "completed"
        }
      ],
      upcomingPayments: [
        {
          vendor: "Blooming Gardens Florist",
          amount: 800,
          type: "Deposit",
          dueDate: "2024-12-15",
          status: "pending"
        },
        {
          vendor: "Harmony Sound DJ Services",
          amount: 2200,
          type: "Full Payment",
          dueDate: "2025-01-10",
          status: "pending"
        }
      ]
    },
          vendors: [
        {
          name: "Elegant Moments Photography",
          type: "Photographer",
          contact: "+60 12-345 6789",
          email: "info@elegantmoments.com",
          address: "123 Studio Street, Photography Lane",
          website: "https://elegantmoments.com",
          status: "confirmed",
          notes: "Full day coverage package selected. Pre-wedding shoot scheduled for May 2025."
        },
        {
          name: "Golden Palace Catering",
          type: "Caterer",
          contact: "+60 3-1234 5678",
          email: "events@goldenpalace.com",
          address: "456 Culinary Avenue",
          website: "https://goldenpalacecatering.com",
          status: "in-discussion",
          notes: "Menu tasting scheduled. Discussing dietary requirements and final guest count."
        },
        {
          name: "Blooming Gardens Florist",
          type: "Florist",
          contact: "+60 17-789 0123",
          email: "flowers@bloominggardens.com",
          address: "789 Floral Drive",
          website: "https://bloominggardens.com",
          status: "pending",
          notes: "Initial consultation completed. Waiting for seasonal flower availability confirmation."
        },
        {
          name: "Harmony Sound DJ Services",
          type: "DJ",
          contact: "+60 19-456 7890",
          email: "bookings@harmonysound.com",
          website: "https://harmonysound.com",
          status: "confirmed",
          notes: "Playlist preferences discussed. Equipment setup confirmed for venue."
        },
        {
          name: "Dreamy Decorations",
          type: "Decorator",
          contact: "+60 16-567 8901",
          email: "design@dreamydecor.com",
          address: "321 Design Boulevard",
          website: "https://dreamydecor.com",
          status: "in-discussion",
          notes: "Theme colors selected. Finalizing centerpiece designs and lighting setup."
        }
      ]
  });

  const budgetProgress = (projectData.budget.spent / projectData.budget.total) * 100;
  const checklistProgress = (projectData.checklist.completed / projectData.checklist.total) * 100;
  const daysUntilWedding = Math.ceil((new Date(projectData.date) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div className="dashboard-container">
      {/* Back Navigation */}
      <div className="dashboard-navigation">
        <Link to="/projects" className="back-to-projects">
          <i className="fas fa-arrow-left"></i>
          Back to Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="project-header">
        <div className="project-info">
          <h1>{projectData.projectName}</h1>
          <div className="project-details">
            <div className="detail-item">
              <i className="fas fa-calendar grey-icon"></i>
              <span>{new Date(projectData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="detail-item">
              <i className="fas fa-clock grey-icon"></i>
              <span>{projectData.time}</span>
            </div>
            <div className="detail-item">
              <i className="fas fa-map-marker-alt grey-icon"></i>
              <span>{projectData.venue} Venue</span>
            </div>
          </div>
        </div>
        <div className="countdown-card">
          <div className="countdown-number">{daysUntilWedding > 0 ? daysUntilWedding : 0}</div>
          <div className="countdown-label">Days Until Wedding</div>
        </div>
      </div>

      {/* Progress Overview Cards */}
      <div className="progress-overview">
        <div className="progress-card budget-overview">
          <div className="progress-header">
            <div className="progress-icon budget-icon">
              <i className="fas fa-dollar-sign"></i>
            </div>
            <h3>Budget Overview</h3>
          </div>
          <div className="progress-content">
            <div className="budget-amounts">
              <span className="spent-amount">Spent: RM{projectData.budget.spent.toLocaleString()}</span>
              <span className="total-amount">Total: RM{projectData.budget.total.toLocaleString()}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${budgetProgress}%` }}></div>
            </div>
            <div className="remaining-amount">RM{(projectData.budget.total - projectData.budget.spent).toLocaleString()} remaining</div>
          </div>
        </div>

        <div className="progress-card checklist-overview">
          <div className="progress-header">
            <div className="progress-icon checklist-icon">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <h3>Planning Progress</h3>
          </div>
          <div className="progress-content">
            <div className="checklist-counts">
              <span className="completed-tasks">{projectData.checklist.completed} of {projectData.checklist.total} tasks</span>
              <span className="progress-percentage">{Math.round(checklistProgress)}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${checklistProgress}%` }}></div>
            </div>
            <div className="remaining-tasks">{projectData.checklist.total - projectData.checklist.completed} tasks remaining</div>
          </div>
        </div>
      </div>

      {/* Main Management Cards */}
      <div className="management-cards">
        <div className="management-card budget-card">
          <div className="card-header">
            <div className="card-icon budget-manager-icon">
              <i className="fas fa-dollar-sign"></i>
            </div>
            <div className="card-title">
              <h3>Budget Manager</h3>
              <p>Track expenses and manage payments</p>
            </div>
          </div>
          <div className="card-details">
            <div className="detail-row">
              <span>Venue & Catering</span>
              <span>RM{projectData.budget.categories.venue.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>Photography</span>
              <span>RM{projectData.budget.categories.photography.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>Decorations</span>
              <span>RM{projectData.budget.categories.decorations.toLocaleString()}</span>
            </div>
          </div>
          <Link to="/budget" className="card-button budget-button">
            Manage Budget <i className="fas fa-chevron-right"></i>
          </Link>
        </div>

        <div className="management-card checklist-card">
          <div className="card-header">
            <div className="card-icon checklist-manager-icon">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <div className="card-title">
              <h3>Wedding Checklist</h3>
              <p>Stay organized with planning tasks</p>
            </div>
          </div>
          <div className="card-details">
            <div className="task-item completed">
              <i className="fas fa-check-circle"></i>
              <span>Book venue & catering</span>
            </div>
            <div className="task-item completed">
              <i className="fas fa-check-circle"></i>
              <span>Hire photographer</span>
            </div>
            <div className="task-item pending">
              <i className="fas fa-circle"></i>
              <span>Send invitations</span>
            </div>
            <div className="task-item pending">
              <i className="fas fa-circle"></i>
              <span>Final venue walkthrough</span>
            </div>
          </div>
          <Link to="/checklist" className="card-button checklist-button">
            View Checklist <i className="fas fa-chevron-right"></i>
          </Link>
        </div>

        <div className="management-card venue-card">
          <div className="card-header">
            <div className="card-icon venue-manager-icon">
              <i className="fas fa-cube"></i>
            </div>
            <div className="card-title">
              <h3>3D Venue Designer</h3>
              <p>Design your perfect wedding space</p>
            </div>
          </div>
          <div className="card-details">
            <div className="venue-preview">
              <div className="preview-placeholder">
                <i className="fas fa-camera"></i>
                <span>3D Preview</span>
              </div>
            </div>
          </div>
          <Link to="/venue-designer" className="card-button venue-button">
            Open 3D Designer <i className="fas fa-chevron-right"></i>
          </Link>
        </div>

        <div className="management-card payments-card">
          <div className="card-header">
            <div className="card-icon payments-manager-icon">
              <i className="fas fa-credit-card"></i>
            </div>
            <div className="card-title">
              <h3>Payment Management</h3>
              <p>Track payments and transactions</p>
            </div>
          </div>
          <div className="card-details">
            <div className="payment-summary">
              <div className="payment-item">
                <span className="payment-label">Total Paid</span>
                <span className="payment-amount paid">RM{projectData.payments.totalPaid.toLocaleString()}</span>
              </div>
              <div className="payment-item">
                <span className="payment-label">Outstanding</span>
                <span className="payment-amount outstanding">RM{projectData.payments.totalOutstanding.toLocaleString()}</span>
              </div>
            </div>
            <div className="upcoming-payments">
              <span className="upcoming-label">Next Due:</span>
              {projectData.payments.upcomingPayments.slice(0, 1).map((payment, index) => (
                <div key={index} className="payment-due">
                  <span className="payment-vendor">{payment.vendor}</span>
                  <span className="payment-due-amount">RM{payment.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/payments" className="card-button payments-button">
            Manage Payments <i className="fas fa-chevron-right"></i>
          </Link>
        </div>

        <div className="management-card vendors-card">
          <div className="card-header">
            <div className="card-icon vendors-manager-icon">
              <i className="fas fa-users"></i>
            </div>
            <div className="card-title">
              <h3>Vendor Management</h3>
              <p>Manage your wedding vendors</p>
            </div>
          </div>
          <div className="card-details">
            {projectData.vendors.map((vendor, index) => (
              <div key={index} className="vendor-item">
                <span className="vendor-name">{vendor.name}</span>
                <span className="vendor-type">{vendor.type}</span>
              </div>
            ))}
          </div>
                          <button 
                  className="card-button vendors-button"
                  onClick={() => setShowVendorDetails(true)}
                >
                  View Details <i className="fas fa-chevron-right"></i>
                </button>

                {showVendorDetails && (
                  <VendorDetailsPopup
                    vendors={projectData.vendors}
                    onClose={() => setShowVendorDetails(false)}
                  />
                )}
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="quick-actions">
        <button className="quick-action-btn">
          <i className="fas fa-plus"></i>
          Add Task
        </button>
        <button className="quick-action-btn">
          <i className="fas fa-receipt"></i>
          Add Expense
        </button>
        <button className="quick-action-btn">
          <i className="fas fa-share"></i>
          Share Project
        </button>
        <button className="quick-action-btn">
          <i className="fas fa-download"></i>
          Export Data
        </button>
      </div>
    </div>
  );
};

export default ProjectDashboard; 