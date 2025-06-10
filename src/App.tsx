import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const content = searchParams.get('content') || '';
  const type = (searchParams.get('type') || 'url') as 'url' | 'html';
  const backgroundColor = searchParams.get('backgroundColor') || '#ffffff';
  const deviceMode = (searchParams.get('deviceMode') || 'desktop') as 'desktop' | 'mobile';

  return (
    <PreviewPage
      content={content}
      type={type}
      backgroundColor={backgroundColor}
      deviceMode={deviceMode}
    />
  );
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
