import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import Step1DateSelection from './Step1DateSelection';
import Step2VenueSelection from './Step2VenueSelection';
import Step3WeddingType from './Step3WeddingType';
import Step4ProjectName from './Step4ProjectName';
import Step5Summary from './Step5Summary';
import './CreateProject.styles.css';

const CreateProject = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    weddingDate: null, // ISO date string
    weddingTime: '', // HH:mm format
    venueServiceListingId: null,
    venue: null, // Full venue object
    weddingType: '', // 'self_organized' or 'prepackaged'
    basePackageId: null, // For prepackaged
    projectName: ''
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null); // Clear error when updating
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
      setError(null);
    }
  };

  const nextStep = async () => {
    setError(null);
    
    // Validation for each step
    if (step === 1) {
      if (!formData.weddingDate) {
        setError('Please select a wedding date');
        return;
      }
      if (!formData.weddingTime) {
        setError('Please select a wedding time');
        return;
      }
    } else if (step === 2) {
      if (!formData.venueServiceListingId || !formData.venue) {
        setError('Please select a venue');
        return;
      }
    } else if (step === 3) {
      if (!formData.weddingType) {
        setError('Please select a wedding type');
        return;
      }
      if (formData.weddingType === 'prepackaged' && !formData.basePackageId) {
        setError('Please select a package');
        return;
      }
    } else if (step === 4) {
      if (!formData.projectName.trim()) {
        setError('Please enter a project name');
        return;
      }
      if (formData.projectName.trim().length < 3) {
        setError('Project name must be at least 3 characters');
        return;
      }
    }

    setStep(prev => prev + 1);
  };

  const handleCreateProject = async () => {
    try {
      setLoading(true);
      setError(null);

      // Final validation
      if (!formData.weddingDate || !formData.weddingTime || !formData.venueServiceListingId || 
          !formData.weddingType || !formData.projectName.trim()) {
        setError('Please complete all required fields');
        setLoading(false);
        return;
      }

      // Combine date and time into ISO string
      const dateTime = new Date(`${formData.weddingDate}T${formData.weddingTime}`);
      const weddingDateTime = dateTime.toISOString();

      // Prepare project data
      const projectData = {
        projectName: formData.projectName.trim(),
        weddingDate: weddingDateTime,
        weddingType: formData.weddingType,
        venueServiceListingId: formData.venueServiceListingId,
        basePackageId: formData.basePackageId || null
      };

      // Create project via API
      const createdProject = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify(projectData)
      });

      // Navigate to projects list (user can click on their new project)
      navigate('/projects');
    } catch (err) {
      setError(err.message || 'Failed to create project. Please try again.');
      setLoading(false);
    }
  };

  const renderProgressBar = () => {
    const steps = [
      { num: 1, label: 'Date & Time' },
      { num: 2, label: 'Venue' },
      { num: 3, label: 'Preparation' },
      { num: 4, label: 'Project Name' },
      { num: 5, label: 'Summary' }
    ];

    return (
      <div className="create-project-progress">
        <div className="progress-steps">
          {steps.map((stepItem, index) => (
            <div key={stepItem.num} className="progress-step-wrapper">
              <div className={`progress-step ${step >= stepItem.num ? 'active' : ''} ${step === stepItem.num ? 'current' : ''}`}>
                <div className="step-circle">
                  {step > stepItem.num ? (
                    <i className="fas fa-check"></i>
                  ) : (
                    <span>{stepItem.num}</span>
                  )}
                </div>
                <div className="step-label">{stepItem.label}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`progress-line ${step > stepItem.num ? 'active' : ''}`}></div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    const commonProps = {
      formData,
      updateFormData,
      error,
      setError
    };

    switch(step) {
      case 1:
        return <Step1DateSelection {...commonProps} />;
      case 2:
        return <Step2VenueSelection {...commonProps} />;
      case 3:
        return <Step3WeddingType {...commonProps} />;
      case 4:
        return <Step4ProjectName {...commonProps} />;
      case 5:
        return <Step5Summary {...commonProps} onConfirm={handleCreateProject} loading={loading} />;
      default:
        return null;
    }
  };

  return (
    <div className="create-project-container">
      <div className="create-project-header">
        <h1 className="create-project-title">Create Your Dream Wedding Project</h1>
        <p className="create-project-subtitle">
          Let's bring your dream wedding to life step by step.
        </p>
      </div>

      {renderProgressBar()}

      <div className="create-project-content">
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="step-container">
          {renderStep()}
        </div>

        <div className="navigation-buttons">
          {step > 1 && (
            <button className="nav-button prev-button" onClick={prevStep}>
              <i className="fas fa-arrow-left"></i>
              <span>Previous</span>
            </button>
          )}
          {step < 5 && (
            <button className="nav-button next-button" onClick={nextStep}>
              <span>Next</span>
              <i className="fas fa-arrow-right"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateProject;

