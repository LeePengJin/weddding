import React, { useState } from 'react';
import './BudgetManagement.styles.css';

const BudgetManagement = () => {
  const [totalBudget, setTotalBudget] = useState(16736);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseCost, setNewExpenseCost] = useState('');
  const [newExpenseNote, setNewExpenseNote] = useState('');

  const [budgetCategories, setBudgetCategories] = useState([
    {
      id: 1,
      name: 'Testing',
      icon: 'fas fa-ellipsis-h',
      color: '#6B7280',
      estimatedCost: 0,
      expenses: []
    },
    {
      id: 2,
      name: 'Venue',
      icon: 'fas fa-building',
      color: '#EF4444',
      estimatedCost: 0,
      expenses: []
    },
    {
      id: 3,
      name: 'Catering',
      icon: 'fas fa-utensils',
      color: '#10B981',
      estimatedCost: 0,
      expenses: []
    },
    {
      id: 4,
      name: 'Photography',
      icon: 'fas fa-camera',
      color: '#8B5CF6',
      estimatedCost: 2400,
      expenses: [
        { id: 1, name: 'Photographer', estimatedCost: 2080, actualCost: 0, note: 'Full day wedding photography', paid: 0 },
        { id: 2, name: 'Additional Prints', estimatedCost: 320, actualCost: 0, note: 'Extra photo prints for family', paid: 0 }
      ]
    },
    {
      id: 5,
      name: 'Flowers',
      icon: 'fas fa-seedling',
      color: '#F59E0B',
      estimatedCost: 2544,
      expenses: [
        { id: 3, name: 'Bridal Bouquet', estimatedCost: 544, actualCost: 0, note: 'White roses and baby breath', paid: 0 },
        { id: 4, name: 'Centerpieces', estimatedCost: 2000, actualCost: 0, note: '15 table centerpieces', paid: 0 }
      ]
    },
    {
      id: 6,
      name: 'Cake',
      icon: 'fas fa-birthday-cake',
      color: '#3B82F6',
      estimatedCost: 800,
      expenses: [
        { id: 5, name: 'Wedding Cake', estimatedCost: 800, actualCost: 0, note: '3-tier vanilla cake', paid: 0 }
      ]
    },
    {
      id: 7,
      name: 'Dress and Attire',
      icon: 'fas fa-tshirt',
      color: '#EC4899',
      estimatedCost: 2848,
      expenses: [
        { id: 6, name: 'Wedding Dress', estimatedCost: 1800, actualCost: 0, note: 'Designer gown with alterations', paid: 0 },
        { id: 7, name: 'Groom Suit', estimatedCost: 1048, actualCost: 0, note: 'Custom tailored suit', paid: 0 }
      ]
    },
    {
      id: 8,
      name: 'Band',
      icon: 'fas fa-music',
      color: '#F97316',
      estimatedCost: 1280,
      expenses: [
        { id: 8, name: 'Live Band', estimatedCost: 1280, actualCost: 0, note: '4-piece band for reception', paid: 0 }
      ]
    },
    {
      id: 9,
      name: 'DJ',
      icon: 'fas fa-headphones',
      color: '#06B6D4',
      estimatedCost: 960,
      expenses: [
        { id: 9, name: 'DJ Services', estimatedCost: 960, actualCost: 0, note: 'Sound system and DJ for 6 hours', paid: 0 }
      ]
    },
    {
      id: 10,
      name: 'Ceremony Music',
      icon: 'fas fa-music',
      color: '#84CC16',
      estimatedCost: 320,
      expenses: [
        { id: 10, name: 'String Quartet', estimatedCost: 320, actualCost: 0, note: 'Ceremony music', paid: 0 }
      ]
    },
    {
      id: 11,
      name: 'Videography',
      icon: 'fas fa-video',
      color: '#F43F5E',
      estimatedCost: 1600,
      expenses: [
        { id: 11, name: 'Wedding Video', estimatedCost: 1600, actualCost: 0, note: 'Full ceremony and reception video', paid: 0 }
      ]
    },
    {
      id: 12,
      name: 'Invitations',
      icon: 'fas fa-envelope',
      color: '#8B5CF6',
      estimatedCost: 960,
      expenses: [
        { id: 12, name: 'Wedding Invitations', estimatedCost: 960, actualCost: 0, note: '150 printed invitations', paid: 0 }
      ]
    },
    {
      id: 13,
      name: 'Favors and Gifts',
      icon: 'fas fa-gift',
      color: '#F59E0B',
      estimatedCost: 320,
      expenses: [
        { id: 13, name: 'Wedding Favors', estimatedCost: 320, actualCost: 0, note: 'Guest favor boxes', paid: 0 }
      ]
    },
    {
      id: 14,
      name: 'Officiant',
      icon: 'fas fa-user-tie',
      color: '#6B7280',
      estimatedCost: 320,
      expenses: [
        { id: 14, name: 'Wedding Officiant', estimatedCost: 320, actualCost: 0, note: 'Ceremony officiant fee', paid: 0 }
      ]
    },
    {
      id: 15,
      name: 'Transportation',
      icon: 'fas fa-car',
      color: '#DC2626',
      estimatedCost: 320,
      expenses: [
        { id: 15, name: 'Wedding Car', estimatedCost: 320, actualCost: 0, note: 'Bridal car rental', paid: 0 }
      ]
    },
    {
      id: 16,
      name: 'Hair & Makeup',
      icon: 'fas fa-cut',
      color: '#F97316',
      estimatedCost: 320,
      expenses: [
        { id: 16, name: 'Bridal Hair & Makeup', estimatedCost: 320, actualCost: 0, note: 'Bridal styling', paid: 0 }
      ]
    },
    {
      id: 17,
      name: 'Jewelry',
      icon: 'fas fa-gem',
      color: '#10B981',
      estimatedCost: 640,
      expenses: [
        { id: 17, name: 'Wedding Rings', estimatedCost: 640, actualCost: 0, note: 'Matching wedding bands', paid: 0 }
      ]
    }
  ]);

  const [newCategory, setNewCategory] = useState('');

  const totalEstimated = budgetCategories.reduce((sum, cat) => sum + cat.estimatedCost, 0);
  const totalSpent = budgetCategories.reduce((sum, cat) => 
    sum + cat.expenses.reduce((expSum, exp) => expSum + exp.actualCost, 0), 0
  );

  const handleBudgetEdit = () => {
    setIsEditingBudget(true);
  };

  const handleBudgetSave = (value) => {
    setTotalBudget(parseInt(value) || totalBudget);
    setIsEditingBudget(false);
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      const colors = ['#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#F97316', '#EC4899'];
      const newCat = {
        id: Date.now(),
        name: newCategory,
        icon: 'fas fa-star',
        color: colors[budgetCategories.length % colors.length],
        estimatedCost: 0,
        expenses: []
      };
      setBudgetCategories([...budgetCategories, newCat]);
      setNewCategory('');
      setShowAddCategory(false);
    }
  };

  const handleAddExpense = () => {
    if (newExpenseName.trim() && newExpenseCost && selectedCategory) {
      const expense = {
        id: Date.now(),
        name: newExpenseName,
        estimatedCost: parseFloat(newExpenseCost) || 0,
        actualCost: 0,
        note: newExpenseNote.trim() || '',
        paid: 0
      };
      
      setBudgetCategories(budgetCategories.map(cat => 
        cat.id === selectedCategory.id 
          ? { 
              ...cat, 
              expenses: [...cat.expenses, expense],
              estimatedCost: cat.expenses.reduce((sum, exp) => sum + exp.estimatedCost, 0) + expense.estimatedCost
            }
          : cat
      ));
      
      setNewExpenseName('');
      setNewExpenseCost('');
      setNewExpenseNote('');
    }
  };

  const handleDeleteExpense = (expenseId) => {
    setBudgetCategories(budgetCategories.map(cat => 
      cat.id === selectedCategory.id 
        ? { 
            ...cat, 
            expenses: cat.expenses.filter(exp => exp.id !== expenseId),
            estimatedCost: cat.expenses.filter(exp => exp.id !== expenseId).reduce((sum, exp) => sum + exp.estimatedCost, 0)
          }
        : cat
    ));
    setShowDeleteConfirm(null);
  };

  const handleDeleteCategory = () => {
    setBudgetCategories(budgetCategories.filter(cat => cat.id !== selectedCategory.id));
    setSelectedCategory(null);
    setShowDeleteConfirm(null);
  };

  const generatePieChart = () => {
    let cumulativePercentage = 0;
    
    return budgetCategories.filter(cat => cat.estimatedCost > 0).map((category, index) => {
      const percentage = totalEstimated > 0 ? (category.estimatedCost / totalEstimated) * 100 : 0;
      const strokeDasharray = `${percentage} ${100 - percentage}`;
      const strokeDashoffset = -cumulativePercentage;
      
      cumulativePercentage += percentage;
      
      return (
        <circle
          key={index}
          cx="120"
          cy="120"
          r="60"
          fill="none"
          stroke={category.color}
          strokeWidth="30"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="pie-segment"
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedCategory(category)}
          onMouseEnter={() => setHoveredSegment({
            name: category.name,
            cost: category.estimatedCost,
            percentage: Math.round(percentage)
          })}
          onMouseLeave={() => setHoveredSegment(null)}
        />
      );
    });
  };

  return (
    <div className="budget-management">
      {/* Sidebar */}
      <div className="budget-sidebar">
        <div className="sidebar-header">
          <button 
            className="add-category-btn"
            onClick={() => setShowAddCategory(true)}
          >
            <i className="fas fa-plus"></i>
            New category
          </button>
        </div>

        <div className="categories-list">
          {budgetCategories.map(category => (
            <div 
              key={category.id} 
              className={`category-item ${selectedCategory?.id === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              <div className="category-info">
                <i className={category.icon}></i>
                <span>{category.name}</span>
              </div>
              <span className="category-amount">RM {category.estimatedCost.toLocaleString()}</span>
              <i className="fas fa-chevron-right"></i>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="budget-main">
        {!selectedCategory ? (
          <>
            <div className="budget-expenses-container">
              {/* Budget Section */}
              <div className="budget-section">
                <h2>Budget</h2>
                
                <div className="estimated-cost-card">
                  <div className="cost-icon">
                    <i className="fas fa-calculator"></i>
                  </div>
                  <label>ESTIMATED COST</label>
                  
                  {isEditingBudget ? (
                    <div className="budget-input-container">
                      <span className="currency">RM</span>
                      <input
                        type="number"
                        defaultValue={totalBudget}
                        onBlur={(e) => handleBudgetSave(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleBudgetSave(e.target.value)}
                        autoFocus
                        className="budget-input"
                      />
                    </div>
                  ) : (
                    <div className="budget-display" onClick={handleBudgetEdit}>
                      <span className="currency">RM</span>
                      <span className="amount">{totalBudget.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <p className="edit-hint">You can edit this at any time.</p>
                  <button className="save-budget-btn">Save budget</button>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="expenses-section">
                <h2>Expenses</h2>
                
                <div className="chart-container">
                  <div className="pie-chart-wrapper">
                    <svg viewBox="0 0 240 240" className="pie-chart">
                      {generatePieChart()}
                    </svg>
                    
                    {hoveredSegment && (
                      <div className="chart-tooltip">
                        <div className="tooltip-title">{hoveredSegment.name}</div>
                        <div className="tooltip-content">
                          <span>RM{hoveredSegment.cost.toLocaleString()} ({hoveredSegment.percentage}%)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="chart-legend">
                    {budgetCategories.filter(cat => cat.estimatedCost > 0).map((category, index) => (
                      <div key={index} className="legend-item" onClick={() => setSelectedCategory(category)}>
                        <div 
                          className="legend-color" 
                          style={{ backgroundColor: category.color }}
                        ></div>
                        <span>{category.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Category Detail View */
          <div className="category-detail">
            <div className="category-header">
              <div className="category-title">
                <div className="category-icon">
                  <i className={selectedCategory.icon}></i>
                </div>
                <h2>{selectedCategory.name}</h2>
              </div>
              <button className="close-btn" onClick={() => setSelectedCategory(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="cost-summary">
              <span>Estimated cost: RM {selectedCategory.estimatedCost.toLocaleString()}</span>
              <span>Final cost: RM {selectedCategory.expenses.reduce((sum, exp) => sum + exp.actualCost, 0).toLocaleString()}</span>
              <button 
                className="remove-btn"
                onClick={() => setShowDeleteConfirm({ type: 'category' })}
              >
                <i className="fas fa-trash"></i>
                Remove
              </button>
            </div>

            <div className="progress-bar-container">
              <div 
                className="progress-bar"
                style={{ 
                  width: `${selectedCategory.estimatedCost > 0 ? Math.min((selectedCategory.expenses.reduce((sum, exp) => sum + exp.actualCost, 0) / selectedCategory.estimatedCost) * 100, 100) : 0}%` 
                }}
              >
                RM {selectedCategory.estimatedCost.toLocaleString()}
              </div>
            </div>

            <div className="expenses-table">
              <div className="table-header">
                <div>NAME</div>
                <div>ESTIMATED COST</div>
                <div>ACTUAL COST</div>
                <div>NOTE</div>
                <div>ACTION</div>
              </div>

              {selectedCategory.expenses.map(expense => (
                <div key={expense.id} className="table-row">
                  <div className="expense-name">{expense.name}</div>
                  <div>RM {expense.estimatedCost.toLocaleString()}</div>
                  <div>RM {expense.actualCost}</div>
                  <div className="expense-note">{expense.note}</div>
                  <div className="row-actions">
                    <button 
                      className="delete-expense-btn"
                      onClick={() => setShowDeleteConfirm({ type: 'expense', expenseId: expense.id })}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}

              <button 
                className="add-expense-btn"
                onClick={() => {
                  setNewExpenseName('');
                  setNewExpenseCost('');
                  setNewExpenseNote('');
                }}
              >
                <i className="fas fa-plus"></i>
                Add new expense
              </button>

              <div className="table-total">
                <div className="total-row">
                  <div><strong>Total:</strong></div>
                  <div><strong>RM {selectedCategory.estimatedCost.toLocaleString()}</strong></div>
                  <div><strong>RM {selectedCategory.expenses.reduce((sum, exp) => sum + exp.actualCost, 0).toLocaleString()}</strong></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Category</h3>
              <button className="modal-close" onClick={() => setShowAddCategory(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <input
              type="text"
              placeholder="Category Name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowAddCategory(false)}>Cancel</button>
              <button className="save-btn" onClick={handleAddCategory}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete this {showDeleteConfirm.type === 'category' ? 'category' : 'expense'}?
            </p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
              <button 
                className="delete-confirm-btn"
                onClick={() => {
                  if (showDeleteConfirm.type === 'category') {
                    handleDeleteCategory();
                  } else {
                    handleDeleteExpense(showDeleteConfirm.expenseId);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetManagement; 