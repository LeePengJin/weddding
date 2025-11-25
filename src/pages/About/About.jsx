import React from 'react';
import { Box, Typography, Grid, Container, Divider, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { FavoriteBorder as HeartIcon, DesignServices as DesignIcon, People as PeopleIcon, SentimentSatisfiedAlt as HappyIcon } from '@mui/icons-material';
import Footer from '../../components/Footer/Footer';

const stats = [
  { label: 'Couples Helped', value: '1,000+' },
  { label: 'Verified Vendors', value: '500+' },
  { label: 'Weddings Planned', value: '850+' },
];

const teamMembers = [
  {
    name: 'Sarah Tan',
    role: 'Founder & CEO',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    bio: 'Former wedding planner with a vision to simplify the chaos of wedding planning.',
  },
  {
    name: 'James Lee',
    role: 'Head of Product',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    bio: 'Tech enthusiast ensuring our 3D tools are as intuitive as they are powerful.',
  },
  {
    name: 'Elena Gomez',
    role: 'Creative Director',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    bio: 'Passionate about bringing elegant, timeless design to every digital interaction.',
  },
];

const values = [
  {
    icon: <HeartIcon sx={{ fontSize: 40, color: '#f43f5e' }} />,
    title: 'Passion for Love',
    description: 'We believe every love story deserves a perfect celebration. Our tools are built with care to honor that journey.',
  },
  {
    icon: <DesignIcon sx={{ fontSize: 40, color: '#f43f5e' }} />,
    title: 'Innovative Design',
    description: 'From 3D venue visualization to intuitive checklists, we push boundaries to make planning visual and easy.',
  },
  {
    icon: <PeopleIcon sx={{ fontSize: 40, color: '#f43f5e' }} />,
    title: 'Community First',
    description: 'We bridge the gap between couples and vendors, fostering transparent and trustworthy connections.',
  },
];

export default function About() {
  return (
    <Box sx={{ bgcolor: '#FAFAFA', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1 }}>
        {/* Hero Section */}
        <Box
          sx={{
            position: 'relative',
            height: { xs: '60vh', md: '70vh' },
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <Box
            component="img"
            src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
            alt="Wedding planning"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.6)',
            }}
          />
          <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Typography
                variant="overline"
                sx={{
                  color: '#fcd6e5',
                  letterSpacing: '0.2em',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  mb: 2,
                  display: 'block',
                }}
              >
                OUR STORY
              </Typography>
              <Typography
                variant="h1"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: { xs: '2.5rem', md: '4.5rem' },
                  mb: 3,
                  fontWeight: 500,
                }}
              >
                Reimagining Weddings
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 300,
                  maxWidth: '600px',
                  mx: 'auto',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                We are on a mission to make wedding planning as joyful and beautiful as the day itself.
              </Typography>
            </motion.div>
          </Container>
        </Box>

        {/* Mission Statement */}
        <Container maxWidth="lg" sx={{ mt: -8, position: 'relative', zIndex: 2, mb: 12 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 8 },
              borderRadius: 2,
              bgcolor: '#fff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                variant="h3"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  mb: 3,
                  color: '#1f1c1a',
                }}
              >
                Why We Started
              </Typography>
              <Typography
                sx={{
                  fontFamily: "'Inter', sans-serif",
                  color: '#555',
                  lineHeight: 1.8,
                  fontSize: '1.05rem',
                  maxWidth: '800px',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                Weddding was born from a simple observation: planning the happiest day of your life is often the most stressful. The disconnect between vision and execution, couples and vendors, dreams and budgets needed a bridge.
              </Typography>
              <Typography
                sx={{
                  fontFamily: "'Inter', sans-serif",
                  color: '#555',
                  lineHeight: 1.8,
                  fontSize: '1.05rem',
                  maxWidth: '800px',
                  mx: 'auto',
                }}
              >
                We combined cutting-edge 3D technology with a curated marketplace to create a seamless ecosystem. Now, you can visualize your venue, manage your budget, and book trusted professionals all in one place.
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 3,
              }}
            >
              {stats.map((stat, index) => (
                <Box
                  key={index}
                  sx={{
                    bgcolor: '#fff1f2',
                    p: 4,
                    borderRadius: 2,
                    textAlign: 'center',
                    transition: 'transform 0.3s',
                    '&:hover': { transform: 'translateY(-5px)' },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: 160,
                    flex: { xs: '1 1 100%', sm: '1 1 30%' },
                    maxWidth: { sm: '300px' },
                  }}
                >
                  <Typography
                    variant="h3"
                    sx={{
                      fontFamily: "'Playfair Display', serif",
                      color: '#f43f5e',
                      fontWeight: 700,
                      mb: 1,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontFamily: "'Inter', sans-serif",
                      color: '#881337',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                    }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Container>

        {/* Values Section */}
        <Box sx={{ py: 12, bgcolor: '#fff' }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography
                variant="overline"
                sx={{ color: '#f43f5e', letterSpacing: '0.2em', fontWeight: 600, mb: 1, display: 'block' }}
              >
                OUR VALUES
              </Typography>
              <Typography variant="h3" sx={{ fontFamily: "'Playfair Display', serif" }}>
                What Drives Us
              </Typography>
            </Box>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {values.map((value, index) => (
              <Box
                key={index}
                sx={{
                  textAlign: 'center',
                  p: 4,
                  height: '100%',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-8px)' },
                  width: { xs: '100%', sm: 'calc(50% - 48px)', md: 'calc(33.333% - 48px)' },
                  maxWidth: '400px',
                }}
              >
                <Box sx={{ mb: 3, display: 'inline-block', p: 2, borderRadius: '50%', bgcolor: '#fff1f2' }}>
                  {value.icon}
                </Box>
                <Typography variant="h5" sx={{ fontFamily: "'Playfair Display', serif", mb: 2 }}>
                  {value.title}
                </Typography>
                <Typography sx={{ color: '#666', lineHeight: 1.7 }}>
                  {value.description}
                </Typography>
              </Box>
            ))}
          </Box>
          </Container>
        </Box>

        {/* Team Section */}
        <Container maxWidth="lg" sx={{ py: 12 }}>
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <Typography variant="h3" sx={{ fontFamily: "'Playfair Display', serif", mb: 2 }}>
              Meet the Team
            </Typography>
            <Typography sx={{ color: '#666', maxWidth: '600px', mx: 'auto' }}>
              The creative minds and technical wizards working behind the scenes to make your wedding planning effortless.
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {teamMembers.map((member, index) => (
              <Box
                key={index}
                sx={{
                  width: { xs: '100%', sm: 'calc(50% - 32px)', md: 'calc(33.333% - 32px)' },
                  maxWidth: '400px',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    height: 400,
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    '&:hover .content-overlay': {
                      opacity: 1,
                    },
                    '&:hover .initial-label': {
                      opacity: 0,
                    },
                    '&:hover .member-image': {
                      filter: 'blur(4px) brightness(0.7)',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <Box
                    className="member-image"
                    component="img"
                    src={member.image}
                    alt={member.name}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'all 0.4s ease',
                    }}
                  />
                  {/* Default Label (Name & Role) */}
                  <Box
                    className="initial-label"
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      p: 3,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                      color: '#fff',
                      transition: 'opacity 0.3s',
                    }}
                  >
                    <Typography variant="h5" sx={{ fontFamily: "'Playfair Display', serif", mb: 0.5 }}>
                      {member.name}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: '#f43f5e', fontWeight: 600, letterSpacing: '0.05em' }}>
                      {member.role}
                    </Typography>
                  </Box>

                  {/* Hover Overlay with Bio */}
                  <Box
                    className="content-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      bgcolor: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      p: 4,
                      textAlign: 'center',
                      opacity: 0,
                      transition: 'opacity 0.4s ease',
                      color: '#fff',
                    }}
                  >
                    <Typography variant="h5" sx={{ fontFamily: "'Playfair Display', serif", mb: 1 }}>
                      {member.name}
                    </Typography>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: '#f43f5e', fontWeight: 600, letterSpacing: '0.05em', mb: 3 }}
                    >
                      {member.role}
                    </Typography>
                    <Typography sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{member.bio}"
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
      <Footer />
    </Box>
  );
}
