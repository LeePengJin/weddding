import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  Grid,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  AccountBalanceWallet as BudgetIcon,
  Checklist as ChecklistIcon,
  ViewInAr as View3DIcon,
  Payment as PaymentIcon,
  People as PeopleIcon,
  Share as ShareIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import VendorDetailsPopup from '../../components/VendorDetailsPopup/VendorDetailsPopup';
import './ProjectDashboard.styles.css';

const ProjectDashboard = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const navigate = useNavigate();
  const location = useLocation();

  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVendorDetails, setShowVendorDetails] = useState(false);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  // Refresh data when navigating back to this page (component remounts on route change)
  // The useEffect above already handles this, but we ensure fresh data on mount

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      // If projectId is in URL, fetch that project, otherwise fetch first project
      let project;
      if (projectId) {
        project = await apiFetch(`/projects/${projectId}`);
      } else {
        const projects = await apiFetch('/projects');
        if (projects && projects.length > 0) {
          project = await apiFetch(`/projects/${projects[0].id}`);
        }
      }

      if (project) {
        // Transform API data to match expected structure
        const transformedData = {
          id: project.id,
          projectName: project.projectName || "Our Dream Wedding",
          date: project.weddingDate,
          time: new Date(project.weddingDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          venue: project.venueServiceListing?.name || 'Venue TBD',
          preparationType: project.weddingType === 'prepackaged' ? 'Pre-Packaged' : 'Self-Organized',
          budget: project.budget ? {
            total: parseFloat(project.budget.totalBudget || 0),
            spent: parseFloat(project.budget.totalSpent || 0),
            categories: project.budget.categories || {},
          } : { total: 0, spent: 0, categories: {} },
          checklist: {
            total: project.tasks?.length || 0,
            completed: project.tasks?.filter(t => t.isCompleted).length || 0,
            categories: {},
          },
          payments: {
            totalBudget: project.budget?.totalBudget || 0,
            totalPaid: project.budget?.totalPaid || 0,
            totalOutstanding: (project.budget?.totalBudget || 0) - (project.budget?.totalPaid || 0),
            recentPayments: [],
            upcomingPayments: [],
          },
          vendors: project.bookings?.map(booking => ({
            name: booking.vendor?.user?.name || 'Vendor',
            type: booking.serviceListing?.category || 'Service',
            contact: booking.vendor?.phone || '',
            email: booking.vendor?.user?.email || '',
            address: booking.vendor?.address || '',
            website: booking.vendor?.website || '',
            status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
            notes: booking.notes || '',
          })) || [],
        };
        setProjectData(transformedData);
      }
    } catch (err) {
      setError(err.message || 'Failed to load project');
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Typography>Loading your wedding project...</Typography>
      </Box>
    );
  }

  if (error || !projectData) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error || 'Project not found'}
          </Typography>
          <Button component={Link} to="/projects" variant="contained" sx={{ mt: 2 }}>
            Back to Projects
          </Button>
        </Box>
      </Container>
    );
  }

  const budgetProgress = projectData.budget.total > 0 
    ? (projectData.budget.spent / projectData.budget.total) * 100 
    : 0;
  const checklistProgress = projectData.checklist.total > 0
    ? (projectData.checklist.completed / projectData.checklist.total) * 100
    : 0;
  
  const weddingDate = new Date(projectData.date);
  const daysUntilWedding = Math.ceil((weddingDate - new Date()) / (1000 * 60 * 60 * 24));

  const planningTools = [
    {
      icon: BudgetIcon,
      title: 'Budget Tracker',
      description: 'Keep on top of your budget',
      progress: `${Math.round(budgetProgress)}% spent`,
      color: '#e16789',
      link: '/budget',
      stats: `RM${projectData.budget.spent.toLocaleString()} / RM${projectData.budget.total.toLocaleString()}`,
    },
    {
      icon: ChecklistIcon,
      title: 'Wedding Checklist',
      description: 'Your advice-filled list of to-do\'s awaits',
      progress: `${Math.round(checklistProgress)}% complete`,
      color: '#e16789',
      link: `/checklist?projectId=${projectData.id}`,
      stats: `${projectData.checklist.completed} of ${projectData.checklist.total} tasks`,
    },
    {
      icon: View3DIcon,
      title: '3D Venue Designer',
      description: 'Design a stylish space that shares every wedding detail',
      progress: 'Ready to design',
      color: '#e16789',
      link: `/projects/${projectData.id}/venue-designer`,
      linkState: { projectId: projectData.id },
      stats: 'Start designing',
    },
    {
      icon: PaymentIcon,
      title: 'Payment Center',
      description: 'Handle deposits and final payments seamlessly',
      progress: `RM${projectData.payments.totalPaid.toLocaleString()} paid`,
      color: '#e16789',
      link: '/payments',
      stats: `RM${projectData.payments.totalOutstanding.toLocaleString()} outstanding`,
    },
    {
      icon: PeopleIcon,
      title: 'Booked Suppliers',
      description: 'Add your booked suppliers',
      progress: `${projectData.vendors.length} vendors`,
      color: '#e16789',
      link: null,
      onClick: () => setShowVendorDetails(true),
      stats: `${projectData.vendors.filter(v => v.status === 'confirmed').length} confirmed`,
    },
  ];

  return (
    <Box className="project-dashboard" sx={{ minHeight: '100vh', backgroundColor: '#f5f6fa', pb: 6 }}>
      {/* Hero Section */}
      <Box
        className="dashboard-hero"
        sx={{
          background: 'linear-gradient(135deg, rgba(225, 103, 137, 0.15) 0%, rgba(171, 71, 188, 0.15) 100%)',
          paddingY: { xs: 4, md: 6 },
          paddingX: 2,
          marginBottom: 4,
        }}
      >
        <Container maxWidth="lg">
          {/* Back Navigation */}
            <Button
              component={Link}
              to="/projects"
              startIcon={<ArrowBackIcon />}
              sx={{
                mb: 3,
                color: '#666',
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
              }}
            >
              Back to Projects
            </Button>

          {/* Hero Content */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: { xs: 'flex-start', md: 'flex-start' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h2"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  fontWeight: 700,
                  color: '#0f060d',
                  marginBottom: 2,
                  lineHeight: 1.2,
                }}
              >
                {projectData.projectName}
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon sx={{ color: '#e16789', fontSize: '1.5rem' }} />
                  <Typography variant="body1" sx={{ color: '#666', fontFamily: "'Literata', serif" }}>
                    {weddingDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimeIcon sx={{ color: '#e16789', fontSize: '1.5rem' }} />
                  <Typography variant="body1" sx={{ color: '#666', fontFamily: "'Literata', serif" }}>
                    {projectData.time}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon sx={{ color: '#e16789', fontSize: '1.5rem' }} />
                  <Typography variant="body1" sx={{ color: '#666', fontFamily: "'Literata', serif" }}>
                    {projectData.venue}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Countdown Card */}
            <Card
              sx={{
                background: '#e16789',
                color: 'white',
                borderRadius: 1,
                padding: 3,
                minWidth: { xs: '100%', md: 200 },
                maxWidth: { xs: '100%', md: 250 },
                boxShadow: '0 4px 16px rgba(225, 103, 137, 0.3)',
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h1"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: { xs: '3rem', md: '4rem' },
                    fontWeight: 700,
                    lineHeight: 1,
                    mb: 1,
                  }}
                >
                  {daysUntilWedding > 0 ? daysUntilWedding : 0}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.95, fontFamily: "'Literata', serif" }}>
                  Days Until Wedding
                </Typography>
              </Box>
            </Card>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 }, width: '100%' }}>
        {/* Progress Overview Section */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontSize: { xs: '1.8rem', md: '2.2rem' },
              fontWeight: 700,
              color: '#0f060d',
              mb: 3,
            }}
          >
            Your Planning Progress
          </Typography>

          <Card
            sx={{
              borderRadius: 1,
              padding: { xs: 2, md: 3 },
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              width: '100%',
            }}
          >
            <Grid container spacing={0} sx={{ width: '100%', margin: 0 }}>
              {/* Budget Progress Card */}
              <Grid 
                item 
                xs={12} 
                sm={12}
                md={6} 
                sx={{ 
                  borderRight: { md: '1px solid #e0e0e0' }, 
                  borderBottom: { xs: '1px solid #e0e0e0', sm: '1px solid #e0e0e0', md: 'none' },
                  pr: { xs: 0, sm: 0, md: 3 },
                  pb: { xs: 3, sm: 3, md: 0 },
                  mb: { xs: 0, sm: 0, md: 0 },
                  width: { xs: '100%', sm: '100%', md: '50%' },
                  maxWidth: { xs: '100%', sm: '100%', md: '50%' },
                  flex: { xs: '0 0 100%', sm: '0 0 100%', md: '0 0 50%' },
                  boxSizing: 'border-box',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, mb: 2 }}>
                  <Box
                    sx={{
                      width: { xs: 40, md: 48 },
                      height: { xs: 40, md: 48 },
                      borderRadius: 1,
                      background: 'transparent',
                      border: '2px solid #e16789',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e16789',
                      flexShrink: 0,
                    }}
                  >
                    <BudgetIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' } }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontFamily: "'Playfair Display', serif", 
                        fontWeight: 600,
                        fontSize: { xs: '1rem', md: '1.25rem' },
                      }}
                    >
                      Budget Overview
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#666', 
                        fontFamily: "'Literata', serif",
                        fontSize: { xs: '0.875rem', md: '0.9375rem' },
                      }}
                    >
                      {Math.round(budgetProgress)}% spent
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={budgetProgress}
                  sx={{
                    height: 10,
                    borderRadius: 1,
                    backgroundColor: '#f0f0f0',
                    mb: 2,
                    '& .MuiLinearProgress-bar': {
                      background: '#e16789',
                      borderRadius: 1,
                    },
                  }}
                />
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 0 },
                }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#666', 
                      fontFamily: "'Literata', serif",
                      fontSize: { xs: '0.8125rem', md: '0.875rem' },
                    }}
                  >
                    RM{(projectData.budget.total - projectData.budget.spent).toLocaleString()} remaining
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600, 
                      fontFamily: "'Literata', serif",
                      fontSize: { xs: '0.8125rem', md: '0.875rem' },
                    }}
                  >
                    RM{projectData.budget.spent.toLocaleString()} / RM{projectData.budget.total.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>

              {/* Checklist Progress Card */}
              <Grid 
                item 
                xs={12} 
                sm={12}
                md={6} 
                sx={{ 
                  pl: { xs: 0, sm: 0, md: 3 },
                  pt: { xs: 3, sm: 3, md: 0 },
                  width: { xs: '100%', sm: '100%', md: '50%' },
                  maxWidth: { xs: '100%', sm: '100%', md: '50%' },
                  flex: { xs: '0 0 100%', sm: '0 0 100%', md: '0 0 50%' },
                  boxSizing: 'border-box',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, mb: 2 }}>
                  <Box
                    sx={{
                      width: { xs: 40, md: 48 },
                      height: { xs: 40, md: 48 },
                      borderRadius: 1,
                      background: 'transparent',
                      border: '2px solid #e16789',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e16789',
                      flexShrink: 0,
                    }}
                  >
                    <ChecklistIcon sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' } }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontFamily: "'Playfair Display', serif", 
                        fontWeight: 600,
                        fontSize: { xs: '1rem', md: '1.25rem' },
                      }}
                    >
                      Planning Progress
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#666', 
                        fontFamily: "'Literata', serif",
                        fontSize: { xs: '0.875rem', md: '0.9375rem' },
                      }}
                    >
                      {Math.round(checklistProgress)}% complete
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={checklistProgress}
                  sx={{
                    height: 10,
                    borderRadius: 1,
                    backgroundColor: '#f0f0f0',
                    mb: 2,
                    '& .MuiLinearProgress-bar': {
                      background: '#e16789',
                      borderRadius: 1,
                    },
                  }}
                />
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 0 },
                }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#666', 
                      fontFamily: "'Literata', serif",
                      fontSize: { xs: '0.8125rem', md: '0.875rem' },
                    }}
                  >
                    {projectData.checklist.total - projectData.checklist.completed} tasks remaining
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600, 
                      fontFamily: "'Literata', serif",
                      fontSize: { xs: '0.8125rem', md: '0.875rem' },
                    }}
                  >
                    {projectData.checklist.completed} of {projectData.checklist.total} tasks
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Box>

        {/* Planning Tools Section */}
        <Box sx={{ mb: 5, width: '100%' }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontSize: { xs: '1.8rem', md: '2.2rem' },
              fontWeight: 700,
              color: '#0f060d',
              mb: 3,
            }}
          >
            Planning Tools
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
              width: '100%',
            }}
          >
            {planningTools.map((tool, index) => {
              const IconComponent = tool.icon;
              return (
                <Box
                  key={index}
                  sx={{
                    flex: { xs: '0 0 100%', sm: '0 0 calc(50% - 12px)', md: '0 0 calc(33.333% - 16px)' },
                    minWidth: 0,
                    display: 'flex',
                  }}
                >
                  <Card
                    sx={{
                      borderRadius: 1,
                      padding: 3,
                      width: '100%',
                      height: '100%',
                      minHeight: 280,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 1,
                          background: 'transparent',
                          border: '2px solid #e16789',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#e16789',
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent sx={{ fontSize: 28 }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontFamily: "'Playfair Display', serif",
                            fontWeight: 600,
                            color: '#0f060d',
                            mb: 0.5,
                          }}
                        >
                          {tool.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#666',
                            fontFamily: "'Literata', serif",
                            mb: 1,
                            lineHeight: 1.5,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {tool.description}
                        </Typography>
                        <Chip
                          label={tool.progress}
                          size="small"
                          sx={{
                            backgroundColor: `${tool.color}15`,
                            color: tool.color,
                            fontFamily: "'Literata', serif",
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            borderRadius: 1,
                          }}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mt: 'auto', pt: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#999',
                          fontFamily: "'Literata', serif",
                          mb: 2,
                          fontSize: '0.85rem',
                        }}
                      >
                        {tool.stats}
                      </Typography>
                      {tool.link ? (
                        <Button
                          component={Link}
                          to={tool.link}
                          state={tool.linkState}
                          fullWidth
                          variant="outlined"
                          sx={{
                            background: 'transparent',
                            border: `2px solid ${tool.color}`,
                            color: tool.color,
                            textTransform: 'none',
                            borderRadius: 1,
                            padding: 1.25,
                            fontFamily: "'Literata', serif",
                            fontWeight: 600,
                            '&:hover': {
                              background: tool.color,
                              border: `2px solid ${tool.color}`,
                              color: 'white',
                              transform: 'translateY(-2px)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          Get started
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={tool.onClick}
                          sx={{
                            background: 'transparent',
                            border: `2px solid ${tool.color}`,
                            color: tool.color,
                            textTransform: 'none',
                            borderRadius: 1,
                            padding: 1.25,
                            fontFamily: "'Literata', serif",
                            fontWeight: 600,
                            '&:hover': {
                              background: tool.color,
                              border: `2px solid ${tool.color}`,
                              color: 'white',
                              transform: 'translateY(-2px)',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          Get started
                        </Button>
                      )}
                    </Box>
                  </Card>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Quick Actions Section */}
        <Box
          sx={{
            backgroundColor: 'white',
            borderRadius: 3,
            padding: 3,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 600,
              color: '#0f060d',
              mb: 2,
            }}
          >
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                borderColor: '#e0e0e0',
                color: '#666',
                '&:hover': {
                  borderColor: '#e16789',
                  color: '#e16789',
                  backgroundColor: 'rgba(225, 103, 137, 0.05)',
                },
              }}
            >
              Add Task
            </Button>
            <Button
              variant="outlined"
              startIcon={<TrendingUpIcon />}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                borderColor: '#e0e0e0',
                color: '#666',
                '&:hover': {
                  borderColor: '#e16789',
                  color: '#e16789',
                  backgroundColor: 'rgba(225, 103, 137, 0.05)',
                },
              }}
            >
              Add Expense
            </Button>
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                borderColor: '#e0e0e0',
                color: '#666',
                '&:hover': {
                  borderColor: '#e16789',
                  color: '#e16789',
                  backgroundColor: 'rgba(225, 103, 137, 0.05)',
                },
              }}
            >
              Share Project
            </Button>
          </Box>
        </Box>
      </Container>

      {/* Vendor Details Popup */}
      {showVendorDetails && (
        <VendorDetailsPopup
          vendors={projectData.vendors}
          onClose={() => setShowVendorDetails(false)}
        />
      )}
    </Box>
  );
};

export default ProjectDashboard;

