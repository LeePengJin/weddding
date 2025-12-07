import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  InputAdornment,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Search as SearchIcon, HelpOutline as HelpIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { PetalCursor } from '../../components/PetalCursor/PetalCursor';
import Footer from '../../components/Footer/Footer';

const faqData = {
  general: [
    {
      question: 'What is Weddding?',
      answer: 'Weddding is an all-in-one platform that helps couples plan their wedding with ease. We provide tools for budget management, checklists, vendor booking, and a unique 3D venue designer to visualize your big day.',
    },
    {
      question: 'Is Weddding free to use?',
      answer: 'Weddding is free to use! There are no costs to access our platform, including our 3D venue designer and planning tools.',
    },
    {
      question: 'Can I use Weddding on mobile?',
      answer: 'Yes! Our platform is fully responsive and optimized for mobile devices, so you can plan on the go.',
    },
  ],
  vendors: [
    {
      question: 'Are there fees for vendors?',
      answer: 'Vendors pay a small commission fee on bookings made through the platform. Listing your services is free.',
    },
    {
      question: 'How do I get paid?',
      answer: 'Payments from couples are held securely and released to you upon completion of milestones or the event itself, directly to your linked bank account.',
    },
  ],
  payments: [
    {
      question: 'Is my payment information secure?',
      answer: 'Absolutely. We use industry-standard encryption and trusted payment gateways to ensure your financial data is always protected.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept major credit cards (Visa, Mastercard), online banking (FPX), and e-wallets like Touch n Go.',
    },
  ],
};

export default function FAQ() {
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setExpanded(false);
  };

  // Filter FAQs based on search query and active tab
  const getFilteredFAQs = () => {
    let questions = faqData[activeTab] || [];
    if (searchQuery) {
      // If searching, look through all categories
      const allQuestions = Object.values(faqData).flat();
      return allQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return questions;
  };

  const displayedFAQs = getFilteredFAQs();

  return (
    <Box sx={{ bgcolor: '#FAFAFA', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PetalCursor />
      <Box sx={{ flex: 1 }}>
        {/* Header Section */}
        <Box
          sx={{
            bgcolor: '#1f1c1a',
            color: '#fff',
            pt: 12,
            pb: 10,
            textAlign: 'center',
            px: 2,
          }}
        >
          <Container maxWidth="md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <HelpIcon sx={{ fontSize: 50, color: '#f43f5e', mb: 2, opacity: 0.9 }} />
              <Typography
                variant="h2"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                How can we help?
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 300,
                  color: 'rgba(255,255,255,0.7)',
                  mb: 6,
                }}
              >
                Find answers to common questions about planning, vendors, and payments.
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  p: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  maxWidth: 600,
                  mx: 'auto',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.1)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s',
                  '&:focus-within': {
                    bgcolor: '#fff',
                    transform: 'scale(1.02)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    '& input': { color: '#333' },
                    '& .MuiSvgIcon-root': { color: '#666' },
                  },
                }}
              >
                <InputAdornment position="start" sx={{ pl: 2 }}>
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
                </InputAdornment>
                <TextField
                  fullWidth
                  placeholder="Search for answers..."
                  variant="standard"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      px: 2,
                      py: 1.5,
                      color: '#fff',
                      fontFamily: "'Inter', sans-serif",
                    },
                  }}
                />
              </Paper>
            </motion.div>
          </Container>
        </Box>

        <Container maxWidth="md" sx={{ mt: 8 }}>
          {!searchQuery && (
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              centered
              sx={{
                mb: 6,
                '& .MuiTab-root': {
                  fontFamily: "'Inter', sans-serif",
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#666',
                  '&.Mui-selected': { color: '#f43f5e' },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#f43f5e',
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                },
              }}
            >
              <Tab label="General" value="general" />
              <Tab label="For Vendors" value="vendors" />
              <Tab label="Payments" value="payments" />
            </Tabs>
          )}

          <Box sx={{ minHeight: 400 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + searchQuery}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {displayedFAQs.length > 0 ? (
                  displayedFAQs.map((faq, index) => (
                    <Accordion
                      key={index}
                      expanded={expanded === `panel${index}`}
                      onChange={handleChange(`panel${index}`)}
                      disableGutters
                      elevation={0}
                      sx={{
                        mb: 2,
                        border: '1px solid #eee',
                        borderRadius: '12px !important',
                        '&:before': { display: 'none' },
                        overflow: 'hidden',
                        transition: 'all 0.3s',
                        '&.Mui-expanded': {
                          boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                          borderColor: 'transparent',
                        },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: '#f43f5e' }} />}
                        sx={{
                          px: 3,
                          py: 1,
                          '& .MuiTypography-root': {
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                            color: '#333',
                          },
                        }}
                      >
                        <Typography>{faq.question}</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                        <Typography
                          sx={{
                            fontFamily: "'Inter', sans-serif",
                            color: '#666',
                            lineHeight: 1.7,
                          }}
                        >
                          {faq.answer}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))
                ) : (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography sx={{ color: '#666', fontFamily: "'Inter', sans-serif" }}>
                      No matching results found. Try a different keyword.
                    </Typography>
                  </Box>
                )}
              </motion.div>
            </AnimatePresence>
          </Box>
        </Container>

        {/* Contact CTA */}
        <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center', pb: 12 }}>
          <Paper sx={{ p: 4, borderRadius: 4, bgcolor: '#fff', border: '1px solid #eee' }} elevation={0}>
            <Typography variant="h6" sx={{ fontFamily: "'Playfair Display', serif", mb: 1 }}>
              Still have questions?
            </Typography>
            <Typography sx={{ color: '#666', mb: 3, fontSize: '0.95rem' }}>
              Can't find the answer you're looking for? Send us an email and we'll get back to you.
            </Typography>
            <Typography
              component="a"
              href="mailto:support@weddding.com"
              sx={{
                display: 'inline-block',
                color: '#f43f5e',
                textDecoration: 'none',
                fontWeight: 600,
                borderBottom: '2px solid #f43f5e',
                pb: 0.5,
                transition: 'all 0.2s',
                '&:hover': { color: '#be123c', borderColor: '#be123c' },
              }}
            >
              Email Support
            </Typography>
          </Paper>
        </Container>
      </Box>
      <Footer />
    </Box>
  );
}
