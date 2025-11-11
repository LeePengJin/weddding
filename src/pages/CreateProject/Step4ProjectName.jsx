import React, { useState } from 'react';
import './CreateProject.styles.css';

const Step4ProjectName = ({ formData, updateFormData, error, setError }) => {
  const [nameError, setNameError] = useState('');

  const handleNameChange = (e) => {
    const value = e.target.value;
    updateFormData('projectName', value);
    
    // Clear errors
    setNameError('');
    setError(null);

    // Real-time validation
    if (value.trim().length > 0 && value.trim().length < 3) {
      setNameError('Project name must be at least 3 characters');
    } else if (value.trim().length > 100) {
      setNameError('Project name must be less than 100 characters');
    }
  };

  const handleBlur = () => {
    if (!formData.projectName.trim()) {
      setNameError('Project name is required');
    } else if (formData.projectName.trim().length < 3) {
      setNameError('Project name must be at least 3 characters');
    }
  };

  return (
    <div className="step-content step4-content">
      <div className="step-header">
        <div className="step-icon">
          <i className="fas fa-edit"></i>
        </div>
        <h2 className="step-title">Project Name</h2>
      </div>

      <div className="step-description">
        <p>Give Your Project a Name</p>
      </div>

      <div className="project-name-input-wrapper">
        <input
          type="text"
          className={`project-name-input ${nameError ? 'error' : ''}`}
          placeholder='e.g. "Our Summer Wedding"'
          value={formData.projectName}
          onChange={handleNameChange}
          onBlur={handleBlur}
          maxLength={100}
        />
        {nameError && (
          <div className="input-error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{nameError}</span>
          </div>
        )}
        {formData.projectName && !nameError && (
          <div className="input-success-message">
            <i className="fas fa-check-circle"></i>
            <span>Looks good!</span>
          </div>
        )}
        <div className="character-count">
          {formData.projectName.length}/100
        </div>
      </div>

      <div className="project-name-suggestions">
        <p className="suggestions-label">Need inspiration? Try:</p>
        <div className="suggestions-list">
          {['Our Dream Wedding', 'Summer Celebration', 'Garden Bliss', 'Elegant Affair'].map((suggestion) => (
            <button
              key={suggestion}
              className="suggestion-chip"
              onClick={() => {
                updateFormData('projectName', suggestion);
                setNameError('');
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step4ProjectName;

