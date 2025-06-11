import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScreenRecorder from './components/ScreenRecorder';
import PreviewPage from './components/PreviewPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

const Preview = () => {
  return <PreviewPage />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ScreenRecorder />} />
          <Route path="/preview" element={<Preview />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
