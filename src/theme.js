import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    h1: { fontFamily: "'Playfair Display', 'Times New Roman', serif", fontWeight: 700 },
    h2: { fontFamily: "'Playfair Display', 'Times New Roman', serif", fontWeight: 700 },
    h3: { fontFamily: "'Playfair Display', 'Times New Roman', serif", fontWeight: 700 },
    h4: { fontFamily: "'Playfair Display', 'Times New Roman', serif", fontWeight: 700 },
    h5: { fontFamily: "'Playfair Display', 'Times New Roman', serif", fontWeight: 600 },
    h6: { fontFamily: "'Playfair Display', 'Times New Roman', serif", fontWeight: 600 },
    button: {
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
      textTransform: 'none',
      fontWeight: 600,
    },
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


