import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import './CreateProject.styles.css';

const Step3WeddingType = ({ formData, updateFormData, error, setError }) => {
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  useEffect(() => {
    // Fetch packages if prepackaged is selected
    if (formData.weddingType === 'prepackaged') {
      fetchPackages();
    }
  }, [formData.weddingType]);

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true);
      // TODO: Replace with actual API endpoint when available
      // const data = await apiFetch('/packages');
      // For now, use placeholder data
      const data = [];
      setPackages(data);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
      // For now, use empty array since packages are not yet implemented
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleWeddingTypeSelect = (type) => {
    updateFormData('weddingType', type);
    updateFormData('basePackageId', null); // Reset package selection
    setError(null);
  };

  const handlePackageSelect = (packageId) => {
    updateFormData('basePackageId', packageId);
    setError(null);
  };

  return (
    <div className="step-content step3-content">
      <div className="step-header">
        <div className="step-icon">
          <i className="fas fa-gift"></i>
        </div>
        <h2 className="step-title">Preparation</h2>
      </div>

      <div className="step-description">
        <p>How would you like to prepare?</p>
      </div>

      <div className="wedding-type-options">
        <div
          className={`wedding-type-card ${formData.weddingType === 'self_organized' ? 'selected' : ''}`}
          onClick={() => handleWeddingTypeSelect('self_organized')}
        >
          <div className="type-icon">
            <i className="fas fa-palette"></i>
          </div>
          <h3 className="type-title">Self-Organized</h3>
          <p className="type-description">
            Plan everything yourself with our design tools and guidance
          </p>
        </div>

        <div
          className={`wedding-type-card ${formData.weddingType === 'prepackaged' ? 'selected' : ''}`}
          onClick={() => handleWeddingTypeSelect('prepackaged')}
        >
          <div className="type-icon">
            <i className="fas fa-box"></i>
          </div>
          <h3 className="type-title">Pre-designed Package</h3>
          <p className="type-description">
            Choose from our curated packages with professional arrangements
          </p>
        </div>
      </div>

      {formData.weddingType === 'prepackaged' && (
        <div className="packages-section">
          {loadingPackages ? (
            <div className="loading-packages">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading packages...</p>
            </div>
          ) : packages.length === 0 ? (
            <div className="no-packages">
              <i className="fas fa-info-circle"></i>
              <p>Packages are currently being set up by our team. Please check back soon or choose Self-Organized to continue.</p>
            </div>
          ) : (
            <div className="packages-grid">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`package-card ${formData.basePackageId === pkg.id ? 'selected' : ''}`}
                  onClick={() => handlePackageSelect(pkg.id)}
                >
                  <h4 className="package-name">{pkg.name}</h4>
                  <div className="package-price">RM {pkg.price?.toLocaleString() || '0'}</div>
                  {pkg.description && (
                    <p className="package-description">{pkg.description}</p>
                  )}
                  {pkg.components && pkg.components.length > 0 && (
                    <ul className="package-features">
                      {pkg.components.map((component, idx) => (
                        <li key={idx}>{component.name || component}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Step3WeddingType;

