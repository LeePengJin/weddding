import { createTheme } from '@mui/material/styles';

// Keep your existing fonts: EB Garamond for body, Questrial for headings
const theme = createTheme({
  typography: {
    fontFamily: 'EB Garamond, serif',
    h1: { fontFamily: 'Questrial, sans-serif' },
    h2: { fontFamily: 'Questrial, sans-serif' },
    h3: { fontFamily: 'Questrial, sans-serif' },
    h4: { fontFamily: 'Questrial, sans-serif' },
    h5: { fontFamily: 'Questrial, sans-serif' },
    h6: { fontFamily: 'Questrial, sans-serif' },
  },
  palette: {
    mode: 'light',
    background: { default: '#fbfafe' },
    primary: { main: '#e06789' },
    secondary: { main: '#6a5b60' },
    text: { primary: '#000000' },
  },
  shape: { borderRadius: 12 },
});

export default theme;


