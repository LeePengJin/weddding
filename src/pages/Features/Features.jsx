import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { PetalCursor } from '../../components/PetalCursor/PetalCursor';
import Footer from '../../components/Footer/Footer';
import './Features.styles.css';

const Features = () => {
  const navigate = useNavigate();

  return (
    <div className="features-page">
      <PetalCursor />
      <section className="features-hero">
        <span className="hero-tag">The Toolkit</span>
        <h1>
          Everything You Need to <span className="hero-accent">Say "I Do"</span>
        </h1>
        <p>
          From the first budget snapshot to the final 3D walkthrough, every workflow is built
          around the real features already inside Weddding.
        </p>
      </section>

      <div className="features-divider" aria-hidden="true" />

      <section id="budget-tracker" className="feature-row">
        <div className="feature-content">
          <p className="feature-eyebrow">Budget Management</p>
          <h2>Project-Aware Budget Tracker</h2>
          <p>
            Each wedding project owns its budget, categories, and expense history. Couples can
            switch projects without ever mixing totals or payment reminders.
          </p>
          <ul>
            <li>Per-project categories, estimated vs. spent</li>
            <li>Expense syncing with vendor bookings</li>
            <li>Charts that refresh the moment you log a payment</li>
          </ul>
          <Button variant="outline" onClick={() => navigate('/budget')}>
            Start Budgeting
          </Button>
        </div>
        <div className="feature-media">
          <img
            src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80"
            alt="Budget planning on a tablet"
          />
          <div className="media-card">
            <p className="label">Remaining Budget</p>
            <h4>RM 4,250.00</h4>
            <div className="progress">
              <div className="progress-bar" />
            </div>
          </div>
        </div>
      </section>

      <section id="checklist" className="feature-row">
        <div className="feature-media">
          <img
            src="https://images.unsplash.com/photo-1512413914633-b5043f4041ea?auto=format&fit=crop&w=1000&q=80"
            alt="Checklist planning"
          />
        </div>
        <div className="feature-content">
          <p className="feature-eyebrow">Planning Checklist</p>
          <h2>The Adaptive Wedding Checklist</h2>
          <p>
            Timeline-aware tasks, subtasks, and completion tracking update as soon as you mark
            something done. Couples always know what comes next.
          </p>
          <ul>
            <li>Auto-ordered tasks based on the wedding date</li>
            <li>Progress bars per project and per category</li>
            <li>Shareable lists so both partners stay aligned</li>
          </ul>
          <Button onClick={() => navigate('/checklist')}>View Checklist</Button>
        </div>
      </section>

      <section id="3d-venue-designer" className="features-spotlight">
        <div className="spotlight-inner">
          <div className="spotlight-content">
            <h2>Immersive 3D Venue Designer</h2>
            <p>
              Upload vendor elements, resize them with the dimension editor, and drop them straight
              into your venue scene. What you adjust is exactly what gets saved back to the project.
            </p>
            <Button size="lg" onClick={() => navigate('/projects')}>
              Try 3D Designer Now
            </Button>
          </div>
          <div className="spotlight-media">
            <img
              src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=80"
              alt="3D venue preview"
            />
          </div>
        </div>
      </section>

      <section className="features-cta">
        <h3>Ready to bring your vision to life?</h3>
        <p>Sign in to manage budgets, tasks, vendors, and venue layouts in one workspace.</p>
        <Button
          size="lg"
          variant="secondary"
          className="cta-button"
          onClick={() => navigate('/projects')}
        >
          Sign Up Free
        </Button>
      </section>

      <Footer sx={{ mt: 0 }} />
    </div>
  );
};

export default Features;

