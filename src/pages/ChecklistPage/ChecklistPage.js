import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ChecklistPage.styles.css';

const ChecklistPage = () => {
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editingSubtaskValue, setEditingSubtaskValue] = useState('');
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [showTaskOptions, setShowTaskOptions] = useState(false);
  const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);
  const [activeView, setActiveView] = useState('pending'); // 'pending' or 'completed'

  const [newTaskForm, setNewTaskForm] = useState({
    name: '',
    dueDate: '',
    description: ''
  });

  const [mainTasks, setMainTasks] = useState([
    {
      id: 1,
      name: "Send Save-the-Dates",
      description: "Design and mail save-the-date cards to the guests.",
      dueDate: "2025-08-15",
      completed: false,
      subtasks: [
        { id: 1, name: "Design the card", completed: false },
        { id: 2, name: "Order prints", completed: false },
        { id: 3, name: "Mail them out", completed: false }
      ]
    },
    {
      id: 2,
      name: "Book Venue",
      description: "Research and book the perfect venue for the ceremony and reception.",
      dueDate: "2025-06-15",
      completed: true,
      subtasks: [
        { id: 4, name: "Visit top 3 venue candidates", completed: true },
        { id: 5, name: "Sign contract and pay deposit", completed: true }
      ]
    },
    {
      id: 3,
      name: "Finalize Guest List",
      description: "Create and finalize the complete guest list for the wedding.",
      dueDate: "2025-09-15",
      completed: false,
      subtasks: [
        { id: 6, name: "Collect addresses", completed: true },
        { id: 7, name: "Send invitations", completed: false },
        { id: 8, name: "Track RSVPs", completed: false }
      ]
    },
    {
      id: 4,
      name: "Hire Photographer & Videographer",
      description: "Find and book professional photography and videography services.",
      dueDate: "2025-10-01",
      completed: false,
      subtasks: [
        { id: 9, name: "Research photographers", completed: false },
        { id: 10, name: "Schedule meetings", completed: false },
        { id: 11, name: "Book services", completed: false }
      ]
    },
    {
      id: 5,
      name: "Catering Menu Planning",
      description: "Plan the menu and catering for the wedding reception",
      dueDate: "2025-11-01",
      completed: false,
      subtasks: [
        { id: 17, name: "Research catering companies", completed: false },
        { id: 18, name: "Schedule tasting sessions", completed: false },
        { id: 19, name: "Select menu items", completed: false }
      ]
    },
    {
      id: 6,
      name: "Wedding Cake Design",
      description: "Choose and design the perfect wedding cake",
      dueDate: "2025-11-15",
      completed: false,
      subtasks: [
        { id: 20, name: "Research cake designers", completed: false },
        { id: 21, name: "Schedule cake tasting", completed: false }
      ]
    },
    {
      id: 7,
      name: "Flower Arrangements",
      description: "Select and arrange flowers for the ceremony and reception",
      dueDate: "2025-12-01",
      completed: false,
      subtasks: [
        { id: 22, name: "Choose flower types and colors", completed: false },
        { id: 23, name: "Book florist", completed: false }
      ]
    }
  ]);

  // Update main task completion based on subtasks
  useEffect(() => {
    setMainTasks(prevTasks => 
      prevTasks.map(task => {
        const allSubtasksCompleted = task.subtasks.length > 0 ? 
          task.subtasks.every(subtask => subtask.completed) : task.completed;
        return { ...task, completed: allSubtasksCompleted };
      })
    );
  }, []);

  const handleAddMainTask = () => {
    if (newTaskForm.name.trim() && newTaskForm.dueDate) {
      const newTask = {
        id: Date.now(),
        name: newTaskForm.name,
        description: newTaskForm.description || '',
        dueDate: newTaskForm.dueDate,
        completed: false,
        subtasks: []
      };
      
      setMainTasks([...mainTasks, newTask]);
      setNewTaskForm({ name: '', dueDate: '', description: '' });
      setShowAddTask(false);
    }
  };

  const handleToggleComplete = (taskId, isMainTask = true, subtaskId = null) => {
    setMainTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === taskId) {
          if (isMainTask) {
            // Toggle main task and all its subtasks
            const newCompleted = !task.completed;
            return {
              ...task,
              completed: newCompleted,
              subtasks: task.subtasks.map(subtask => ({ ...subtask, completed: newCompleted }))
            };
          } else {
            // Toggle specific subtask
            const updatedSubtasks = task.subtasks.map(subtask =>
              subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
            );
            const allSubtasksCompleted = updatedSubtasks.every(subtask => subtask.completed);
            return {
              ...task,
              subtasks: updatedSubtasks,
              completed: updatedSubtasks.length > 0 ? allSubtasksCompleted : task.completed
            };
          }
        }
        return task;
      })
    );
  };

  const handleDeleteTask = () => {
    if (showDeleteConfirm.type === 'main') {
      setMainTasks(mainTasks.filter(task => task.id !== showDeleteConfirm.taskId));
      if (selectedTask && selectedTask.id === showDeleteConfirm.taskId) {
        setSelectedTask(null);
      }
    } else {
      setMainTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === showDeleteConfirm.taskId
            ? { ...task, subtasks: task.subtasks.filter(sub => sub.id !== showDeleteConfirm.subtaskId) }
            : task
        )
      );
    }
    setShowDeleteConfirm(null);
  };

  const handleEditSubtask = (subtaskId, newName) => {
    if (newName.trim() && selectedTask) {
      setMainTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === selectedTask.id
            ? { ...task, subtasks: task.subtasks.map(sub => 
                sub.id === subtaskId ? { ...sub, name: newName } : sub
              )}
            : task
        )
      );
      
      // Update selected task as well
      setSelectedTask(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(sub => 
          sub.id === subtaskId ? { ...sub, name: newName } : sub
        )
      }));
    }
    setEditingSubtask(null);
    setEditingSubtaskValue('');
  };

  const handleAddSubtask = () => {
    if (newSubtaskName.trim() && selectedTask) {
      const newSubtask = {
        id: Date.now(),
        name: newSubtaskName,
        completed: false
      };
      
      setMainTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === selectedTask.id
            ? { ...task, subtasks: [...task.subtasks, newSubtask] }
            : task
        )
      );
      
      setSelectedTask(prev => ({
        ...prev,
        subtasks: [...prev.subtasks, newSubtask]
      }));
      
      setNewSubtaskName('');
      setShowAddSubtaskForm(false);
    }
  };

  const handleEditMainTask = (field, value) => {
    if (selectedTask) {
      const updatedTask = { ...selectedTask, [field]: value };
      setSelectedTask(updatedTask);
      
      setMainTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === selectedTask.id ? updatedTask : task
        )
      );
    }
  };

  const toggleMonthCollapse = (monthYear) => {
    setCollapsedMonths(prev => ({
      ...prev,
      [monthYear]: !prev[monthYear]
    }));
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date();
  };

  // Group tasks by month based on active view
  const groupTasksByMonth = (tasks) => {
    const groups = {};
    tasks.forEach(task => {
      const date = new Date(task.dueDate);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(task);
    });
    
    // Sort groups by date
    const sortedGroups = {};
    Object.keys(groups)
      .sort((a, b) => new Date(groups[a][0].dueDate) - new Date(groups[b][0].dueDate))
      .forEach(key => {
        sortedGroups[key] = groups[key].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      });
    
    return sortedGroups;
  };

  // Filter tasks based on active view
  const filteredTasks = mainTasks.filter(task => 
    activeView === 'pending' ? !task.completed : task.completed
  );
  const groupedTasks = groupTasksByMonth(filteredTasks);
  
  // Calculate statistics
  const totalTasks = mainTasks.length;
  const completedTasksCount = mainTasks.filter(task => task.completed).length;
  const pendingTasksCount = totalTasks - completedTasksCount;
  const totalSubtasks = mainTasks.reduce((sum, task) => sum + task.subtasks.length, 0);
  const completedSubtasksCount = mainTasks.reduce((sum, task) => 
    sum + task.subtasks.filter(sub => sub.completed).length, 0
  );
  const overallProgress = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

  return (
    <div className="checklist-container">
      {/* Back Navigation */}
      <div className="checklist-navigation">
        <Link to="/project-dashboard" className="back-to-dashboard">
          <i className="fas fa-arrow-left"></i>
          Wedding Checklist
        </Link>
        {!selectedTask && (
          <button className="add-new-task-btn" onClick={() => setShowAddTask(true)}>
            <i className="fas fa-plus-circle"></i>
            Add New Task
          </button>
        )}
      </div>

      {!selectedTask ? (
        <>
          {/* Progress Cards */}
          <div className="progress-cards">
            <div className="progress-card">
              <div className="progress-content">
                <div className="progress-label">Overall Progress</div>
                <div className="progress-value">{overallProgress}%</div>
                <div className="progress-bar-small">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${overallProgress}%` }}
                  ></div>
                </div>
              </div>
              <i className="fas fa-cog progress-icon"></i>
            </div>

            <div className="progress-card">
              <div className="progress-content">
                <div className="progress-label">Tasks Completed</div>
                <div className="progress-value">
                  {completedTasksCount} <span className="total">of {totalTasks}</span>
                </div>
              </div>
              <i className="fas fa-check-circle progress-icon"></i>
            </div>

            <div className="progress-card">
              <div className="progress-content">
                <div className="progress-label">Subtasks Done</div>
                <div className="progress-value">
                  {completedSubtasksCount} <span className="total">of {totalSubtasks}</span>
                </div>
              </div>
              <i className="fas fa-trending-up progress-icon"></i>
            </div>
          </div>

          {/* View Toggle */}
          <div className="view-toggle-section">
            <div className="view-toggle-buttons">
              <button 
                className={`view-toggle-btn ${activeView === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveView('pending')}
              >
                Pending Tasks <span className="count-badge">{pendingTasksCount}</span>
              </button>
              <button 
                className={`view-toggle-btn ${activeView === 'completed' ? 'active' : ''}`}
                onClick={() => setActiveView('completed')}
              >
                Completed <span className="count-badge">{completedTasksCount}</span>
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="task-list-container">
            {Object.keys(groupedTasks).length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-tasks"></i>
                <h3>{activeView === 'completed' ? 'No completed tasks yet' : 'No pending tasks'}</h3>
                <p>{activeView === 'completed' ? 'Complete some tasks to see them here.' : 'All tasks are completed! Great job!'}</p>
              </div>
            ) : (
              Object.entries(groupedTasks).map(([monthYear, tasks]) => (
                <div key={monthYear} className="month-section">
                  <div 
                    className="month-header clickable"
                    onClick={() => toggleMonthCollapse(monthYear)}
                  >
                    <h3>{monthYear}</h3>
                    <i className={`fas fa-chevron-${collapsedMonths[monthYear] ? 'down' : 'up'}`}></i>
                  </div>
                  
                  {!collapsedMonths[monthYear] && (
                    <div className="month-tasks">
                      {tasks.map(task => (
                        <div key={task.id} className={`task-card ${task.completed ? 'completed-task' : ''}`} onClick={() => setSelectedTask(task)}>
                          <div className="task-card-content">
                            <div className="task-checkbox-wrapper">
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleComplete(task.id, true);
                                }}
                                className="task-checkbox"
                              />
                            </div>
                            
                            <div className="task-info">
                              <h4 className={task.completed ? 'completed-text' : ''}>{task.name}</h4>
                              <div className="task-meta">
                                <span className="due-date">
                                  <i className="fas fa-calendar"></i>
                                  {new Date(task.dueDate).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </span>
                                {!task.completed && isOverdue(task.dueDate) && (
                                  <span className="overdue-badge">Overdue</span>
                                )}
                                {task.completed && (
                                  <span className="completed-badge">Completed</span>
                                )}
                              </div>
                              <div className="subtask-progress">
                                {task.subtasks.filter(sub => sub.completed).length}/{task.subtasks.length} subtasks complete
                              </div>
                            </div>
                          </div>

                          <div className="task-actions">
                            <button 
                              className="edit-task-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                              }}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button 
                              className="delete-task-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm({ type: 'main', taskId: task.id });
                              }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Task Detail View */
        <div className="task-detail-view">
          <div className="task-detail-header">
            <button className="back-btn" onClick={() => setSelectedTask(null)}>
              <i className="fas fa-arrow-left"></i>
            </button>
            
            <div className="task-title-section">
              <h1>{selectedTask.name}</h1>
              <div className="task-due-info">
                <i className="fas fa-calendar"></i>
                <span>Due by {new Date(selectedTask.dueDate).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}</span>
                {selectedTask.completed && <span className="completed-status">Completed</span>}
              </div>
            </div>

            <div className="task-options-wrapper">
              <button 
                className="task-options-btn"
                onClick={() => setShowTaskOptions(!showTaskOptions)}
              >
                <i className="fas fa-ellipsis-v"></i>
                Task Options
              </button>
              {showTaskOptions && (
                <div className="task-options-dropdown">
                  <button onClick={() => {
                    setShowTaskOptions(false);
                    // Enable editing mode for task name and due date
                  }}>
                    <i className="fas fa-edit"></i>
                    Edit Task
                  </button>
                  <button onClick={() => {
                    setShowTaskOptions(false);
                    setShowDeleteConfirm({ type: 'main', taskId: selectedTask.id });
                  }}>
                    <i className="fas fa-trash"></i>
                    Delete Task
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedTask.completed && (
            <div className="read-only-notice">
              <i className="fas fa-info-circle"></i>
              This task is completed and is now read-only. To make changes, please uncheck it on the main checklist page.
            </div>
          )}

          <div className="task-detail-content">
            <div className="subtasks-column">
              <div className="column-header">
                <h3>Subtasks</h3>
                <p>Break down the main task into smaller steps.</p>
              </div>

              <div className="subtasks-list">
                {selectedTask.subtasks.map(subtask => (
                  <div key={subtask.id} className="subtask-row">
                    <div className="subtask-checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => handleToggleComplete(selectedTask.id, false, subtask.id)}
                        disabled={selectedTask.completed}
                        className="subtask-checkbox"
                      />
                    </div>

                    <div className="subtask-content">
                      {editingSubtask === subtask.id && !selectedTask.completed ? (
                        <input
                          type="text"
                          value={editingSubtaskValue}
                          onChange={(e) => setEditingSubtaskValue(e.target.value)}
                          onBlur={() => handleEditSubtask(subtask.id, editingSubtaskValue)}
                          onKeyPress={(e) => e.key === 'Enter' && handleEditSubtask(subtask.id, editingSubtaskValue)}
                          className="subtask-edit-input"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className={`subtask-text ${subtask.completed ? 'completed' : ''}`}
                          onClick={() => {
                            if (!selectedTask.completed) {
                              setEditingSubtask(subtask.id);
                              setEditingSubtaskValue(subtask.name);
                            }
                          }}
                        >
                          {subtask.name}
                        </span>
                      )}
                    </div>

                    {!selectedTask.completed && (
                      <div className="subtask-actions">
                        <button
                          className="edit-subtask-btn"
                          onClick={() => {
                            setEditingSubtask(subtask.id);
                            setEditingSubtaskValue(subtask.name);
                          }}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          className="delete-subtask-btn"
                          onClick={() => setShowDeleteConfirm({ 
                            type: 'subtask', 
                            taskId: selectedTask.id, 
                            subtaskId: subtask.id 
                          })}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {!selectedTask.completed && !showAddSubtaskForm && (
                  <button 
                    className="add-subtask-btn"
                    onClick={() => setShowAddSubtaskForm(true)}
                  >
                    <i className="fas fa-plus-circle"></i>
                    Add Subtask
                  </button>
                )}

                {!selectedTask.completed && showAddSubtaskForm && (
                  <div className="add-subtask-form">
                    <input
                      type="text"
                      value={newSubtaskName}
                      onChange={(e) => setNewSubtaskName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
                      placeholder="Enter subtask name..."
                      className="subtask-input"
                      autoFocus
                    />
                    <div className="subtask-form-actions">
                      <button className="save-subtask-btn" onClick={handleAddSubtask}>
                        <i className="fas fa-check"></i>
                        Save
                      </button>
                      <button 
                        className="cancel-subtask-btn" 
                        onClick={() => {
                          setShowAddSubtaskForm(false);
                          setNewSubtaskName('');
                        }}
                      >
                        <i className="fas fa-times"></i>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="description-column">
              <div className="column-header">
                <h3>Description & Notes</h3>
              </div>

              <div className="description-content">
                <textarea
                  value={selectedTask.description}
                  onChange={(e) => handleEditMainTask('description', e.target.value)}
                  disabled={selectedTask.completed}
                  className="description-textarea"
                  placeholder="Add description and notes..."
                />
                
                {!selectedTask.completed && (
                  <button className="save-description-btn">
                    Save Description
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Task</h3>
              <button className="modal-close" onClick={() => setShowAddTask(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Task Name *</label>
                <input
                  type="text"
                  value={newTaskForm.name}
                  onChange={(e) => setNewTaskForm({...newTaskForm, name: e.target.value})}
                  placeholder="Enter task name"
                />
              </div>
              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="date"
                  value={newTaskForm.dueDate}
                  onChange={(e) => setNewTaskForm({...newTaskForm, dueDate: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm({...newTaskForm, description: e.target.value})}
                  placeholder="Add a description (optional)"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowAddTask(false)}>Cancel</button>
              <button className="save-btn" onClick={handleAddMainTask}>Save Task</button>
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
              Are you sure you want to delete this {showDeleteConfirm.type === 'main' ? 'task' : 'subtask'}?
              {showDeleteConfirm.type === 'main' && ' This will also delete all its subtasks.'}
            </p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="delete-confirm-btn" onClick={handleDeleteTask}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistPage; 