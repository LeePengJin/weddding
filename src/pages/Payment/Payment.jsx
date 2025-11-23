import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert, Container, Modal, Fade, Paper, IconButton, ThemeProvider, createTheme, Link } from '@mui/material';
import { CheckCircle, Close, Description, Security, Download, ArrowBack } from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import PaymentMethodSelector from './components/PaymentMethodSelector';
import CardForm from './components/CardForm';
import TngForm from './components/TngForm';
import OrderSummary from './components/OrderSummary';
import PaymentReceipt from './components/PaymentReceipt';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2C3E50', // Deep charcoal
      light: '#34495E',
      dark: '#1A252F',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#D4AF37', // Champagne gold
      light: '#F3E5AB',
      dark: '#AA8C2C',
      contrastText: '#000000',
    },
    background: {
      default: '#F9F9F9', // Very light grey/off-white
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2C3E50',
      secondary: '#7F8C8D',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h3: {
      fontFamily: '"Playfair Display", "Times New Roman", serif',
      fontWeight: 700,
    },
    h4: {
      fontFamily: '"Playfair Display", "Times New Roman", serif',
      fontWeight: 700,
    },
    h5: {
      fontFamily: '"Playfair Display", "Times New Roman", serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Playfair Display", "Times New Roman", serif',
      fontWeight: 600,
    },
    button: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});

