import React, { useState } from 'react';
import { Typography, TextField, Alert } from '@mui/material';
import { ErrorOutline as AlertCircleIcon } from '@mui/icons-material';
import './InfoPanel.css';

const InfoPanel = ({ 
  dimensions, 
  onDimensionChange,
  onReset, 
  onSave
}) => {
  const [error, setError] = useState(null);
  
  // Helper to handle input changes safely
  const handleInputChange = (axis, valueStr) => {
    // Clear error on new input attempt
    setError(null);

    // Allow empty string to let user clear input, but don't update dimension to 0/NaN
    if (valueStr === '') return;

    const val = parseFloat(valueStr);

    if (isNaN(val)) {
      setError("Please enter a valid number");
      return;
    }

    if (val <= 0) {
      setError("Dimensions must be positive");
      return;
    }

    onDimensionChange(axis, val);
  };

  return (
    <div className="model-dimension-info-panel">
      {/* Dimensions Card */}
      <div className="model-dimension-info-panel-card">
        <Typography variant="subtitle2" className="model-dimension-info-panel-section-title">
          Dimensions
        </Typography>
        <div className="model-dimension-info-panel-inputs">
          
          {/* Width Input */}
          <div className="model-dimension-info-panel-input-row">
            <label className="model-dimension-info-panel-label model-dimension-info-panel-label-red">Width (X)</label>
            <div className="model-dimension-info-panel-input-wrapper">
              <TextField 
                type="number"
                size="small"
                step="0.01"
                min="0.01"
                value={dimensions.x > 0 ? Math.round(dimensions.x * 100) / 100 : ''}
                onChange={(e) => handleInputChange('x', e.target.value)}
                className="model-dimension-info-panel-input model-dimension-info-panel-input-red"
                inputProps={{ step: 0.01 }}
                InputProps={{
                  endAdornment: <span className="model-dimension-info-panel-unit">m</span>
                }}
              />
            </div>
          </div>

          {/* Height Input */}
          <div className="model-dimension-info-panel-input-row">
            <label className="model-dimension-info-panel-label model-dimension-info-panel-label-green">Height (Y)</label>
            <div className="model-dimension-info-panel-input-wrapper">
              <TextField 
                type="number"
                size="small"
                step="0.01"
                min="0.01"
                value={dimensions.y > 0 ? Math.round(dimensions.y * 100) / 100 : ''}
                onChange={(e) => handleInputChange('y', e.target.value)}
                className="model-dimension-info-panel-input model-dimension-info-panel-input-green"
                inputProps={{ step: 0.01 }}
                InputProps={{
                  endAdornment: <span className="model-dimension-info-panel-unit">m</span>
                }}
              />
            </div>
          </div>

          {/* Depth Input */}
          <div className="model-dimension-info-panel-input-row">
            <label className="model-dimension-info-panel-label model-dimension-info-panel-label-blue">Depth (Z)</label>
            <div className="model-dimension-info-panel-input-wrapper">
              <TextField 
                type="number"
                size="small"
                step="0.01"
                min="0.01"
                value={dimensions.z > 0 ? Math.round(dimensions.z * 100) / 100 : ''}
                onChange={(e) => handleInputChange('z', e.target.value)}
                className="model-dimension-info-panel-input model-dimension-info-panel-input-blue"
                inputProps={{ step: 0.01 }}
                InputProps={{
                  endAdornment: <span className="model-dimension-info-panel-unit">m</span>
                }}
              />
            </div>
          </div>

        </div>

        {/* Error Message */}
        {error && (
          <Alert 
            severity="error" 
            icon={<AlertCircleIcon />}
            sx={{ mt: 1.5, fontSize: '0.75rem' }}
          >
            {error}
          </Alert>
        )}

        <Typography variant="caption" className="model-dimension-info-panel-hint">
          * Type values or drag the arrows on the model
        </Typography>
      </div>
    </div>
  );
};

export default InfoPanel;

