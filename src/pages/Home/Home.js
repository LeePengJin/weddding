import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Fade,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  CreateNewFolder as CreateProjectIcon,
  ViewInAr as View3DIcon,
  AccountBalanceWallet as BudgetIcon,
  Checklist as ChecklistIcon,
  Payment as PaymentIcon,
  Apps as PlatformIcon,
} from '@mui/icons-material';
import TiltedCard from '../../components/TiltedCard/TiltedCard';
import { PetalCursor } from '../../components/PetalCursor/PetalCursor';
import './Home.styles.css';

const HERO_IMAGE = '/images/home-hero-img.jpg';
const TESTIMONIAL_BG = '/images/testimonial-bg.jpg';

const FEATURE_ICONS = [
  CreateProjectIcon,
  View3DIcon,
  BudgetIcon,
  ChecklistIcon,
  PaymentIcon,
  PlatformIcon,
];

const FEATURES = [
  {
    title: 'Wedding Project Creation',
    description: 'Start your journey by setting your date, time, and venue preferences. Choose between self-organized planning or our curated pre-design packages.',
  },
  {
    title: '3D Venue Designer',
    description: 'Visualize your dream wedding in stunning 3D. Design layouts, place decorations, and see your venue come to life before the big day.',
  },
  {
    title: 'Efficient Budget Tracker',
    description: 'Keep your wedding costs organized with our budget management system. Track expenses and stay within your budget.',
  },
  {
    title: 'Wedding Checklist',
    description: 'Never miss a detail with our comprehensive wedding planning checklist tailored to your celebration.',
  },
  {
    title: 'Payment Management',
    description: 'Handle deposits and final payments seamlessly. Track vendor payments and manage your wedding finances with ease.',
  },
  {
    title: 'All in one platform',
    description: 'Browse trusted wedding vendors in one place. View profiles and reviews to find the perfect match for your special day.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Planning our wedding felt like a dream come true with Weddding. Every detail, from the venue layout to the vendors, came together so beautifully — just the way we envisioned.',
    author: 'Max & Jessica',
  },
  {
    quote: 'The 3D designer helped us experiment with multiple setups before committing. It saved us time and money, and our planner loved collaborating in real-time.',
    author: 'Amelia & Richard',
  },
  {
    quote: 'We managed our checklist, payments, and communication all in one place. Weddding made the entire planning journey effortless.',
    author: 'Priya & Daniel',
  },
];

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const handleStartPlanning = () => {
    if (user) {
      navigate('/projects');
    } else {
      navigate('/login');
    }
  };

  const nextTestimonial = () => {
    setFadeIn(false);
    setTimeout(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
      setFadeIn(true);
    }, 200);
  };

  const prevTestimonial = () => {
    setFadeIn(false);
    setTimeout(() => {
      setTestimonialIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
      setFadeIn(true);
    }, 200);
  };

  const { quote, author } = TESTIMONIALS[testimonialIndex];

  return (
    <Box className="homepage">
      <PetalCursor />
      {/* Hero Section */}
      <Box
        className="hero"
        sx={{
          position: 'relative',
          minHeight: { xs: '580px', md: '720px' },
          backgroundImage: `url(${HERO_IMAGE})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: { xs: 'calc(88px + 3rem)', md: 'calc(88px + 5rem)' },
          paddingX: 2,
        }}
      >
        <Box
          className="hero-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(225, 103, 137, 0.62) 0%, rgba(225, 103, 137, 0.25) 100%)',
          }}
        />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Typography
            variant="h1"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontSize: { xs: '2.8rem', md: '4.2rem' },
              fontWeight: 800,
              color: '#434D7D',
              marginBottom: 2,
            }}
          >
            Design Your Forever, Today
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Literata', serif",
              fontSize: { xs: '1rem', md: '1.2rem' },
              color: '#434D7D',
              marginBottom: 4,
              letterSpacing: '0.015em',
            }}
          >
            From vision to vow — create the day you've always imagined
          </Typography>
          <Button
            variant="contained"
            onClick={handleStartPlanning}
            sx={{
              background: 'linear-gradient(135deg, rgba(225, 103, 137, 0.85) 0%, rgba(198, 64, 113, 0.85) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              color: '#ffffff',
              padding: '0.95rem 3.25rem',
              borderRadius: '999px',
              fontSize: '1.05rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              boxShadow: '0 18px 32px rgba(225, 103, 137, 0.28)',
              textTransform: 'none',
              transform: 'translateY(0)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: '0 22px 38px rgba(198, 64, 113, 0.28)',
                background: 'linear-gradient(135deg, rgba(225, 103, 137, 0.95) 0%, rgba(198, 64, 113, 0.95) 100%)',
              },
            }}
          >
            Start Planning Now
          </Button>
        </Container>
      </Box>

      {/* Features Section */}
      <Box className="features-section" sx={{ paddingY: { xs: 4, md: 6 }, paddingX: 2 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontSize: { xs: '2.2rem', md: '3rem' },
              textAlign: 'center',
              marginBottom: 4,
              color: '#0f060d',
            }}
          >
            Our Features
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 3, md: 5 },
              justifyContent: 'center',
            }}
          >
            {FEATURES.map((feature, index) => (
              <Box
                key={feature.title}
                sx={{
                  width: { xs: '100%', sm: '343px', md: '343px' },
                  height: { xs: 'auto', md: '280px' },
                  flexShrink: 0,
                  margin: 0,
                  padding: 0,
                  boxSizing: 'border-box',
                }}
              >
                <TiltedCard
                  containerHeight="100%"
                  containerWidth="100%"
                  scaleOnHover={1.05}
                  rotateAmplitude={8}
                  showMobileWarning={false}
                >
                  <Card
                    sx={{
                      height: '100%',
                      width: '100%',
                      border: '1px solid rgba(217, 217, 217, 0.7)',
                      borderRadius: 2,
                      padding: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      backgroundColor: '#ffffff',
                      transformStyle: 'preserve-3d',
                      margin: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <CardContent sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                        {React.createElement(FEATURE_ICONS[index], {
                          sx: { fontSize: '56px', color: '#e16789' },
                        })}
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontFamily: "'Literata', serif",
                          fontSize: '1.3rem',
                          fontWeight: 700,
                          marginBottom: 1.5,
                          color: '#0f060d',
                        }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.95rem',
                          lineHeight: 1.6,
                          color: '#2d2d2d',
                        }}
                      >
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </TiltedCard>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Testimonial Section */}
      <Box
        className="testimonial"
        sx={{
          position: 'relative',
          minHeight: { xs: '560px', md: '600px' },
          backgroundImage: `url(${TESTIMONIAL_BG})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingY: { xs: 4, md: 6 },
          paddingX: 2,
          marginTop: 3,
        }}
      >
        <Box
          className="testimonial-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 1, md: 3 },
              flexWrap: 'nowrap',
            }}
          >
            <IconButton
              onClick={prevTestimonial}
              aria-label="Previous testimonial"
              sx={{
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#2d251f',
                width: { xs: 48, md: 56 },
                height: { xs: 48, md: 56 },
                flexShrink: 0,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 1)',
                  transform: 'scale(1.05)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronLeft sx={{ fontSize: { xs: 28, md: 32 } }} />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center', color: '#ffffff' }}>
              <Fade in={fadeIn} timeout={500}>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: { xs: '2rem', md: '2.6rem' },
                      marginBottom: 2,
                    }}
                  >
                    Testimonial
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: "'Literata', serif",
                      fontSize: { xs: '1.1rem', md: '1.35rem' },
                      lineHeight: 1.9,
                      marginBottom: 2,
                      fontStyle: 'italic',
                    }}
                  >
                    "{quote}"
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: "'Literata', serif",
                      fontSize: { xs: '0.9rem', md: '1rem' },
                      letterSpacing: '0.1em',
                      opacity: 0.95,
                    }}
                  >
                    — {author}
                  </Typography>
                </Box>
              </Fade>
            </Box>
            <IconButton
              onClick={nextTestimonial}
              aria-label="Next testimonial"
              sx={{
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#2d251f',
                width: { xs: 48, md: 56 },
                height: { xs: 48, md: 56 },
                flexShrink: 0,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 1)',
                  transform: 'scale(1.05)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronRight sx={{ fontSize: { xs: 28, md: 32 } }} />
            </IconButton>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        className="homepage-footer"
        sx={{
          backgroundColor: '#2d251f',
          color: '#ffffff',
          width: '100%',
          paddingY: '10px',
          paddingX: { xs: 2, md: 4 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: { xs: 3, md: 0 },
          margin: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Brand Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            paddingX: '11px',
            paddingY: '18px',
            width: { xs: '100%', md: '671px' },
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', paddingX: '10px' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                color: '#f5bdba',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M16.1111 3C19.6333 3 22 6.3525 22 9.48C22 15.8138 12.1778 21 12 21C11.8222 21 2 15.8138 2 9.48C2 6.3525 4.36667 3 7.88889 3C9.91111 3 11.2333 4.02375 12 4.92375C12.7667 4.02375 14.0889 3 16.1111 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Box>
            <Typography
              sx={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              Weddding
            </Typography>
          </Box>
          <Box sx={{ padding: '10px', width: '375px', maxWidth: '100%' }}>
            <Typography
              sx={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.95rem',
                fontWeight: 400,
                color: '#ffffff',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              Your dream wedding starts here. Create, visualize, and plan every detail of your perfect day with our innovative 3D wedding planning platform.
            </Typography>
          </Box>
        </Box>

        {/* Planning Tools Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            paddingX: '11px',
            paddingY: '18px',
            width: { xs: '100%', md: '261px' },
            flexShrink: 0,
          }}
        >
          <Box sx={{ paddingX: '10px' }}>
            <Typography
              sx={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              Planning Tools
            </Typography>
          </Box>
          <Box sx={{ padding: '10px' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.95rem',
                fontWeight: 400,
                color: '#ffffff',
                lineHeight: 1.6,
                gap: 0.5,
              }}
            >
              <Typography sx={{ margin: 0 }}>Create Project</Typography>
              <Typography sx={{ margin: 0 }}>3D Designer</Typography>
              <Typography sx={{ margin: 0 }}>Budget Tracker</Typography>
              <Typography sx={{ margin: 0 }}>Wedding Checklist</Typography>
              <Typography sx={{ margin: 0 }}>Wedding Booking</Typography>
              <Typography sx={{ margin: 0 }}>Payment Center</Typography>
            </Box>
          </Box>
        </Box>

        {/* Support Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            paddingX: '11px',
            paddingY: '18px',
            width: { xs: '100%', md: '261px' },
            flexShrink: 0,
          }}
        >
          <Box sx={{ paddingX: '10px' }}>
            <Typography
              sx={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              Support
            </Typography>
          </Box>
          <Box sx={{ padding: '10px' }}>
            <Link
              to="/about"
              style={{
                textDecoration: 'none',
                color: '#ffffff',
              }}
            >
              <Typography
                sx={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.95rem',
                  fontWeight: 400,
                  color: '#ffffff',
                  lineHeight: 1.6,
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                About Us
              </Typography>
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Home;