const Payment = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const paymentType = searchParams.get('type') || 'deposit';
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [payment, setPayment] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/bookings/${bookingId}`);
      setBooking(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch booking');
    } finally {
      setLoading(false);
    }
  };

  const calculateAmounts = () => {
    if (!booking) return { subtotal: 0, tax: 0, total: 0, vendorName: '', services: [] };
    
    const totalAmount = booking.selectedServices.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);
    const paid = (booking.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const remaining = Math.max(0, totalAmount - paid);
    
    const vendorName = booking.vendor?.user?.name || booking.vendor?.businessName || 'Vendor';
    const services = booking.selectedServices.map(s => ({
      id: s.id,
      name: s.serviceListing?.name || 'Service',
      description: s.serviceListing?.description || '',
    }));
    
    let amountToPay = 0;
    let lineItems = [];

    if (paymentType === 'deposit') {
      amountToPay = totalAmount * 0.3; // 30% deposit
      lineItems = [{
        id: 'deposit',
        name: 'Booking Deposit (30%)',
        description: `Deposit for ${services.map(s => s.name).join(', ')} with ${vendorName}`,
        price: amountToPay
      }];
    } else {
      amountToPay = remaining;
      lineItems = [{
        id: 'final',
        name: 'Final Payment',
        description: `Remaining balance for ${services.map(s => s.name).join(', ')} with ${vendorName}`,
        price: amountToPay
      }];
    }

    return {
      id: booking.id,
      items: lineItems,
      subtotal: amountToPay / 1.06,
      tax: amountToPay - (amountToPay / 1.06),
      total: amountToPay,
      vendorName,
      services,
      totalAmount,
      paid,
      remaining
    };
  };

  const handlePay = async () => {
    setFormErrors({});
    if (paymentMethod === 'card') {
      if (!formData.cardNumber || !formData.expiry || !formData.cvc || !formData.name) {
        setFormErrors({
          cardNumber: !formData.cardNumber ? 'Required' : '',
          expiry: !formData.expiry ? 'Required' : '',
          cvc: !formData.cvc ? 'Required' : '',
          name: !formData.name ? 'Required' : '',
        });
        return;
      }
    } else {
      if (!formData.phoneNumber) {
        setFormErrors({ phoneNumber: 'Required' });
        return;
      }
    }

    setIsProcessing(true);
    setError(null); // Clear previous errors
    
    try {
      const orderDetails = calculateAmounts();
      
      // Ensure amount is a valid number
      const amount = parseFloat(orderDetails.total.toFixed(2));
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Validate booking status matches payment type
      if (paymentType === 'deposit' && booking.status !== 'pending_deposit_payment') {
        throw new Error(`Cannot pay deposit. Booking status is: ${booking.status}. Please contact support if you believe this is an error.`);
      }
      
      if (paymentType === 'final' && booking.status !== 'pending_final_payment') {
        throw new Error(`Cannot pay final payment. Booking status is: ${booking.status}. Please contact support if you believe this is an error.`);
      }
      
      const paymentResponse = await apiFetch(`/bookings/${bookingId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          paymentType,
          amount: amount,
          paymentMethod: paymentMethod === 'card' ? 'credit_card' : 'touch_n_go',
          receipt: null,
        }),
      });

      // Store payment data for receipt
      setPayment(paymentResponse);
      
      // Refresh booking to get updated data
      await fetchBooking();

      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
      }, 2000);
    } catch (err) {
      console.error('Payment error:', err);
      console.error('Error body:', err.body);
      // Extract more detailed error message
      let errorMessage = 'Payment failed. Please try again.';
      if (err.message && err.message !== 'Request failed') {
        errorMessage = err.message;
      } else if (err.body) {
        if (typeof err.body === 'string') {
          errorMessage = err.body;
        } else if (err.body.error) {
          errorMessage = err.body.error;
        } else if (err.body.message) {
          errorMessage = err.body.message;
        }
      } else if (err.error) {
        errorMessage = typeof err.error === 'string' ? err.error : err.error.message || errorMessage;
      }
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;
  if (!booking) return <Alert severity="error">Booking not found</Alert>;

  const orderDetails = calculateAmounts();

  if (isSuccess) {
    const orderDetails = calculateAmounts();
    return (
      <ThemeProvider theme={theme}>
        {/* Printable Receipt - Hidden except when printing */}
        <PaymentReceipt 
          payment={payment} 
          booking={booking} 
          orderDetails={orderDetails}
          paymentMethod={paymentMethod}
        />
        
        {/* Success Screen - Hidden when printing */}
        <Box 
          sx={{ 
            minHeight: '100vh', 
            bgcolor: 'background.default', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            p: 4,
            '@media print': {
              display: 'none',
            },
          }}
        >
          <Paper elevation={3} sx={{ p: 6, maxWidth: 480, width: '100%', borderRadius: 4, textAlign: 'center', animation: 'fadeInUp 0.6s ease-out' }}>
            <Box sx={{ 
              width: 64, 
              height: 64, 
              bgcolor: 'success.main', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              mx: 'auto', 
              mb: 3,
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
            }}>
              <CheckCircle sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography variant="h4" color="primary.main" gutterBottom>Payment Successful!</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Thank you for your payment. A receipt has been sent to your email.
            </Typography>
            
            <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, p: 3, mb: 4, textAlign: 'left' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Transaction ID</Typography>
                <Typography variant="caption" fontFamily="monospace" color="primary.main">
                  {payment?.id ? payment.id.substring(0, 8).toUpperCase() : 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="caption" fontWeight="medium">
                  {payment?.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Method</Typography>
                <Typography variant="caption" fontWeight="medium">
                  {paymentMethod === 'card' ? 'Credit Card' : "Touch 'n Go"}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed', borderColor: 'divider', pt: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold">Total Paid</Typography>
                <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
                  RM {payment?.amount ? parseFloat(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : orderDetails.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button 
                variant="outlined" 
                startIcon={<Download />}
                onClick={() => window.print()}
                fullWidth
                sx={{ borderRadius: 3, py: 1.5 }}
              >
                Print Receipt
              </Button>
              <Button 
                variant="contained" 
                onClick={() => navigate('/my-bookings')}
                fullWidth
                sx={{ borderRadius: 3, py: 1.5, bgcolor: 'primary.dark', '&:hover': { bgcolor: 'primary.main' } }}
              >
                Return to Dashboard
              </Button>
            </Box>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 6, lg: 8 }, px: 3 }}>
        <Container maxWidth="xl">
          <Button 
            startIcon={<ArrowBack />} 
            onClick={() => navigate(-1)} 
            sx={{ mb: 2, color: 'text.secondary', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}
          >
            Back
          </Button>
          
          <Box sx={{ mb: 2, textAlign: { xs: 'center', lg: 'left' } }}>
            <Typography variant="h3" color="primary.main" gutterBottom>Secure Checkout</Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 600 }}>
              Complete your booking securely. Your details are protected with bank-grade encryption.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 6 }}>
            {/* Left Column */}
            <Box sx={{ flex: 1, order: { xs: 2, lg: 1 } }}>
              <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" color="primary.main" mb={4}>Payment Details</Typography>
                
                <PaymentMethodSelector selected={paymentMethod} onSelect={setPaymentMethod} />

                <Box sx={{ mb: 4, mt: 3 }}>
                  {paymentMethod === 'card' ? (
                    <CardForm onChange={setFormData} errors={formErrors} />
                  ) : (
                    <TngForm onChange={setFormData} errors={formErrors} />
                  )}
                </Box>

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  color="primary"
                  onClick={handlePay}
                  disabled={isProcessing}
                  sx={{
                    py: 2,
                    fontSize: '1rem',
                    letterSpacing: '0.5px',
                  }}
                >
                  {isProcessing ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CircularProgress size={20} color="inherit" />
                      Processing...
                    </Box>
                  ) : (
                    `Pay RM ${orderDetails.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </Button>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                  <Security sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled">
                    Secure encrypted payment
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.disabled" display="block" textAlign="center" sx={{ mt: 1 }}>
                  By paying, you agree to our{' '}
                  <Link component="button" variant="caption" onClick={() => setActiveModal('tos')} sx={{ color: 'text.secondary', textDecoration: 'underline', cursor: 'pointer' }}>Terms</Link>
                  {' '}and{' '}
                  <Link component="button" variant="caption" onClick={() => setActiveModal('privacy')} sx={{ color: 'text.secondary', textDecoration: 'underline', cursor: 'pointer' }}>Privacy</Link>.
                </Typography>
              </Paper>
            </Box>

            {/* Right Column */}
            <Box sx={{ width: { xs: '100%', lg: 480 }, order: { xs: 1, lg: 2 } }}>
              <OrderSummary order={orderDetails} />
            </Box>
          </Box>
        </Container>

        {/* Modals */}
        <Modal open={!!activeModal} onClose={() => setActiveModal(null)} closeAfterTransition>
          <Fade in={!!activeModal}>
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '90%', maxWidth: 600, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24, p: 4,
              maxHeight: '80vh', overflowY: 'auto', outline: 'none'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h5" fontFamily="serif" fontWeight="bold" color="primary.dark">
                  {activeModal === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
                </Typography>
                <IconButton onClick={() => setActiveModal(null)}><Close /></IconButton>
              </Box>
              
              <Box sx={{ typography: 'body2', color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', mb: 1 }}>
                  {activeModal === 'tos' ? <Description /> : <Security />}
                  <Typography variant="subtitle1" fontWeight="bold">{activeModal === 'tos' ? 'User Agreement' : 'Data Protection'}</Typography>
                </Box>
                
                {activeModal === 'tos' ? (
                  <>
                    <Typography>Welcome to BlissfulPay. By processing a payment on our platform, you agree to the following terms regarding your wedding service booking.</Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>1. Payment Processing</Typography>
                    <Typography>All transactions are processed securely. Cancellations made within 24 hours of payment are subject to a full refund. Cancellations made after 24 hours may incur a service fee as per the vendor's individual contract.</Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>2. Vendor Liability</Typography>
                    <Typography>BlissfulPay acts as an intermediary platform. Specific service delivery issues should be resolved directly with the vendor (e.g., photographer, venue).</Typography>
                  </>
                ) : (
                  <>
                    <Typography>Your privacy is paramount. This policy outlines how we handle your personal and financial information.</Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>1. Information Collection</Typography>
                    <Typography>We collect only the necessary information required to process your payment and validate your booking: Name, Contact Number, and Payment Credentials (tokenized).</Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>2. Data Security</Typography>
                    <Typography>We use industry-standard encryption to protect your data in transit and at rest. We do not store full credit card numbers.</Typography>
                  </>
                )}
              </Box>

              <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={() => setActiveModal(null)} sx={{ bgcolor: 'primary.main' }}>Close</Button>
              </Box>
            </Box>
          </Fade>
        </Modal>

        <style>
          {`
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
          `}
        </style>
      </Box>
    </ThemeProvider>
  );
};

export default Payment;