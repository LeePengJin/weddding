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
  WarningAmberRounded,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { apiFetch, updateProjectVenue } from '../../lib/api';
import VendorDetailsPopup from '../../components/VendorDetailsPopup/VendorDetailsPopup';
import Model3DViewer from '../../components/Model3DViewer/Model3DViewer';
import '../CreateProject/CreateProject.styles.css';
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

  const handleNextImage = (event) => {
    if (event) event.stopPropagation();
    if (!hasMultipleImages) return;
    setCurrentImageIndex((prev) => (prev + 1) % venueImages.length);
  };

  const handlePrevImage = (event) => {
    if (event) event.stopPropagation();
    if (!hasMultipleImages) return;
    setCurrentImageIndex((prev) => (prev - 1 + venueImages.length) % venueImages.length);
  };

  const handleThumbnailSelect = (index, event) => {
    if (event) event.stopPropagation();
    if (index < 0 || index >= venueImages.length) return;
    setCurrentImageIndex(index);
    setIsImageFullscreen(false);
  };

  const openImageFullscreen = (event) => {
    if (event) event.stopPropagation();
    if (!venueImages.length) return;
    setIsImageFullscreen(true);
  };

  const closeImageFullscreen = (event) => {
    if (event) event.stopPropagation();
    setIsImageFullscreen(false);
  };

  useEffect(() => {
    if (!detailsVenue) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isImageFullscreen) {
          setIsImageFullscreen(false);
          return;
        }
        closeVenueDetails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsVenue, isImageFullscreen]);

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
            <Alert 
              severity="warning" 
              sx={{ 
                borderRadius: 2,
                mb: 3,
                '& .MuiAlert-message': { width: '100%' },
              }}
              icon={<WarningAmberRounded sx={{ color: '#ed6c02' }} />}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Your venue booking has been cancelled
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 1 }}>
                    {projectData.cancelledVenueBooking?.reason || 'Your venue booking was cancelled. Please select a new venue before your wedding date to avoid automatic cancellation of dependent services.'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    You have a grace period until your wedding date to select a replacement venue. If no replacement is selected, dependent service bookings will be automatically cancelled.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={() => setShowVenueModal(true)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor: '#e16789',
                    '&:hover': {
                      backgroundColor: '#d1567a',
                    },
                    alignSelf: 'center',
                  }}
                >
                  Change Venue
                </Button>
              </Box>
            </Alert>
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
              <Grid container spacing={2}>
                {venues.map((venue) => {
                  const cardImage = getImageUrl(venue.images?.[0] || venue.imageUrl);
                  return (
                    <Grid item xs={12} sm={6} key={venue.id}>
                      <Card
                        onClick={() => setSelectedVenue(venue)}
                        sx={{
                          cursor: 'pointer',
                          border: selectedVenue?.id === venue.id ? 2 : 1,
                          borderColor: selectedVenue?.id === venue.id ? '#e16789' : 'divider',
                          backgroundColor: selectedVenue?.id === venue.id ? 'rgba(225, 103, 137, 0.05)' : 'background.paper',
                          '&:hover': {
                            borderColor: '#e16789',
                            backgroundColor: 'rgba(225, 103, 137, 0.05)',
                          },
                          overflow: 'hidden',
                        }}
                      >
                        <Box sx={{ position: 'relative', height: 180, backgroundColor: '#f6f6f6' }}>
                          <img
                            src={cardImage}
                            alt={venue.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.src = '/placeholder-venue.jpg';
                            }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(e) => openVenueDetails(venue, e)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              minWidth: 'auto',
                              px: 1.5,
                              textTransform: 'none',
                              backgroundColor: 'rgba(255,255,255,0.9)',
                              color: '#e16789',
                              '&:hover': { backgroundColor: '#e16789', color: '#fff' },
                            }}
                          >
                            i
                          </Button>
                          {selectedVenue?.id === venue.id && (
                            <Chip
                              label="Selected"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                backgroundColor: '#e16789',
                                color: 'white',
                              }}
                            />
                          )}
                        </Box>
                        <Box sx={{ p: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {venue.name}
                          </Typography>
                          {venue.vendor?.user?.name && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              by {venue.vendor.user.name}
                            </Typography>
                          )}
                          {venue.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <LocationIcon fontSize="small" sx={{ color: '#888' }} />
                              <Typography variant="body2" color="text.secondary">
                                {venue.location}
                              </Typography>
                            </Box>
                          )}
                          {venue.price && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocalOfferIcon fontSize="small" sx={{ color: '#e16789' }} />
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#e16789' }}>
                                RM {parseFloat(venue.price).toLocaleString()}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
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
      {detailsVenue && (
        <>
          <div
            className="venue-details-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Venue details for ${detailsVenue.name}`}
            onClick={closeVenueDetails}
          >
            <div
              className="venue-details-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="venue-details-close"
                onClick={closeVenueDetails}
                aria-label="Close venue details"
              >
                <i className="fas fa-times"></i>
              </button>

              <div className="venue-details-hero">
                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      className="venue-hero-control prev"
                      onClick={handlePrevImage}
                      aria-label="Previous image"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      className="venue-hero-control next"
                      onClick={handleNextImage}
                      aria-label="Next image"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                    <div className="venue-hero-counter">
                      {currentImageIndex + 1} / {venueImages.length}
                    </div>
                  </>
                )}
                <img
                  src={getImageUrl(activeImage || '/placeholder-venue.jpg')}
                  alt={detailsVenue.name}
                  onClick={openImageFullscreen}
                  role={venueImages.length ? 'button' : undefined}
                  tabIndex={venueImages.length ? 0 : -1}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      openImageFullscreen(event);
                    }
                  }}
                  onError={(e) => {
                    e.target.src = '/placeholder-venue.jpg';
                  }}
                />
              </div>

              {hasMultipleImages && (
                <div className="venue-hero-thumbnails">
                  {venueImages.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={`venue-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={(event) => handleThumbnailSelect(index, event)}
                      aria-label={`View image ${index + 1}`}
                    >
                      <img
                        src={getImageUrl(image)}
                        alt={`${detailsVenue.name} thumbnail ${index + 1}`}
                        onError={(e) => {
                          e.target.src = '/placeholder-venue.jpg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="venue-details-content">
                <h3>{detailsVenue.name}</h3>

                <div className="venue-details-meta">
                  {detailsVenue.vendor?.businessName && (
                    <p>
                      <i className="fas fa-building"></i>
                      {detailsVenue.vendor.businessName}
                    </p>
                  )}
                  {detailsVenue.location && (
                    <p>
                      <i className="fas fa-map-pin"></i>
                      {detailsVenue.location}
                    </p>
                  )}
                  {detailsVenue.capacity && (
                    <p>
                      <i className="fas fa-users"></i>
                      {detailsVenue.capacity}+ guests
                    </p>
                  )}
                  {detailsVenue.price && (
                    <p>
                      <i className="fas fa-tag"></i>
                      RM {detailsVenue.price.toLocaleString()}
                    </p>
                  )}
                </div>

                {detailsVenue.description && (
                  <div className="venue-details-section">
                    <h4>About this venue</h4>
                    <p>{detailsVenue.description}</p>
                  </div>
                )}

                {Array.isArray(detailsVenue.amenities) && detailsVenue.amenities.length > 0 && (
                  <div className="venue-details-section">
                    <h4>Amenities</h4>
                    <ul className="venue-amenities-list">
                      {detailsVenue.amenities.map((amenity) => (
                        <li key={amenity}>
                          <i className="fas fa-check"></i>
                          {amenity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailsVenue.extraDetails && (
                  <div className="venue-details-section">
                    <h4>Additional Details</h4>
                    <p>{detailsVenue.extraDetails}</p>
                  </div>
                )}

                {hasModels && activeModel && (
                  <div className="venue-details-section">
                    <h4>3D Preview</h4>
                    <div className="venue-3d-preview">
                      <Model3DViewer
                        key={`${activeModel.src}-${JSON.stringify(activeModel.dimensions || {})}`}
                        modelUrl={activeModel.src}
                        height="320px"
                        width="100%"
                        borderless
                        autoRotate
                        targetDimensions={activeModel.dimensions || null}
                      />
                      {modelSources.length > 1 && (
                        <div className="venue-3d-controls">
                          <button
                            type="button"
                            className="venue-3d-nav"
                            onClick={() =>
                              setActiveModelIndex((prev) =>
                                (prev - 1 + modelSources.length) % modelSources.length
                              )
                            }
                          >
                            ‹ Prev
                          </button>
                          <span className="venue-3d-label">{activeModel.label}</span>
                          <button
                            type="button"
                            className="venue-3d-nav"
                            onClick={() =>
                              setActiveModelIndex((prev) =>
                                (prev + 1) % modelSources.length
                              )
                            }
                          >
                            Next ›
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="venue-details-close-bottom"
                  onClick={() => {
                    setSelectedVenue(detailsVenue);
                    closeVenueDetails();
                  }}
                  aria-label="Select this venue"
                >
                  <i className="fas fa-check"></i>
                  <span>Select This Venue</span>
                </button>
              </div>
            </div>
          </div>

          {isImageFullscreen && (
            <div
              className="venue-fullscreen-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={`Fullscreen view of ${detailsVenue.name}`}
              onClick={closeImageFullscreen}
            >
              <div
                className="venue-fullscreen-inner"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="venue-fullscreen-close"
                  onClick={closeImageFullscreen}
                  aria-label="Close image viewer"
                >
                  <i className="fas fa-times"></i>
                </button>

                <img
                  src={getImageUrl(activeImage)}
                  alt={`${detailsVenue.name} fullscreen`}
                  onError={(e) => {
                    e.target.src = '/placeholder-venue.jpg';
                  }}
                />

                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      className="venue-fullscreen-control prev"
                      onClick={handlePrevImage}
                      aria-label="Previous image"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      className="venue-fullscreen-control next"
                      onClick={handleNextImage}
                      aria-label="Next image"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                    <div className="venue-fullscreen-counter">
                      {currentImageIndex + 1} / {venueImages.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

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

