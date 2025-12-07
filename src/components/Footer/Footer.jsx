import React from 'react';
import { Box, Grid, Typography, Link as MuiLink, Divider, Stack } from '@mui/material';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { Link as RouterLink } from 'react-router-dom';

const planningLinks = [
  { label: 'Budget Tracker', to: '/features#budget-tracker' },
  { label: 'Checklist', to: '/features#checklist' },
  { label: '3D Venue Designer', to: '/features#3d-venue-designer' },
];

const supportLinks = [
  { label: 'About Us', to: '/about' },
  { label: 'FAQ', to: '/faq' },
];

const linkStyles = {
  display: 'inline-flex',
  color: 'rgba(255,255,255,0.82)',
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.95rem',
  textDecoration: 'none',
  letterSpacing: '0.01em',
  transition: 'color 0.2s ease, transform 0.2s ease',
  '&:hover': { color: '#f9a8d4', transform: 'translateX(4px)' },
};

export default function Footer({ sx }) {
  return (
    <Box
      component="footer"
      sx={{
        background: 'linear-gradient(135deg, #181614 0%, #221f1b 40%, #2f1f24 100%)',
        color: '#fff',
        mt: 10,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        width: '100%',
        ...sx,
      }}
    >
      <Box sx={{ px: { xs: 3, lg: 8 }, py: { xs: 6, md: 8 }, width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: { xs: 4, lg: 6 },
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ flexBasis: { xs: '100%', lg: '35%' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <FavoriteBorderIcon sx={{ color: '#f9a8d4', fontSize: 28 }} />
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Weddding
              </Typography>
            </Box>
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255,255,255,0.82)',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.9,
                maxWidth: 420,
                mb: 3,
              }}
            >
              A modern planning concierge bridging couples, creative vendors, and immersive 3D tools
              into a single, artfully curated platform.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
              support@weddding.com · Kuala Lumpur, MY
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              justifyContent: { xs: 'flex-start', lg: 'space-between' },
              gap: { xs: 3, sm: 4, md: 6 },
            }}
          >
            {[
              { title: 'Planning Tools', links: planningLinks },
              { title: 'Support', links: supportLinks },
            ].map((section) => (
              <Box
                key={section.title}
                sx={{
                  minWidth: { xs: '100%', sm: '45%', lg: '200px' },
                  flex: { xs: '1 1 100%', sm: '1 1 45%', lg: '1 1 auto' },
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    color: '#fbcfe8',
                    mb: 2,
                    fontWeight: 500,
                  }}
                >
                  {section.title}
                </Typography>
                <Stack spacing={1.2}>
                  {section.links.map((link) => (
                    <MuiLink key={link.to} component={RouterLink} to={link.to} sx={linkStyles}>
                      {link.label}
                    </MuiLink>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', my: 6 }} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            © {new Date().getFullYear()} Weddding Platform · Crafted with love in Malaysia
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Need help? Email support@weddding.com
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

