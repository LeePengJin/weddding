import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import './BudgetTracker.css';

const BudgetTracker = ({ 
  total = 0, 
  planned = 0,  // Planned from 3D design
  actual = 0,   // Actual expenses (optional, for backward compatibility)
  remaining = 0, 
  progress = 0,
  showMessage = false,
  message = '',
  projectId = '',
}) => {
  // Show message if budget is not set
  if (showMessage) {
    return (
      <div className="budget-panel" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <i className="fas fa-exclamation-triangle" style={{ color: '#f57c00', fontSize: '1.2rem' }}></i>
          <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666', flex: 1 }}>
            {message}
          </Typography>
        </Box>
        {projectId && (
          <Button
            component={Link}
            to={`/budget?projectId=${projectId}`}
            variant="outlined"
            sx={{
              border: '2px solid #e16789',
              color: '#e16789',
              textTransform: 'none',
              fontFamily: "'Literata', serif",
              fontSize: '0.875rem',
              '&:hover': {
                background: '#e16789',
                color: 'white',
                border: '2px solid #e16789',
              },
            }}
          >
            Go to Budget Management
          </Button>
        )}
      </div>
    );
  }
  const percentage = Math.min(Math.max(progress, 0), 100).toFixed(1);
  const isOverBudget = remaining < 0;
  const remainingClass = isOverBudget 
    ? 'budget-figure warning' 
    : remaining < 1000 
    ? 'budget-figure warning' 
    : 'budget-figure remaining';
  const remainingDisplay = isOverBudget 
    ? `-RM ${Math.abs(remaining).toLocaleString()}` 
    : `RM ${remaining.toLocaleString()}`;
  
  // If actual is provided, show both planned and actual
  // Otherwise, show planned as "Spend" (backward compatibility)
  const showDetailed = actual !== undefined && actual !== null;

  return (
    <div className="budget-panel">
      <div className="budget-stat">
        <span className="budget-label">Total Budget</span>
        <span className="budget-figure">RM {total.toLocaleString()}</span>
      </div>
      {showDetailed ? (
        <>
          <div className="budget-stat">
            <span className="budget-label">Planned (3D)</span>
            <span className="budget-figure planned">RM {planned.toLocaleString()}</span>
          </div>
          <div className="budget-stat">
            <span className="budget-label">Actual Spent</span>
            <span className="budget-figure spent">RM {actual.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <div className="budget-stat">
          <span className="budget-label">Spend</span>
          <span className="budget-figure spent">RM {planned.toLocaleString()}</span>
        </div>
      )}
      <div className="budget-stat">
        <span className="budget-label">Remaining</span>
        <span className={remainingClass}>{remainingDisplay}</span>
      </div>
      <div className="budget-meter">
        <div className="budget-bar">
          <div className="budget-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <span className="budget-percentage">{percentage}%</span>
      </div>
    </div>
  );
};

export default BudgetTracker;


