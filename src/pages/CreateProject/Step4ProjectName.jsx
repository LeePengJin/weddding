import React, { useState } from 'react';
import './CreateProject.styles.css';

const Step4ProjectName = ({ formData, updateFormData, error, setError }) => {
  const [nameError, setNameError] = useState('');
  const [budgetError, setBudgetError] = useState('');

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

      <div className="budget-input-section">
        <div className="step-header" style={{ marginTop: '2rem', marginBottom: '1rem' }}>
          <div className="step-icon">
            <i className="fas fa-wallet"></i>
          </div>
          <h3 className="step-title" style={{ fontSize: '1.2rem' }}>Total Budget (Optional)</h3>
        </div>
        <div className="step-description" style={{ marginBottom: '1rem' }}>
          <p>Set your total budget for this project. You can modify this later in Budget Management.</p>
        </div>
        <div className="project-name-input-wrapper">
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ 
              position: 'absolute', 
              left: '1rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: '#666',
              fontSize: '1rem'
            }}>RM</span>
            <input
              type="number"
              className={`project-name-input ${budgetError ? 'error' : ''}`}
              placeholder="0.00"
              value={formData.totalBudget}
              onChange={(e) => {
                const value = e.target.value;
                updateFormData('totalBudget', value);
                setBudgetError('');
                setError(null);
                
                // Validation
                if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
                  setBudgetError('Budget must be a positive number');
                }
              }}
              onBlur={() => {
                if (formData.totalBudget && (isNaN(parseFloat(formData.totalBudget)) || parseFloat(formData.totalBudget) < 0)) {
                  setBudgetError('Budget must be a positive number');
                }
              }}
              min="0"
              step="0.01"
              style={{ paddingLeft: '3.5rem' }}
            />
          </div>
          {budgetError && (
            <div className="input-error-message">
              <i className="fas fa-exclamation-circle"></i>
              <span>{budgetError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step4ProjectName;

