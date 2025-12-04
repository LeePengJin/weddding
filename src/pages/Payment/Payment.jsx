import React, { useState, useEffect, useCallback } from 'react';
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
  const cancellationReasonParam = searchParams.get('reason') || '';
  const cancellationReason = cancellationReasonParam.trim();
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
  const [cancellationPreview, setCancellationPreview] = useState(null);
  const [loadingCancellationPreview, setLoadingCancellationPreview] = useState(false);

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

  const fetchCancellationPreview = useCallback(async () => {
    if (!bookingId || paymentType !== 'cancellation_fee') {
      setCancellationPreview(null);
      setLoadingCancellationPreview(false);
      return;
    }
    try {
      setLoadingCancellationPreview(true);
      const preview = await apiFetch(`/bookings/${bookingId}/cancellation-fee`);
      setCancellationPreview(preview);
    } catch (err) {
      setError(err.message || 'Failed to load cancellation fee details');
    } finally {
      setLoadingCancellationPreview(false);
    }
  }, [bookingId, paymentType]);

  useEffect(() => {
    fetchCancellationPreview();
  }, [fetchCancellationPreview]);

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
    } else if (paymentType === 'final') {
      amountToPay = remaining;
      lineItems = [{
        id: 'final',
        name: 'Final Payment',
        description: `Remaining balance for ${services.map(s => s.name).join(', ')} with ${vendorName}`,
        price: amountToPay
      }];
    } else if (paymentType === 'cancellation_fee') {
      const feeDifference = Math.max(0, cancellationPreview?.feeDifference || 0);
      amountToPay = feeDifference;
      const reasonSnippet = cancellationReason
        ? `Reason provided: "${cancellationReason}".`
        : 'Reason provided during cancellation.';
      lineItems = [{
        id: 'cancellation_fee',
        name: 'Cancellation Fee',
        description: cancellationPreview
          ? `Cancellation fee for ${services.map((s) => s.name).join(', ')} with ${vendorName}. ${reasonSnippet}`
          : 'Calculating cancellation fee...',
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
      const errors = {};
      const cardNumber = (formData.cardNumber || '').replace(/\s+/g, '');
      const expiry = (formData.expiry || '').trim();
      const cvc = (formData.cvc || '').trim();
      const name = (formData.name || '').trim();

      if (!cardNumber) {
        errors.cardNumber = 'Required';
      } else if (!/^\d{13,19}$/.test(cardNumber)) {
        errors.cardNumber = 'Card number must be 13-19 digits';
      }

      const luhnCheck = (num) => {
        let sum = 0;
        let shouldDouble = false;
        for (let i = num.length - 1; i >= 0; i--) {
          let digit = parseInt(num.charAt(i), 10);
          if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
          }
          sum += digit;
          shouldDouble = !shouldDouble;
        }
        return sum % 10 === 0;
      };

      if (!errors.cardNumber && !luhnCheck(cardNumber)) {
        errors.cardNumber = 'Invalid card number';
      }

      if (!expiry) {
        errors.expiry = 'Required';
      } else if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        errors.expiry = 'Use MM/YY format';
      } else {
        const [mm, yy] = expiry.split('/').map((s) => parseInt(s, 10));
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        if (mm < 1 || mm > 12) {
          errors.expiry = 'Invalid month';
        } else if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
          errors.expiry = 'Card has expired';
        }
      }

      if (!cvc) {
        errors.cvc = 'Required';
      } else if (!/^\d{3,4}$/.test(cvc)) {
        errors.cvc = 'CVC must be 3-4 digits';
      }

      if (!name) {
        errors.name = 'Required';
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    } else {
      const phone = (formData.phoneNumber || '').trim();
      const errors = {};
      if (!phone) {
        errors.phoneNumber = 'Required';
      } else if (!/^1\d{8,9}$/.test(phone)) {
        // User enters only the local mobile part (e.g. 123456789), prefix +60 is rendered separately
        errors.phoneNumber = 'Enter a valid Malaysian mobile number (e.g. 123456789 or 1234567890)';
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    }

    setIsProcessing(true);
    setError(null); // Clear previous errors
    
    try {
      const orderDetails = calculateAmounts();
      const payableTotal =
        paymentType === 'cancellation_fee' && cancellationPreview
          ? cancellationPreview.feeDifference
          : orderDetails.total;
      
      // Ensure amount is a valid number
      const amount = parseFloat(payableTotal.toFixed(2));
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      if (paymentType === 'cancellation_fee') {
        if (loadingCancellationPreview || !cancellationPreview) {
          throw new Error('Cancellation fee details are still loading. Please try again in a moment.');
        }
        if (!cancellationPreview.requiresPayment || cancellationPreview.feeDifference <= 0) {
          throw new Error('No cancellation fee is due for this booking.');
        }
        if (!cancellationReason) {
          throw new Error('Cancellation reason is missing. Please restart the cancellation process from the My Bookings page.');
        }
      } else {
        // Validate booking status matches payment type
        if (paymentType === 'deposit' && booking.status !== 'pending_deposit_payment') {
          throw new Error(`Cannot pay deposit. Booking status is: ${booking.status}. Please contact support if you believe this is an error.`);
        }
        
        if (paymentType === 'final' && booking.status !== 'pending_final_payment') {
          throw new Error(`Cannot pay final payment. Booking status is: ${booking.status}. Please contact support if you believe this is an error.`);
        }
      }
      
      let paymentResponse;
      if (paymentType === 'cancellation_fee') {
        paymentResponse = await apiFetch(`/bookings/${bookingId}/cancellation-fee-payment`, {
          method: 'POST',
          body: JSON.stringify({
            amount,
            paymentMethod: paymentMethod === 'card' ? 'credit_card' : 'touch_n_go',
            receipt: null,
            reason: cancellationReason,
          }),
        });
      } else {
        paymentResponse = await apiFetch(`/bookings/${bookingId}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            paymentType,
            amount,
            paymentMethod: paymentMethod === 'card' ? 'credit_card' : 'touch_n_go',
            receipt: null,
          }),
        });
      }

      // Store payment data for receipt
      setPayment(paymentResponse);
      // Optionally refresh booking data in the background (no full-page loading flash)
      fetchBooking().catch(() => {});

      setIsProcessing(false);
      setIsSuccess(true);
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

  if (loading || (paymentType === 'cancellation_fee' && loadingCancellationPreview)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }
  if (!booking) return <Alert severity="error">Booking not found</Alert>;

  const orderDetails = calculateAmounts();
  const cancellationPaymentDisabled =
    paymentType === 'cancellation_fee' &&
    (loadingCancellationPreview ||
      !cancellationPreview ||
      !cancellationPreview.requiresPayment ||
      cancellationPreview.feeDifference <= 0);

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
            <Typography variant="h4" color="primary.main" gutterBottom>
              {paymentType === 'cancellation_fee' ? 'Cancellation Fee Paid' : 'Payment Successful!'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              {paymentType === 'cancellation_fee'
                ? 'Your cancellation fee has been recorded. We will notify the vendor immediately.'
                : 'Thank you for your payment. A receipt has been sent to your email.'}
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
            onClick={() => {
              if (isSuccess) {
                navigate('/my-bookings');
              } else {
                navigate(-1);
              }
            }} 
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

                {paymentType === 'cancellation_fee' && (
                  <Alert
                    severity={cancellationPaymentDisabled ? 'info' : 'warning'}
                    sx={{ mb: 3 }}
                  >
                    {loadingCancellationPreview
                      ? 'Calculating cancellation fee...'
                      : !cancellationPreview
                      ? 'Cancellation fee details are unavailable. Please return to My Bookings and try again.'
                      : !cancellationPreview.requiresPayment || cancellationPreview.feeDifference <= 0
                      ? 'This booking no longer requires a cancellation fee. Close this page and refresh your bookings.'
                      : cancellationReason
                      ? 'Please review the amount below and complete the payment to finalize your cancellation.'
                      : 'Cancellation reason missing. Please restart the cancellation flow from My Bookings.'}
                  </Alert>
                )}

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  color="primary"
                  onClick={handlePay}
                  disabled={isProcessing || cancellationPaymentDisabled}
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
                    <Typography sx={{ textAlign: 'justify' }}>
                      By processing a payment on our platform, you agree to the following terms regarding your wedding service booking.
                    </Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>1. Payment Processing</Typography>
                    <Typography sx={{ textAlign: 'justify' }}>
                      All transactions are processed securely through our platform. Once a payment is made, any refunds or
                      adjustments are handled according to the vendor&apos;s cancellation policy and the booking&apos;s
                      cancellation rules shown in your booking details. Our platform facilitates payments between couples
                      and vendors and does not guarantee refunds beyond these policies.
                    </Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>2. Vendor Responsibility</Typography>
                    <Typography sx={{ textAlign: 'justify' }}>
                      Weddding acts as an intermediary platform that connects couples with independent vendors. Each vendor
                      is solely responsible for the delivery and quality of their services. Service disputes (e.g. late
                      arrival, quality of work, or changes to scope) should be resolved directly with the vendor.
                    </Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>3. Misuse &amp; Illegal Activity</Typography>
                    <Typography sx={{ textAlign: 'justify' }}>
                      We reserve the right to investigate and take appropriate action (including suspending accounts,
                      freezing payments, or cancelling bookings) if we detect fraud, abuse of the payment system,
                      money laundering, or any activity that violates applicable laws or our platform policies.
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography sx={{ textAlign: 'justify' }}>
                      Your privacy is paramount. This policy outlines how we handle your personal and financial information.
                    </Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>1. Information Collection</Typography>
                    <Typography sx={{ textAlign: 'justify' }}>
                      We collect only the necessary information required to process your payment and validate your booking:
                      Name, Contact Number, and Payment Credentials (tokenized).
                    </Typography>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mt: 1 }}>2. Data Security</Typography>
                    <Typography sx={{ textAlign: 'justify' }}>
                      We use industry-standard encryption to protect your data in transit and at rest. We do not store full
                      credit card numbers.
                    </Typography>
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