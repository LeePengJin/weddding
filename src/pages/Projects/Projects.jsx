import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import dayjs from 'dayjs';
import './Projects.styles.css';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleProjectClick = (projectId) => {
    navigate(`/project-dashboard?projectId=${projectId}`);
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
              onClick={() => handleProjectClick(project.id)}
            >
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
    </div>
  );
};

export default Projects;

