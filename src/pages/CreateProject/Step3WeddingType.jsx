import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { formatImageUrl } from '../../utils/image';
import PackagePreview3D from '../../components/PackagePreview3D/PackagePreview3D';
import './CreateProject.styles.css';

const Step3WeddingType = ({ formData, updateFormData, error, setError }) => {
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [detailsPackage, setDetailsPackage] = useState(null);
  const [previewPackage, setPreviewPackage] = useState(null);

  useEffect(() => {
    // Fetch packages if prepackaged is selected
    if (formData.weddingType === 'prepackaged') {
      fetchPackages();
    }
  }, [formData.weddingType]);

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true);
      const data = await apiFetch('/packages');
      setPackages(data);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
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

  const handleViewDetails = (pkg, event) => {
    event.stopPropagation();
    setDetailsPackage(pkg);
  };

  const handlePreviewPackage = (pkg, event) => {
    event.stopPropagation();
    setPreviewPackage(pkg);
  };

  const closeDetailsModal = () => setDetailsPackage(null);
  const closePreviewModal = () => setPreviewPackage(null);

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
              {packages.map((pkg) => {
                const isSelected = formData.basePackageId === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`package-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handlePackageSelect(pkg.id)}
                  >
                    <div className="package-card__image">
                      {pkg.previewImage ? (
                        <img src={formatImageUrl(pkg.previewImage)} alt={`${pkg.packageName} preview`} />
                      ) : (
                        <div className="package-card__image--placeholder">
                          <i className="fas fa-cube"></i>
                          <span>3D preview coming soon</span>
                        </div>
                      )}
                      <div className="package-card__pill">
                        {pkg.designSummary?.elementCount
                          ? `${pkg.designSummary.elementCount} elements ready`
                          : 'Template in progress'}
                      </div>
                      {isSelected && <div className="package-card__check"><i className="fas fa-check" /></div>}
                    </div>
                    <div className="package-card__body">
                      <div className="package-card__header">
                        <div>
                          <h4 className="package-name">{pkg.packageName}</h4>
                          <p className="package-description">
                            {pkg.description || 'Curated venue layout with hand-picked services.'}
                          </p>
                        </div>
                        <span className="package-card__badge">{pkg.items?.length || 0} services</span>
                      </div>
                      {pkg.items && pkg.items.length > 0 && (
                        <div className="package-card__chips">
                          {pkg.items.slice(0, 3).map((item) => (
                            <span key={item.id || item.label} className="package-chip">
                              {item.label}
                            </span>
                          ))}
                          {pkg.items.length > 3 && (
                            <span className="package-chip package-chip--muted">
                              +{pkg.items.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      <div className="package-card__actions">
                        <button type="button" className="package-btn ghost" onClick={(e) => handleViewDetails(pkg, e)}>
                          Details
                        </button>
                        <button
                          type="button"
                          className="package-btn primary"
                          onClick={(e) => handlePreviewPackage(pkg, e)}
                        >
                          Preview 3D
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {detailsPackage && (
        <div className="package-modal" onClick={closeDetailsModal}>
          <div className="package-modal__content package-modal__content--details" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="package-modal__close" onClick={closeDetailsModal}>
              <i className="fas fa-times" />
            </button>
            <div className="package-modal__header package-modal__header--details">
              <div className="package-modal__header-main">
                <p className="package-modal__eyebrow">Template Details</p>
                <h3 className="package-modal__title">{detailsPackage.packageName}</h3>
                {detailsPackage.description && (
                  <p className="package-modal__subtitle">{detailsPackage.description}</p>
                )}
                <div className="package-modal__stats">
                  <div className="package-modal__stat">
                    <span className="package-modal__stat-value">{detailsPackage.items?.length || 0}</span>
                    <span className="package-modal__stat-label">Services</span>
                  </div>
                  <div className="package-modal__stat">
                    <span className="package-modal__stat-value">{detailsPackage.designSummary?.elementCount || 0}</span>
                    <span className="package-modal__stat-label">3D Elements</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="package-modal__body package-modal__body--details">
              <div className="package-modal__services-section">
                <h4 className="package-modal__section-title">Included Services</h4>
                <div className="package-modal__services-list">
                  {(detailsPackage.items || []).length > 0 ? (
                    <ul className="package-modal__services-ul">
                      {(detailsPackage.items || []).map((item) => (
                        <li key={item.id || item.label} className="package-modal__service-item">
                          <i className="fas fa-check package-modal__service-icon"></i>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="package-modal__empty-state">No services included in this template.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewPackage && (
        <div className="package-modal package-modal--fullscreen" onClick={closePreviewModal}>
          <div
            className="package-modal__content package-modal__content--fullscreen"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="package-modal__close package-modal__close--fullscreen" onClick={closePreviewModal}>
              <i className="fas fa-times" />
            </button>
            <div className="package-preview-frame package-preview-frame--fullscreen">
              {previewPackage.id ? (
                <PackagePreview3D packageId={previewPackage.id} height="100%" />
              ) : (
                <div className="package-card__image--placeholder package-card__image--placeholder--large">
                  <i className="fas fa-vr-cardboard" />
                  <span>Preview not available yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3WeddingType;

