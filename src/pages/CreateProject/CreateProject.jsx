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
    weddingDate: null, // ISO date string (date only)
    eventStartTime: '', // HH:mm format
    eventEndTime: '', // HH:mm format
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
      if (!formData.eventStartTime) {
        setError('Please select a start time');
        return;
      }
      if (!formData.eventEndTime) {
        setError('Please select an end time');
        return;
      }
      
      // Validate business hours (8 AM - 11 PM)
      const startHour = parseInt(formData.eventStartTime.split(':')[0]);
      const endHour = parseInt(formData.eventEndTime.split(':')[0]);
      const startMinute = parseInt(formData.eventStartTime.split(':')[1]);
      const endMinute = parseInt(formData.eventEndTime.split(':')[1]);
      
      if (startHour < 8 || (startHour === 23 && startMinute > 0) || startHour >= 23) {
        setError('Start time must be between 8:00 AM and 11:00 PM');
        return;
      }
      if (endHour < 8 || (endHour === 23 && endMinute > 0) || endHour >= 23) {
        setError('End time must be between 8:00 AM and 11:00 PM');
        return;
      }
      
      // Validate end time is after start time
      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;
      if (endTimeMinutes <= startTimeMinutes) {
        setError('End time must be after start time');
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
      if (!formData.weddingDate || !formData.eventStartTime || !formData.eventEndTime || 
          !formData.venueServiceListingId || !formData.weddingType || !formData.projectName.trim()) {
        setError('Please complete all required fields');
        setLoading(false);
        return;
      }

      // Combine date with start and end times into ISO strings
      const startDateTime = new Date(`${formData.weddingDate}T${formData.eventStartTime}`);
      const endDateTime = new Date(`${formData.weddingDate}T${formData.eventEndTime}`);
      const weddingDateOnly = new Date(`${formData.weddingDate}T00:00:00`);

      // Prepare project data
      const projectData = {
        projectName: formData.projectName.trim(),
        weddingDate: weddingDateOnly.toISOString(),
        eventStartTime: startDateTime.toISOString(),
        eventEndTime: endDateTime.toISOString(),
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
    const stepsList = [1, 2, 3, 4, 5];
    const progressRatio =
      stepsList.length > 1 ? (step - 1) / (stepsList.length - 1) : 0;

    return (
      <div className="create-project-progress">
        <div
          className="progress-stepper"
          style={{ '--progress-ratio': progressRatio }}
        >
          {stepsList.map((stepNumber) => {
            const status =
              stepNumber < step ? 'completed' : stepNumber === step ? 'current' : 'upcoming';

            return (
              <div key={stepNumber} className={`stepper-circle ${status}`}>
                {status === 'completed' ? (
                  <i className="fas fa-check"></i>
                ) : (
                  <span>{stepNumber}</span>
                )}
              </div>
            );
          })}
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
          {step > 1 ? (
            <button className="nav-button prev-button" onClick={prevStep}>
              <i className="fas fa-arrow-left"></i>
              <span>Previous</span>
            </button>
          ) : (
            <span className="nav-button-spacer" />
          )}
          {step < 5 ? (
            <button className="nav-button next-button" onClick={nextStep}>
              <span>Next</span>
              <i className="fas fa-arrow-right"></i>
            </button>
          ) : (
            <span className="nav-button-spacer" />
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateProject;

