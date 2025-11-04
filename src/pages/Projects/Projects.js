import React from 'react';
import { Link } from 'react-router-dom';
import './Projects.styles.css';

const Projects = () => {
  const projects = [
    {
      id: 1,
      title: "Sarah & John's Dream Wedding",
      date: '15 Jun 2024',
      lastUpdated: '12 Jul',
      venue: 'Beach Resort',
      budget: 25000,
      status: 'In Progress'
    },
    {
      id: 2,
      title: "Emma & Michael's Garden Wedding",
      date: '22 Sep 2024',
      lastUpdated: '05 Jul',
      venue: 'Rose Garden',
      budget: 18000,
      status: 'Planning'
    },
    {
      id: 3,
      title: "Lisa & David's City Wedding",
      date: '10 Nov 2024',
      lastUpdated: '28 Jun',
      venue: 'Grand Hotel',
      budget: 35000,
      status: 'Planning'
    }
  ];

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h1>Wedding Projects</h1>
        <div className="view-toggle">
          <button className="active">Following</button>
          <button>My Projects</button>
        </div>
      </div>

      <div className="projects-grid">
        {projects.map(project => (
          <Link 
            key={project.id} 
            to="/project-dashboard" 
            className="project-card-link"
          >
            <div className="project-card">
              <div className="project-content">
                <h3>{project.title}</h3>
                <div className="project-details">
                  <p className="project-date">
                    <i className="fas fa-calendar"></i>
                    {project.date}
                  </p>
                  <p className="project-venue">
                    <i className="fas fa-map-marker-alt"></i>
                    {project.venue}
                  </p>
                  <p className="project-budget">
                    <i className="fas fa-dollar-sign"></i>
                    RM {project.budget.toLocaleString()}
                  </p>
                </div>
                <div className="project-footer">
                  <span className={`status ${project.status.toLowerCase().replace(' ', '-')}`}>
                    {project.status}
                  </span>
                  <p className="last-updated">Updated: {project.lastUpdated}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
        
        <Link to="/create-project" className="create-project-card">
          <div className="create-project-content">
            <div className="plus-icon">+</div>
            <p>Create new wedding project</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Projects;