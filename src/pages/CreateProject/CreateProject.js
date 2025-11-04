import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateProject.styles.css';

const CreateProject = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    venue: '',
    preparationType: '',
    packageType: '',
    projectName: ''
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
  };

  const nextStep = () => {
    if (formData.preparationType === 'package' && !formData.packageType && step === 3) {
      alert('Please select a package to proceed');
      return;
    }
    if (step === 4) {
      if (!formData.projectName.trim()) {
        alert('Please enter a project name');
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const createProject = () => {
    // In a real app, this would save to backend
    console.log('Project created:', formData);
    // Navigate to the project dashboard
    navigate('/project-dashboard');
  };

  const renderProgressBar = () => {
    return (
      <div className="progress-bar">
        {[1, 2, 3, 4, 5].map((num) => (
          <div key={num} className="progress-step">
            <div className={`step-circle ${step >= num ? 'active' : ''}`}>{num}</div>
            <div className={`step-label ${step >= num ? 'active' : ''}`}>
              {num === 1 && 'Date & Time'}
              {num === 2 && 'Venue'}
              {num === 3 && 'Preparation'}
              {num === 4 && 'Project Name'}
              {num === 5 && 'Summary'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSummary = () => {
    return (
      <div className="form-step summary-step">
        <h2>Project Summary</h2>
        <div className="summary-content">
          <div className="summary-item">
            <h3>Wedding Details</h3>
            <p><strong>Date:</strong> {formData.date}</p>
            <p><strong>Time:</strong> {formData.time}</p>
            <p><strong>Venue:</strong> {formData.venue}</p>
          </div>

          <div className="summary-item">
            <h3>Preparation Type</h3>
            <p><strong>Type:</strong> {formData.preparationType === 'self' ? 'Self-Organized' : 'Pre-packaged'}</p>
            {formData.preparationType === 'package' && (
              <p><strong>Package Selected:</strong> {formData.packageType} Package</p>
            )}
          </div>

          <div className="summary-item">
            <h3>Project Name</h3>
            <p>{formData.projectName}</p>
          </div>
        </div>

        <div className="summary-actions">
          <button className="modify-button" onClick={() => setStep(1)}>
            Modify Details
          </button>
          <button className="confirm-button" onClick={createProject}>
            Confirm & Create
          </button>
        </div>
      </div>
    );
  };

  const renderPackageOptions = () => {
    return (
      <div className="package-options">
        <div 
          className={`package-card ${formData.packageType === 'basic' ? 'selected' : ''}`}
          onClick={() => updateFormData('packageType', 'basic')}
        >
          <h3>Basic Package</h3>
          <div className="package-price">$5,000</div>
          <ul>
            <li>Venue decoration</li>
            <li>Basic catering (50 pax)</li>
            <li>Photography service (4 hours)</li>
            <li>Basic sound system</li>
          </ul>
        </div>

        <div 
          className={`package-card ${formData.packageType === 'premium' ? 'selected' : ''}`}
          onClick={() => updateFormData('packageType', 'premium')}
        >
          <h3>Premium Package</h3>
          <div className="package-price">$10,000</div>
          <ul>
            <li>Luxury venue decoration</li>
            <li>Premium catering (100 pax)</li>
            <li>Photography & Videography (8 hours)</li>
            <li>Professional sound system</li>
            <li>Live band performance</li>
            <li>Wedding cake</li>
          </ul>
        </div>

        <div 
          className={`package-card ${formData.packageType === 'luxury' ? 'selected' : ''}`}
          onClick={() => updateFormData('packageType', 'luxury')}
        >
          <h3>Luxury Package</h3>
          <div className="package-price">$20,000</div>
          <ul>
            <li>Premium venue decoration with fresh flowers</li>
            <li>Gourmet catering (200 pax)</li>
            <li>Full day photography & videography</li>
            <li>Professional sound & lighting system</li>
            <li>Live band & DJ</li>
            <li>Custom wedding cake</li>
            <li>Wedding planner service</li>
            <li>Bridal car service</li>
          </ul>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="form-step">
            <h2>Select Date and Time</h2>
            <div className="form-group">
              <label>Wedding Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => updateFormData('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Wedding Time</label>
              <input 
                type="time" 
                value={formData.time}
                onChange={(e) => updateFormData('time', e.target.value)}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="form-step">
            <h2>Select Venue</h2>
            <div className="venue-grid">
              {['Beach', 'Garden', 'Church', 'Hotel'].map((venue) => (
                <div 
                  key={venue}
                  className={`venue-card ${formData.venue === venue ? 'selected' : ''}`}
                  onClick={() => updateFormData('venue', venue)}
                >
                  <img src={`/images/venues/${venue.toLowerCase()}.jpg`} alt={venue} />
                  <h3>{venue}</h3>
                </div>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="form-step">
            <h2>Choose Preparation Type</h2>
            <div className="preparation-options">
              <div 
                className={`prep-option ${formData.preparationType === 'self' ? 'selected' : ''}`}
                onClick={() => {
                  updateFormData('preparationType', 'self');
                  updateFormData('packageType', ''); // Reset package selection when switching to self
                }}
              >
                <h3>Self-Organized</h3>
                <p>Plan everything yourself with our tools and guidance</p>
              </div>
              <div 
                className={`prep-option ${formData.preparationType === 'package' ? 'selected' : ''}`}
                onClick={() => updateFormData('preparationType', 'package')}
              >
                <h3>Pre-packaged</h3>
                <p>Choose from our curated wedding packages</p>
              </div>
            </div>
            {formData.preparationType === 'package' && renderPackageOptions()}
          </div>
        );
      case 4:
        return (
          <div className="form-step">
            <h2>Name Your Wedding Project</h2>
            <div className="form-group">
              <input 
                type="text" 
                placeholder="Enter your wedding project name"
                value={formData.projectName}
                onChange={(e) => updateFormData('projectName', e.target.value)}
                className="project-name-input"
              />
            </div>
          </div>
        );
      case 5:
        return renderSummary();
      default:
        return null;
    }
  };

  return (
    <div className="create-project-container">
      {renderProgressBar()}
      <div className="form-container">
        {renderStep()}
        <div className="navigation-buttons">
          {step > 1 && step < 5 && (
            <button className="prev-button" onClick={prevStep}>
              Previous
            </button>
          )}
          {step < 5 && (
            <button className="next-button" onClick={nextStep}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateProject;