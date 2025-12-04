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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  TextField,
  InputAdornment,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
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
  Assignment as AssignmentIcon,
  Search as SearchIcon,
  Close,
} from '@mui/icons-material';
import { apiFetch, updateProjectVenue } from '../../lib/api';
import VendorDetailsPopup from '../../components/VendorDetailsPopup/VendorDetailsPopup';
import Model3DViewer from '../../components/Model3DViewer/Model3DViewer';
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
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [venues, setVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venueSearchTerm, setVenueSearchTerm] = useState('');
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [changingVenue, setChangingVenue] = useState(false);
  const [toastNotification, setToastNotification] = useState({ open: false, message: '', severity: 'info' });
  const [detailsVenue, setDetailsVenue] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [activeModelIndex, setActiveModelIndex] = useState(0);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchVenues = async () => {
    try {
      setVenuesLoading(true);
      const params = new URLSearchParams();
      if (venueSearchTerm.trim()) params.append('search', venueSearchTerm.trim());
      if (projectData?.date) {
        const dateStr = new Date(projectData.date).toISOString().split('T')[0];
        params.append('date', dateStr);
      }
      const query = params.toString();
      const endpoint = query ? `/venues/search?${query}` : '/venues/search';
      const data = await apiFetch(endpoint);
      if (data && Array.isArray(data.venues)) {
        setVenues(data.venues);
      } else if (Array.isArray(data)) {
        setVenues(data);
      } else {
        setVenues([]);
      }
    } catch (err) {
      console.error('Error fetching venues:', err);
      setVenues([]);
    } finally {
      setVenuesLoading(false);
    }
  };

  useEffect(() => {
    if (showVenueModal && projectData) {
      fetchVenues();
    }
  }, [showVenueModal, venueSearchTerm, projectData]);

  const normalizeVenueImages = (venue) => {
    if (!venue) return [];
    const images = [];
    if (Array.isArray(venue.images)) images.push(...venue.images);
    if (Array.isArray(venue.galleryImages)) images.push(...venue.galleryImages);
    if (venue.imageUrl) images.push(venue.imageUrl);
    return [...new Set(images.filter(Boolean))];
  };

  const openVenueDetails = async (venue, e) => {
    if (e) e.stopPropagation();
    setDetailsVenue(venue);
    setCurrentImageIndex(0);
    setIsImageFullscreen(false);
    
    try {
      const dateStr = projectData?.date ? new Date(projectData.date).toISOString().split('T')[0] : null;
      const endpoint = dateStr ? `/venues/${venue.id}?date=${encodeURIComponent(dateStr)}` : `/venues/${venue.id}`;
      const fullDetails = await apiFetch(endpoint);
      setDetailsVenue((current) => {
        if (!current || current.id !== venue.id) return current;
        return { ...current, ...fullDetails };
      });
    } catch (err) {
      console.error('Failed to load venue details', err);
    }
  };

  const closeVenueDetails = () => {
    setIsImageFullscreen(false);
    setDetailsVenue(null);
  };

  const getImageUrl = (url) => {
    if (!url) return '/placeholder-venue.jpg';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/uploads')) return `http://localhost:4000${url}`;
    return url;
  };

  const venueImages = detailsVenue ? normalizeVenueImages(detailsVenue) : [];
  const hasMultipleImages = venueImages.length > 1;
  const activeImage = venueImages[currentImageIndex] || detailsVenue?.imageUrl || null;

  const modelSources = detailsVenue ? (() => {
    const list = [];
    const primary = detailsVenue.designElement?.modelFile || detailsVenue.modelFile;
    if (primary) {
      list.push({
        src: primary,
        label: detailsVenue.designElement?.name || detailsVenue.name || '3D Model',
        dimensions: detailsVenue.designElement?.dimensions || detailsVenue.dimensions || null,
      });
    }
    if (Array.isArray(detailsVenue.components)) {
      detailsVenue.components.forEach((component, index) => {
        const file = component?.designElement?.modelFile;
        if (file) {
          list.push({
            src: file,
            label: component?.designElement?.name || component?.name || `Component ${index + 1}`,
            dimensions: component?.designElement?.dimensions || null,
          });
        }
      });
    }
    return list;
  })() : [];
  const hasModels = modelSources.length > 0;
  const activeModel = modelSources[activeModelIndex] || null;

  const handleChangeVenue = async () => {
    if (!selectedVenue) return;
    
    try {
      setChangingVenue(true);
      await updateProjectVenue(projectData.id, selectedVenue.id);
      
      setToastNotification({
        open: true,
        message: 'Venue updated successfully! Your services and 3D design have been preserved.',
        severity: 'success',
      });
      
      setShowVenueModal(false);
      setSelectedVenue(null);
      setVenueSearchTerm('');
      fetchProjectData(); // Refresh project data
    } catch (err) {
      setToastNotification({
        open: true,
        message: err.message || 'Failed to update venue. Please try again.',
        severity: 'error',
      });
    } finally {
      setChangingVenue(false);
    }
  };

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
        // Check for cancelled venue booking
        const cancelledVenueBooking = project.bookings?.find(
          booking => 
            booking.vendor?.category === 'Venue' && 
            (booking.status === 'cancelled_by_vendor' || booking.status === 'cancelled_by_couple') &&
            booking.selectedServices?.some(ss => ss.serviceListingId === project.venueServiceListingId)
        );
        
        // Check if there's an active venue booking
        const activeVenueBooking = project.bookings?.find(
          booking => 
            booking.vendor?.category === 'Venue' && 
            !['cancelled_by_vendor', 'cancelled_by_couple', 'rejected'].includes(booking.status) &&
            booking.selectedServices?.some(ss => ss.serviceListingId === project.venueServiceListingId)
        );

        // Transform API data to match expected structure
        const transformedData = {
          id: project.id,
          projectName: project.projectName || "Our Dream Wedding",
          date: project.weddingDate,
          time: new Date(project.weddingDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          eventStartTime: project.eventStartTime,
          eventEndTime: project.eventEndTime,
          venue: project.venueServiceListing?.name || 'Venue TBD',
          venueServiceListingId: project.venueServiceListingId,
          hasCancelledVenue: !!cancelledVenueBooking,
          hasActiveVenue: !!activeVenueBooking,
          cancelledVenueBooking: cancelledVenueBooking ? {
            id: cancelledVenueBooking.id,
            reason: cancelledVenueBooking.cancellation?.cancellationReason || 'Venue booking cancelled',
            cancelledDate: cancelledVenueBooking.updatedAt,
          } : null,
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
        link: `/budget?projectId=${projectData.id}`,
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
      link: `/payment-center?projectId=${projectData.id}`,
      stats: `RM${projectData.payments.totalOutstanding.toLocaleString()} outstanding`,
    },
    {
      icon: PeopleIcon,
      title: 'Booked Suppliers',
      description: 'View your confirmed vendors',
      progress: `${projectData.vendors.length} vendors`,
      color: '#e16789',
      link: `/booked-suppliers?projectId=${projectData.id}`,
      stats: `${projectData.vendors.filter(v => v.status === 'confirmed').length} confirmed`,
    },
    {
      icon: AssignmentIcon,
      title: 'My Bookings',
      description: 'Track all your booking requests and their status',
      progress: `${projectData.vendors.length} bookings`,
      color: '#e16789',
      link: `/my-bookings?projectId=${projectData.id}`,
      stats: 'View all bookings',
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

          {/* Venue Cancellation Alert */}
          {projectData?.hasCancelledVenue && !projectData?.hasActiveVenue && (
            <Box sx={{ mb: 3 }}>
              <Alert 
                severity="warning" 
                sx={{ 
                  borderRadius: 2,
                  mb: 2,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Your venue booking has been cancelled
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 1 }}>
                  {projectData.cancelledVenueBooking?.reason || 'Your venue booking was cancelled. Please select a new venue before your wedding date to avoid automatic cancellation of dependent services.'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  You have a grace period until your wedding date to select a replacement venue. If no replacement is selected, dependent service bookings will be automatically cancelled.
                </Typography>
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => setShowVenueModal(true)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    backgroundColor: '#ed6c02',
                    '&:hover': {
                      backgroundColor: '#e65100',
                    },
                  }}
                >
                  Change Venue
                </Button>
              </Box>
            </Box>
          )}

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
                {projectData.eventStartTime && projectData.eventEndTime ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimeIcon sx={{ color: '#e16789', fontSize: '1.5rem' }} />
                    <Typography variant="body1" sx={{ color: '#666', fontFamily: "'Literata', serif" }}>
                      {new Date(projectData.eventStartTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(projectData.eventEndTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                ) : projectData.time ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimeIcon sx={{ color: '#e16789', fontSize: '1.5rem' }} />
                    <Typography variant="body1" sx={{ color: '#666', fontFamily: "'Literata', serif" }}>
                      {projectData.time}
                    </Typography>
                  </Box>
                ) : null}
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

      {/* Venue Selection Modal */}
      <Dialog
        open={showVenueModal}
        onClose={() => !changingVenue && setShowVenueModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Select a New Venue
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Your existing services and 3D design will be preserved
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search venues..."
            value={venueSearchTerm}
            onChange={(e) => setVenueSearchTerm(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocationIcon />
                </InputAdornment>
              ),
            }}
          />
          
          {venuesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : venues.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No venues found. Try adjusting your search.
            </Typography>
          ) : (
            <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
              {venues.map((venue) => (
                <Card
                  key={venue.id}
                  onClick={() => setSelectedVenue(venue)}
                  sx={{
                    mb: 2,
                    p: 2,
                    cursor: 'pointer',
                    border: selectedVenue?.id === venue.id ? 2 : 1,
                    borderColor: selectedVenue?.id === venue.id ? '#e16789' : 'divider',
                    backgroundColor: selectedVenue?.id === venue.id ? 'rgba(225, 103, 137, 0.05)' : 'background.paper',
                    '&:hover': {
                      borderColor: '#e16789',
                      backgroundColor: 'rgba(225, 103, 137, 0.05)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {venue.name}
                      </Typography>
                      {venue.vendor?.user?.name && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          by {venue.vendor.user.name}
                        </Typography>
                      )}
                      {venue.price && (
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#e16789' }}>
                          RM {parseFloat(venue.price).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => openVenueDetails(venue, e)}
                        sx={{ textTransform: 'none' }}
                      >
                        View Details
                      </Button>
                      {selectedVenue?.id === venue.id && (
                        <Chip
                          label="Selected"
                          size="small"
                          sx={{
                            backgroundColor: '#e16789',
                            color: 'white',
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowVenueModal(false);
              setSelectedVenue(null);
              setVenueSearchTerm('');
            }}
            disabled={changingVenue}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleChangeVenue}
            disabled={!selectedVenue || changingVenue}
            variant="contained"
            sx={{
              textTransform: 'none',
              backgroundColor: '#e16789',
              '&:hover': {
                backgroundColor: '#d1567a',
              },
              '&:disabled': {
                backgroundColor: 'rgba(0, 0, 0, 0.12)',
              },
            }}
          >
            {changingVenue ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Updating...
              </>
            ) : (
              'Confirm Selection'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Venue Details Modal */}
      <Dialog
        open={!!detailsVenue}
        onClose={closeVenueDetails}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {detailsVenue?.name}
            </Typography>
            <IconButton
              onClick={closeVenueDetails}
              sx={{ minWidth: 'auto', p: 1 }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailsVenue && (
            <Box>
              {/* Hero Image */}
              {activeImage && (
                <Box sx={{ position: 'relative', mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                  {hasMultipleImages && (
                    <>
                      <IconButton
                        onClick={() => setCurrentImageIndex((prev) => (prev - 1 + venueImages.length) % venueImages.length)}
                        sx={{
                          position: 'absolute',
                          left: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                        }}
                      >
                        <ArrowBackIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => setCurrentImageIndex((prev) => (prev + 1) % venueImages.length)}
                        sx={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                        }}
                      >
                        <ArrowForwardIcon />
                      </IconButton>
                      <Chip
                        label={`${currentImageIndex + 1} / ${venueImages.length}`}
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                        }}
                      />
                    </>
                  )}
                  <img
                    src={getImageUrl(activeImage)}
                    alt={detailsVenue.name}
                    style={{ width: '100%', height: '400px', objectFit: 'cover' }}
                  />
                </Box>
              )}

              {/* Venue Info */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={hasModels ? 6 : 12}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Venue Information
                  </Typography>
                  {detailsVenue.vendor?.businessName && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Business:</strong> {detailsVenue.vendor.businessName}
                    </Typography>
                  )}
                  {detailsVenue.location && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Location:</strong> {detailsVenue.location}
                    </Typography>
                  )}
                  {detailsVenue.capacity && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Capacity:</strong> {detailsVenue.capacity}+ guests
                    </Typography>
                  )}
                  {detailsVenue.price && (
                    <Typography variant="body2" sx={{ mb: 1, color: '#e16789', fontWeight: 600 }}>
                      <strong>Price:</strong> RM {parseFloat(detailsVenue.price).toLocaleString()}
                    </Typography>
                  )}
                  {detailsVenue.description && (
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      {detailsVenue.description}
                    </Typography>
                  )}
                </Grid>

                {/* 3D Model Preview */}
                {hasModels && activeModel && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      3D Preview
                    </Typography>
                    {modelSources.length > 1 && (
                      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {modelSources.map((model, idx) => (
                          <Chip
                            key={idx}
                            label={model.label}
                            onClick={() => setActiveModelIndex(idx)}
                            sx={{
                              cursor: 'pointer',
                              backgroundColor: activeModelIndex === idx ? '#e16789' : 'default',
                              color: activeModelIndex === idx ? 'white' : 'default',
                            }}
                          />
                        ))}
                      </Box>
                    )}
                    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                      <Model3DViewer
                        key={`${activeModel.src}-${JSON.stringify(activeModel.dimensions || {})}`}
                        modelUrl={activeModel.src}
                        height="320px"
                        width="100%"
                        borderless
                        autoRotate
                        targetDimensions={activeModel.dimensions || null}
                      />
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeVenueDetails} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          {detailsVenue && (
            <Button
              variant="contained"
              onClick={() => {
                setSelectedVenue(detailsVenue);
                closeVenueDetails();
              }}
              sx={{
                textTransform: 'none',
                backgroundColor: '#e16789',
                '&:hover': { backgroundColor: '#d1567a' },
              }}
            >
              Select This Venue
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={toastNotification.open}
        autoHideDuration={6000}
        onClose={() => setToastNotification({ ...toastNotification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToastNotification({ ...toastNotification, open: false })}
          severity={toastNotification.severity}
          sx={{ width: '100%' }}
        >
          {toastNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectDashboard;

