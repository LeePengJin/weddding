import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import dayjs from 'dayjs';
import { Snackbar, Alert } from '@mui/material';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import './Projects.styles.css';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, projectId: null, projectName: '' });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/projects');
      // Ensure we have an array
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('DD-MM-YYYY');
  };

  const handleProjectClick = (projectId, e) => {
    // Don't navigate if clicking on delete button
    if (e && e.target.closest('.project-delete-button')) {
      return;
    }
    navigate(`/project-dashboard?projectId=${projectId}`);
  };

  const handleDeleteClick = (e, projectId, projectName) => {
    e.stopPropagation();
    setDeleteDialog({ open: true, projectId, projectName });
  };

  const handleConfirmDelete = async () => {
    try {
      await apiFetch(`/projects/${deleteDialog.projectId}`, {
        method: 'DELETE',
      });
      // Refresh projects list
      fetchProjects();
      setDeleteDialog({ open: false, projectId: null, projectName: '' });
      setToast({ open: true, message: 'Project deleted successfully', severity: 'success' });
    } catch (err) {
      const errorMessage = err.message || 'Failed to delete project';
      setToast({ open: true, message: errorMessage, severity: 'error' });
      setDeleteDialog({ open: false, projectId: null, projectName: '' });
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialog({ open: false, projectId: null, projectName: '' });
  };

  return (
    <div className="projects-container">
      <div className="projects-header-section">
        <div className="projects-header-content">
          <h1 className="projects-title">Your Wedding Project</h1>
          <p className="projects-subtitle">
            Manage your wedding plans, from venue design to budget management. Select a project to continue or start a new one.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading projects...</p>
        </div>
      ) : error ? (
        <div className="projects-error">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
          <button onClick={fetchProjects} className="retry-button">
            Retry
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div
              key={project.id}
              className="project-card"
              onClick={(e) => handleProjectClick(project.id, e)}
            >
              <button
                className="project-delete-button"
                onClick={(e) => handleDeleteClick(e, project.id, project.projectName)}
                aria-label={`Delete ${project.projectName}`}
                title="Delete project"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
              <div className="project-card-content">
                <h3 className="project-name">{project.projectName}</h3>
                <p className="project-last-update">
                  Last Update: {formatDate(project.updatedAt)}
                </p>
              </div>
            </div>
          ))}
          
          <Link to="/create-project" className="create-project-card">
            <div className="create-project-content">
              <div className="create-project-icon-wrapper">
                <div className="create-project-icon"></div>
              </div>
              <div className="create-project-text-wrapper">
                <p className="create-project-text">Create new wedding project</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      <ConfirmationDialog
        open={deleteDialog.open}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Project?"
        description={`Are you sure you want to delete "${deleteDialog.projectName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Projects;

