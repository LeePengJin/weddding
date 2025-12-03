import React from 'react';
import './BudgetTracker.css';

const BudgetTracker = ({ total = 0, planned = 0, remaining = 0, progress = 0 }) => {
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

  return (
    <div className="budget-panel">
      <div className="budget-stat">
        <span className="budget-label">Total Budget</span>
        <span className="budget-figure">RM {total.toLocaleString()}</span>
      </div>
      <div className="budget-stat">
        <span className="budget-label">Spend</span>
        <span className="budget-figure spent">RM {planned.toLocaleString()}</span>
      </div>
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


