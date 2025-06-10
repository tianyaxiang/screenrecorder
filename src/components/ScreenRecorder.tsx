import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Container,
  Typography,
  Stack,
  IconButton,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Tooltip,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Delete,
  Download,
  PhoneAndroid,
  Computer,
  OpenInNew,
  Settings,
  Info,
} from '@mui/icons-material';

interface RecordingState {
  isRecording: boolean;
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  previewUrl: string;
}

interface RecordingSettings {
  frameRate: number;
  videoBitrate: number;
  audioBitrate: number;
  countdown: number;
}

const defaultSettings: RecordingSettings = {
  frameRate: 30,
  videoBitrate: 2500000, // 2.5 Mbps
  audioBitrate: 128000,  // 128 kbps
  countdown: 3,
};

const ScreenRecorder: React.FC = () => {
  const [url, setUrl] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    .content {
      text-align: center;
      color: white;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    p {
      font-size: 1.2rem;
      margin-top: 1rem;
      opacity: 0.9;
    }
    button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      font-size: 1rem;
      border: none;
      border-radius: 4px;
      background: white;
      color: #FE6B8B;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="content">
    <h1>Hello World!</h1>
    <p>This is a custom HTML preview with JavaScript</p>
    <p id="counter">Clicked: 0 times</p>
    <button onclick="incrementCounter()">Click me!</button>
  </div>

  <script>
    let count = 0;
    function incrementCounter() {
      count++;
      document.getElementById('counter').textContent = \`Clicked: \${count} times\`;
      
      // 添加一些动画效果
      const h1 = document.querySelector('h1');
      h1.style.transform = 'scale(1.1)';
      setTimeout(() => {
        h1.style.transform = 'scale(1)';
      }, 200);
    }
  </script>
</body>
</html>
  `.trim());
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [activeTab, setActiveTab] = useState(0);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [error, setError] = useState<string>('');
  const [previewWindow, setPreviewWindow] = useState<Window | null>(null);
  const [settings, setSettings] = useState<RecordingSettings>(defaultSettings);
  const [openSettings, setOpenSettings] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    previewUrl: '',
  });

  useEffect(() => {
    return () => {
      if (previewWindow) {
        previewWindow.close();
      }
    };
  }, []);

  const openPreviewWindow = () => {
    const previewData = {
      content: activeTab === 0 ? url : htmlContent,
      type: activeTab === 0 ? 'url' : 'html',
      backgroundColor,
      deviceMode,
    };

    // 将数据存储在 localStorage 中
    localStorage.setItem('previewData', JSON.stringify(previewData));

    // 只传递一个标识符作为参数
    const params = new URLSearchParams({
      timestamp: Date.now().toString(),
    });

    const previewUrl = `/preview?${params.toString()}`;
    
    // 移动设备模式下使用精确的设备尺寸，并使用应用模式
    //ipone pro max 430*932
    const windowFeatures = deviceMode === 'mobile'
      ? `left=0,top=0,width=430,height=812,menubar=no,toolbar=no,location=no,status=no,titlebar=no,directories=no,fullscreen=yes,scrollbars=no,resizable=no,chrome=yes,centerscreen=yes`
      : 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no';
    
    const newWindow = window.open(previewUrl, 'PreviewWindow', windowFeatures);
    
    if (newWindow) {
      // 设置窗口样式
      newWindow.document.documentElement.style.cssText = `
        margin: 0;
        padding: 0;
        overflow: hidden;
      `;
      newWindow.document.body.style.cssText = `
        margin: 0;
        padding: 0;
        overflow: hidden;
      `;

      // 尝试进入全屏模式
      if (deviceMode === 'mobile') {
        try {
          // 等待窗口加载完成后尝试进入全屏
          newWindow.onload = () => {
            const elem = newWindow.document.documentElement;
            if (elem.requestFullscreen) {
              elem.requestFullscreen();
            }
          };
        } catch (error) {
          console.error('Failed to enter fullscreen:', error);
        }
      }

      setPreviewWindow(newWindow);
      setError('Preview window opened. Click the record button when ready.');
    } else {
      setError('Failed to open preview window. Please allow pop-ups for this site.');
    }
  };

  const startCountdown = async () => {
    let count = settings.countdown;
    while (count > 0) {
      setCountdown(count);
      await new Promise(resolve => setTimeout(resolve, 1000));
      count--;
    }
    setCountdown(null);
    await startRecording();
  };

  const startRecording = async () => {
    try {
      setError('');
      
      if (!previewWindow || previewWindow.closed) {
        setError('Please open the preview window first');
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          frameRate: { ideal: settings.frameRate },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: settings.videoBitrate,
        audioBitsPerSecond: settings.audioBitrate,
      });
      
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingState((prev) => ({
          ...prev,
          recordedChunks: chunks,
          previewUrl: url,
          isRecording: false,
        }));
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        mediaRecorder,
        recordedChunks: [],
      }));

      setError('Recording started. Select the preview window in the screen selector.');
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to start recording. Please try again.');
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
      }));
    }
  };

  const stopRecording = () => {
    if (recordingState.mediaRecorder && recordingState.isRecording) {
      recordingState.mediaRecorder.stop();
      recordingState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const downloadRecording = () => {
    if (recordingState.recordedChunks.length === 0) return;
    
    const blob = new Blob(recordingState.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `screen-recording-${new Date().toISOString()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const clearRecording = () => {
    setRecordingState((prev) => ({
      ...prev,
      recordedChunks: [],
      previewUrl: '',
    }));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleDeviceModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: 'desktop' | 'mobile',
  ) => {
    if (newMode !== null) {
      setDeviceMode(newMode);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4">Screen Recorder</Typography>
            <Tooltip title="Recording Settings">
              <IconButton onClick={() => setOpenSettings(true)}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>

          <Divider>
            <Chip label="Input Settings" />
          </Divider>

          {error && (
            <Alert 
              severity={error.includes('Failed') ? 'error' : 'info'}
              onClose={() => setError('')}
              sx={{ '& .MuiAlert-message': { width: '100%' } }}
            >
              {error}
            </Alert>
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab 
                label="URL Input" 
                icon={<Tooltip title="Enter a URL to record a website"><Info /></Tooltip>}
                iconPosition="end"
              />
              <Tab 
                label="HTML Input"
                icon={<Tooltip title="Enter custom HTML code to record"><Info /></Tooltip>}
                iconPosition="end"
              />
            </Tabs>
          </Box>

          <Box role="tabpanel" hidden={activeTab !== 0}>
            <TextField
              fullWidth
              label="Enter URL to record"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              helperText="Enter the URL of the website you want to record"
            />
          </Box>

          <Box role="tabpanel" hidden={activeTab !== 1}>
            <TextField
              fullWidth
              label="Enter HTML content"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              multiline
              rows={4}
              helperText="Enter custom HTML code to create your recording content"
            />
          </Box>

          <Divider>
            <Chip label="Preview Settings" />
          </Divider>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              type="color"
              label="Background Color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              sx={{ width: 200 }}
            />
            <ToggleButtonGroup
              value={deviceMode}
              exclusive
              onChange={handleDeviceModeChange}
              aria-label="device mode"
            >
              <ToggleButton value="desktop" aria-label="desktop mode">
                <Tooltip title="Desktop View">
                  <Computer />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="mobile" aria-label="mobile mode">
                <Tooltip title="Mobile View">
                  <PhoneAndroid />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<OpenInNew />}
              onClick={openPreviewWindow}
              disabled={recordingState.isRecording}
            >
              Open Preview
            </Button>
          </Box>

          <Divider>
            <Chip label="Recording Preview" />
          </Divider>

          <Box 
            sx={{ 
              width: '100%',
              minHeight: '400px',
              bgcolor: backgroundColor,
              overflow: 'hidden',
              borderRadius: 1,
              border: '1px solid #ccc',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              p: 2,
              position: 'relative',
            }}
          >
            {countdown !== null && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  zIndex: 1,
                }}
              >
                <Typography variant="h1" color="white">
                  {countdown}
                </Typography>
              </Box>
            )}
            {recordingState.previewUrl ? (
              <video
                src={recordingState.previewUrl}
                controls
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Typography variant="body1" color="text.secondary" align="center">
                Click "Open Preview" to open content in a new window for recording
                <br />
                <br />
                After opening the preview, click the record button to start recording
              </Typography>
            )}
          </Box>

          <Divider>
            <Chip label="Recording Controls" />
          </Divider>

          <Stack direction="row" spacing={2} justifyContent="center">
            {!recordingState.isRecording ? (
              <Tooltip title="Start Recording">
                <span>
                  <IconButton
                    color="primary"
                    onClick={() => startCountdown()}
                    disabled={recordingState.isRecording || !previewWindow || previewWindow.closed}
                    sx={{ width: 56, height: 56 }}
                  >
                    <PlayArrow sx={{ fontSize: 32 }} />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title="Stop Recording">
                <IconButton
                  color="error"
                  onClick={stopRecording}
                  disabled={!recordingState.isRecording}
                  sx={{ width: 56, height: 56 }}
                >
                  <Stop sx={{ fontSize: 32 }} />
                </IconButton>
              </Tooltip>
            )}

            {recordingState.recordedChunks.length > 0 && (
              <>
                <Tooltip title="Download Recording">
                  <IconButton 
                    color="primary" 
                    onClick={downloadRecording}
                    sx={{ width: 56, height: 56 }}
                  >
                    <Download sx={{ fontSize: 32 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clear Recording">
                  <IconButton 
                    color="error" 
                    onClick={clearRecording}
                    sx={{ width: 56, height: 56 }}
                  >
                    <Delete sx={{ fontSize: 32 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
        <DialogTitle>Recording Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1, minWidth: 300 }}>
            <FormControl fullWidth>
              <InputLabel>Frame Rate</InputLabel>
              <Select
                value={settings.frameRate}
                label="Frame Rate"
                onChange={(e) => setSettings(prev => ({ ...prev, frameRate: Number(e.target.value) }))}
              >
                <MenuItem value={24}>24 fps</MenuItem>
                <MenuItem value={30}>30 fps</MenuItem>
                <MenuItem value={60}>60 fps</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Video Quality</InputLabel>
              <Select
                value={settings.videoBitrate}
                label="Video Quality"
                onChange={(e) => setSettings(prev => ({ ...prev, videoBitrate: Number(e.target.value) }))}
              >
                <MenuItem value={1000000}>Low (1 Mbps)</MenuItem>
                <MenuItem value={2500000}>Medium (2.5 Mbps)</MenuItem>
                <MenuItem value={5000000}>High (5 Mbps)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Audio Quality</InputLabel>
              <Select
                value={settings.audioBitrate}
                label="Audio Quality"
                onChange={(e) => setSettings(prev => ({ ...prev, audioBitrate: Number(e.target.value) }))}
              >
                <MenuItem value={64000}>Low (64 kbps)</MenuItem>
                <MenuItem value={128000}>Medium (128 kbps)</MenuItem>
                <MenuItem value={192000}>High (192 kbps)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Countdown Timer</InputLabel>
              <Select
                value={settings.countdown}
                label="Countdown Timer"
                onChange={(e) => setSettings(prev => ({ ...prev, countdown: Number(e.target.value) }))}
              >
                <MenuItem value={0}>No Countdown</MenuItem>
                <MenuItem value={3}>3 Seconds</MenuItem>
                <MenuItem value={5}>5 Seconds</MenuItem>
                <MenuItem value={10}>10 Seconds</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettings(defaultSettings)}>Reset to Default</Button>
          <Button onClick={() => setOpenSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ScreenRecorder; 