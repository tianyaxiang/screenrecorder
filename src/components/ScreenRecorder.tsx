import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  FormHelperText,
  AlertTitle,
  InputAdornment,
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
  RestartAlt,
  Language,
} from '@mui/icons-material';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
  resolution: 'original' | '1080p' | '720p' | '480p';
}

const defaultSettings: RecordingSettings = {
  frameRate: 30,
  videoBitrate: 2500000, // 2.5 Mbps
  audioBitrate: 128000,  // 128 kbps
  countdown: 3,
  resolution: 'original'
};

const ScreenRecorder = () => {
  const [url, setUrl] = useState<string>('');
  const [urlError, setUrlError] = useState<string>('');
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
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isConverting, setIsConverting] = useState(false);
  const [ffmpegLoaded, setFFmpegLoaded] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (previewWindow) {
        previewWindow.close();
      }
    };
  }, []);

  useEffect(() => {
    // 加载 FFmpeg
    const loadFFmpeg = async () => {
      try {
        if (!ffmpeg.loaded) {
          // 使用 CDN 加载 FFmpeg core 文件
          const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
          const ffmpegCore = await fetch(
            `${baseURL}/ffmpeg-core.js`
          ).then(response => response.text());
          const ffmpegCoreUrl = URL.createObjectURL(
            new Blob([ffmpegCore], { type: 'text/javascript' })
          );

          const wasmBinary = await fetch(
            `${baseURL}/ffmpeg-core.wasm`
          ).then(response => response.arrayBuffer());
          const wasmUrl = URL.createObjectURL(
            new Blob([wasmBinary], { type: 'application/wasm' })
          );

          await ffmpeg.load({
            coreURL: ffmpegCoreUrl,
            wasmURL: wasmUrl
          });

          // 清理创建的 URL
          URL.revokeObjectURL(ffmpegCoreUrl);
          URL.revokeObjectURL(wasmUrl);
        }

        // 测试 FFmpeg 是否可用
        try {
          await ffmpeg.exec(['-version']);
          console.log('FFmpeg loaded and working successfully');
          setFFmpegLoaded(true);
          setError('');
        } catch (testError) {
          console.error('FFmpeg load test failed:', testError);
          throw new Error('FFmpeg load test failed');
        }
      } catch (error: unknown) {
        console.error('Failed to load FFmpeg:', error);
        let errorMessage = '无法加载视频转换组件。';
        
        if (error instanceof Error) {
          console.error('Error details:', error.message);
          if (error.message.includes('SharedArrayBuffer')) {
            errorMessage += '请确保网站运行在安全上下文中（HTTPS）。';
          } else if (error.message.includes('CORS')) {
            errorMessage += '请检查浏览器的跨域访问设置。';
          } else if (error.message.includes('WebAssembly')) {
            errorMessage += '您的浏览器可能不支持 WebAssembly，请使用最新版本的 Chrome、Firefox 或 Edge。';
          } else {
            errorMessage += `\n错误详情: ${error.message}`;
          }
        }
        
        errorMessage += '\n\n如果问题持续存在，请尝试：\n1. 使用最新版本的 Chrome 浏览器\n2. 刷新页面\n3. 清除浏览器缓存';
        
        setError(errorMessage);
        setFFmpegLoaded(false);
      }
    };

    loadFFmpeg();
  }, [ffmpeg]);

  const openPreviewWindow = () => {
    // URL 格式验证
    if (activeTab === 0) {
      try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          setUrlError('请输入有效的 http 或 https 网址');
          return;
        }
      } catch (e) {
        setUrlError('请输入有效的网址');
        return;
      }
      
      if (!url.trim()) {
        setUrlError('请输入网址');
        return;
      }
    }

    const previewData = {
      content: activeTab === 0 ? url : htmlContent,
      type: activeTab === 0 ? 'url' : 'html',
      backgroundColor,
      deviceMode,
    };

    localStorage.setItem('previewData', JSON.stringify(previewData));

    const params = new URLSearchParams({
      timestamp: Date.now().toString(),
    });

    const previewUrl = activeTab === 0 ? url : `/preview?${params.toString()}`;
    
    // 移动设备模式下使用精确的设备尺寸，并使用应用模式
    //ipone pro max 430*932
    const windowFeatures = deviceMode === 'mobile'
      ? `left=0,top=0,width=375,height=812,menubar=no,toolbar=no,location=no,status=no,titlebar=no,directories=no,fullscreen=yes,scrollbars=no,resizable=no,chrome=yes,centerscreen=yes,alwaysRaised=yes`
      : 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,alwaysRaised=yes';
    
    // 关闭之前的预览窗口
    if (previewWindow && !previewWindow.closed) {
      previewWindow.close();
    }

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

      // 添加窗口焦点监听
      newWindow.addEventListener('blur', () => {
        // 当窗口失去焦点时，尝试重新获取焦点
        setTimeout(() => {
          if (!recordingState.isRecording) {
            try {
              newWindow.focus();
            } catch (error) {
              console.warn('Failed to focus window:', error);
            }
          }
        }, 100);
      });

      setPreviewWindow(newWindow);
      setError('Preview window opened. Click the record button when ready.');

      // 确保新窗口置顶
      setTimeout(() => {
        try {
          newWindow.focus();
        } catch (error) {
          console.warn('Failed to focus new window:', error);
        }
      }, 100);
    } else {
      setError('Failed to open preview window. Please allow pop-ups for this site.');
    }
  };

  const startCountdown = async () => {
    if (!previewWindow || previewWindow.closed) {
      setError('Please open the preview window first');
      return;
    }

    // 尝试将预览窗口置顶
    try {
      previewWindow.focus();
      // 通过移动窗口位置来触发窗口置顶
      const { screenX, screenY } = previewWindow;
      previewWindow.moveTo(screenX, screenY);
      // 如果窗口最小化，将其还原
      if (previewWindow.document.hidden) {
        previewWindow.focus();
      }
    } catch (error) {
      console.warn('Failed to focus preview window:', error);
    }

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
        setError('请先打开预览窗口');
        return;
      }

      // 检查是否支持屏幕录制
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setError('您的浏览器不支持屏幕录制功能。请使用最新版本的 Chrome、Firefox 或 Edge 浏览器。');
        return;
      }

      // 尝试获取屏幕录制权限
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          frameRate: { ideal: settings.frameRate },
          displaySurface: 'window',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      }).catch((error) => {
        console.error('Screen capture permission error:', error);
        if (error.name === 'NotAllowedError') {
          setError('请允许屏幕录制权限。如果您已经拒绝权限，请点击地址栏左侧的图标重新授予权限。');
        } else {
          setError(`屏幕录制失败: ${error.message || '未知错误'}`);
        }
        throw error;
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

      setError('录制已开始。请在系统弹出的窗口中选择要录制的预览窗口。');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
      }));
      if (!error.message?.includes('请允许屏幕录制权限')) {
        setError(`录制失败: ${error.message || '未知错误'}`);
      }
    }
  };

  const stopRecording = () => {
    if (recordingState.mediaRecorder && recordingState.isRecording) {
      recordingState.mediaRecorder.stop();
      recordingState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  // 解析视频时长
  const parseDuration = (output: string): number => {
    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
    if (durationMatch) {
      const [, hours, minutes, seconds] = durationMatch;
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    }
    return 0;
  };

  const convertVideo = async (inputBlob: Blob, format: 'mp4' | 'mov' | 'webm'): Promise<Blob> => {
    if (!ffmpegLoaded) {
      throw new Error('FFmpeg is not loaded yet');
    }

    setIsConverting(true);
    setConversionProgress('准备转换...');
    setProgressPercent(0);

    try {
      // 清理可能存在的临时文件
      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile(`output.${format}`);
      } catch (e) {
        // 忽略文件不存在的错误
      }

      // 设置日志回调以获取进度
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg Log:', message);
        
        // 获取视频时长
        if (message.includes('Duration')) {
          const duration = parseDuration(message);
          if (duration > 0) {
            setVideoDuration(duration);
          }
        }
        
        // 解析当前处理时间
        const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch && videoDuration > 0) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const percent = Math.min(Math.round((currentTime / videoDuration) * 100), 99);
          setProgressPercent(percent);
        }
      });

      const conversionPromise = async () => {
        try {
          setConversionProgress('读取视频数据...');
          setProgressPercent(5);
          const inputData = await fetchFile(inputBlob);
          
          setConversionProgress('写入源文件...');
          setProgressPercent(10);
          await ffmpeg.writeFile('input.webm', inputData);

          setConversionProgress('分析视频信息...');
          setProgressPercent(15);

          // 设置转换参数 - 使用更高效的编码设置
          const outputFileName = `output.${format}`;
          const commonParams = [
            '-i', 'input.webm',
            '-threads', '0',           // 使用所有可用CPU核心
            '-movflags', '+faststart', // 优化网络播放
          ];

          // 添加分辨率参数
          if (settings.resolution !== 'original') {
            const resolutionMap = {
              '1080p': '1920:1080',
              '720p': '1280:720',
              '480p': '854:480'
            };
            const resolution = resolutionMap[settings.resolution];
            commonParams.push(
              '-vf', `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2`
            );
          }

          const codecParams = format === 'mp4' 
            ? [
                ...commonParams,
                '-c:v', 'h264',
                '-preset', 'veryfast',
                // 根据分辨率调整比特率
                ...(settings.resolution === '1080p' 
                  ? ['-maxrate', '4M', '-bufsize', '8M'] 
                  : ['-maxrate', '2M', '-bufsize', '4M']),
                '-crf', '30',
                '-tune', 'fastdecode',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ac', '2',
                '-ar', '44100',
                '-y',
                outputFileName
              ]
            : [
                ...commonParams,
                '-c:v', 'prores_ks',
                '-profile:v', '0',
                '-vendor', 'apl0',
                '-c:a', 'pcm_s16le',
                '-ac', '2',
                '-ar', '44100',
                '-y',
                outputFileName
              ];

          setConversionProgress('正在转换视频...');
          setProgressPercent(20);
          
          console.log('Starting FFmpeg conversion with params:', codecParams.join(' '));
          await ffmpeg.exec(codecParams);
          console.log('FFmpeg conversion completed');

          setConversionProgress('处理转换后的文件...');
          setProgressPercent(90);
          
          const outputData = await ffmpeg.readFile(outputFileName);
          console.log('Output file read, size:', outputData.length);
          
          setConversionProgress('生成最终文件...');
          setProgressPercent(95);
          
          // 清理临时文件
          await ffmpeg.deleteFile('input.webm');
          await ffmpeg.deleteFile(outputFileName);

          // 确保输出数据是 Uint8Array
          let uint8Array: Uint8Array;
          if (typeof outputData === 'string') {
            uint8Array = new TextEncoder().encode(outputData);
          } else if (outputData instanceof Uint8Array) {
            uint8Array = outputData;
          } else {
            throw new Error('Unexpected output data type');
          }

          const outputBlob = new Blob(
            [uint8Array], 
            { type: format === 'mp4' ? 'video/mp4' : 'video/quicktime' }
          );

          setProgressPercent(100);
          return outputBlob;
        } catch (error) {
          console.error('Conversion error:', error);
          throw error;
        }
      };

      const result = await conversionPromise();
      setConversionProgress('转换完成！');
      return result;

    } catch (error: any) {
      console.error('Error during video conversion:', error);
      // 尝试清理临时文件
      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile(`output.${format}`);
      } catch (e) {}
      
      let errorMessage = '未知错误';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `错误代码: ${error.code}`;
      }
      throw new Error(`视频转换失败: ${errorMessage}`);
    } finally {
      setIsConverting(false);
      setConversionProgress('');
      setProgressPercent(0);
      setVideoDuration(0);
      ffmpeg.off('log', () => {});
    }
  };

  const downloadRecording = async (format: 'mp4' | 'mov' | 'webm' = 'webm') => {
    if (recordingState.recordedChunks.length === 0) return;
    
    try {
      setError('');
      const originalBlob = new Blob(recordingState.recordedChunks, { type: 'video/webm' });
      
      // 检查源文件大小
      const fileSizeMB = originalBlob.size / (1024 * 1024);
      console.log('Source video size:', fileSizeMB.toFixed(2), 'MB');
      
      if (fileSizeMB > 100) {
        setError('视频文件过大（超过100MB），可能无法正常转换。建议录制更短的视频。');
        return;
      }
      
      let finalBlob = originalBlob;
      if (format !== 'webm') {
        setError('正在转换视频格式，请稍候...');
        finalBlob = await convertVideo(originalBlob, format);
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      a.download = `screen-recording-${new Date().toISOString()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setError('');
    } catch (error: any) {
      console.error('Error downloading video:', error);
      setError(error.message || '视频格式转换失败，请尝试其他格式或录制更短的视频');
    }
  };

  const clearRecording = () => {
    setRecordingState((prev) => ({
      ...prev,
      recordedChunks: [],
      previewUrl: '',
    }));
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleDeviceModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'desktop' | 'mobile' | null) => {
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
              label="输入要录制的网址"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  openPreviewWindow();
                }
              }}
              error={!!urlError}
              helperText={urlError || "输入完整的网址，包括 https:// 或 http://，按回车键直接打开"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Language />
                  </InputAdornment>
                ),
              }}
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

          <Paper 
            elevation={2} 
            sx={{ 
              p: 2, 
              bgcolor: 'background.default',
              position: 'sticky',
              top: 16,
              zIndex: 1000,
            }}
          >
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                  Preview Settings:
                </Typography>
                <TextField
                  type="color"
                  label="Background Color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  size="small"
                  sx={{ width: 150 }}
                />
                <ToggleButtonGroup
                  value={deviceMode}
                  exclusive
                  onChange={handleDeviceModeChange}
                  aria-label="device mode"
                  size="small"
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
                  sx={{
                    ml: 'auto',
                    bgcolor: 'info.main',
                    '&:hover': {
                      bgcolor: 'info.dark',
                    }
                  }}
                >
                  Open Preview
                </Button>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                  Recording Controls:
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  {!recordingState.isRecording ? (
                    <Tooltip title="Start Recording">
                      <span>
                        <IconButton
                          color="primary"
                          onClick={() => startCountdown()}
                          disabled={recordingState.isRecording || !previewWindow || previewWindow.closed}
                          sx={{ 
                            width: 48, 
                            height: 48,
                            bgcolor: 'primary.main',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'primary.dark',
                            },
                            '&.Mui-disabled': {
                              bgcolor: 'action.disabledBackground',
                              color: 'action.disabled',
                            }
                          }}
                        >
                          <PlayArrow />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Stop Recording">
                      <IconButton
                        color="error"
                        onClick={stopRecording}
                        disabled={!recordingState.isRecording}
                        sx={{ 
                          width: 48, 
                          height: 48,
                          bgcolor: 'error.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'error.dark',
                          }
                        }}
                      >
                        <Stop />
                      </IconButton>
                    </Tooltip>
                  )}

                  {recordingState.recordedChunks.length > 0 && (
                    <>
                      <Tooltip title="Download Recording">
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton 
                            onClick={() => downloadRecording('webm')}
                            disabled={isConverting}
                            sx={{ 
                              width: 48, 
                              height: 48,
                              bgcolor: 'success.light',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'success.main',
                              }
                            }}
                          >
                            <Download />
                          </IconButton>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => downloadRecording('mp4')}
                            disabled={isConverting || !ffmpegLoaded}
                            sx={{ 
                              minWidth: 'auto',
                              px: 1,
                              bgcolor: 'success.light',
                              '&:hover': { bgcolor: 'success.main' }
                            }}
                          >
                            MP4
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => downloadRecording('mov')}
                            disabled={isConverting || !ffmpegLoaded}
                            sx={{ 
                              minWidth: 'auto',
                              px: 1,
                              bgcolor: 'success.light',
                              '&:hover': { bgcolor: 'success.main' }
                            }}
                          >
                            MOV
                          </Button>
                        </Box>
                      </Tooltip>
                      <Tooltip title="Clear Recording">
                        <IconButton 
                          onClick={clearRecording}
                          disabled={isConverting}
                          sx={{ 
                            width: 48, 
                            height: 48,
                            bgcolor: 'warning.light',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'warning.main',
                            }
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Paper>

          {/* 录制预览区域 - 只在有录制内容时显示 */}
          {recordingState.recordedChunks.length > 0 && (
            <>
            
              <Box 
                sx={{ 
                  width: '100%',
                  height: '400px',
                  bgcolor: backgroundColor,
                  overflow: 'hidden',
                  borderRadius: 1,
                  border: '1px solid #ccc',
                }}
              >
                <video
                  src={recordingState.previewUrl}
                  controls
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </Box>
            </>
          )}

          {countdown !== null && (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 1200,
              }}
            >
              <Typography variant="h1" color="white">
                {countdown}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ mt: 3, p: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
          使用说明
        </Typography>
        
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'medium', mb: 1 }}>
              1. 内容设置
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
              • URL模式：输入要录制的网页地址<br />
              • HTML模式：输入自定义的HTML代码
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'medium', mb: 1 }}>
              2. 预览设置
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
              • 选择背景颜色：设置预览窗口的背景色<br />
              • 设备模式：选择桌面版或移动版预览<br />
              • 点击"Open Preview"打开预览窗口
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'medium', mb: 1 }}>
              3. 录制操作
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
              • 点击播放按钮开始录制（倒计时后自动开始）<br />
              • 在弹出的系统窗口中选择要录制的预览窗口<br />
              • 点击停止按钮结束录制<br />
              • 录制完成后可以预览、下载或删除录制内容
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'medium', mb: 1 }}>
              注意事项
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
              • 首次使用时需要允许浏览器的弹窗权限<br />
              • 录制时请确保预览窗口没有被最小化<br />
              • 移动设备模式下会自动调整为标准手机尺寸<br />
              • 建议在录制前关闭不需要的浏览器标签页，以方便选择录制窗口
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'medium', mb: 1 }}>
              快捷键
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
              • 开始录制：点击播放按钮或等待倒计时结束<br />
              • 停止录制：点击停止按钮或按 ESC 键<br />
              • 下载录制：点击下载按钮或按 Ctrl/Command + S
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Dialog open={openSettings} onClose={() => setOpenSettings(false)} maxWidth="md">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings fontSize="small" />
            录制和转换设置
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1, minWidth: 400 }}>
            {/* 录制设置组 */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                录制设置
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>帧率</InputLabel>
                  <Select
                    value={settings.frameRate}
                    label="帧率"
                    onChange={(e) => setSettings(prev => ({ ...prev, frameRate: Number(e.target.value) }))}
                  >
                    <MenuItem value={24}>24 fps (电影效果)</MenuItem>
                    <MenuItem value={30}>30 fps (推荐)</MenuItem>
                    <MenuItem value={60}>60 fps (流畅)</MenuItem>
                  </Select>
                  <FormHelperText>更高的帧率会产生更流畅的视频，但文件更大</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>倒计时</InputLabel>
                  <Select
                    value={settings.countdown}
                    label="倒计时"
                    onChange={(e) => setSettings(prev => ({ ...prev, countdown: Number(e.target.value) }))}
                  >
                    <MenuItem value={0}>无倒计时</MenuItem>
                    <MenuItem value={3}>3 秒</MenuItem>
                    <MenuItem value={5}>5 秒</MenuItem>
                    <MenuItem value={10}>10 秒</MenuItem>
                  </Select>
                  <FormHelperText>录制开始前的等待时间</FormHelperText>
                </FormControl>
              </Stack>
            </Box>

            {/* 视频转换设置组 */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                视频转换设置
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>输出分辨率</InputLabel>
                  <Select
                    value={settings.resolution}
                    label="输出分辨率"
                    onChange={(e) => setSettings(prev => ({ ...prev, resolution: e.target.value as 'original' | '1080p' | '720p' | '480p' }))}
                  >
                    <MenuItem value="original">原始尺寸</MenuItem>
                    <MenuItem value="1080p">1080p (1920×1080) - 高清</MenuItem>
                    <MenuItem value="720p">720p (1280×720) - 推荐</MenuItem>
                    <MenuItem value="480p">480p (854×480) - 快速</MenuItem>
                  </Select>
                  <FormHelperText>较低的分辨率可以加快转换速度并减小文件大小</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>视频质量</InputLabel>
                  <Select
                    value={settings.videoBitrate}
                    label="视频质量"
                    onChange={(e) => setSettings(prev => ({ ...prev, videoBitrate: Number(e.target.value) }))}
                  >
                    <MenuItem value={1000000}>低质量 (1 Mbps)</MenuItem>
                    <MenuItem value={2500000}>中等质量 (2.5 Mbps)</MenuItem>
                    <MenuItem value={5000000}>高质量 (5 Mbps)</MenuItem>
                  </Select>
                  <FormHelperText>更高的比特率会产生更清晰的视频，但文件更大</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>音频质量</InputLabel>
                  <Select
                    value={settings.audioBitrate}
                    label="音频质量"
                    onChange={(e) => setSettings(prev => ({ ...prev, audioBitrate: Number(e.target.value) }))}
                  >
                    <MenuItem value={64000}>低质量 (64 kbps)</MenuItem>
                    <MenuItem value={128000}>中等质量 (128 kbps)</MenuItem>
                    <MenuItem value={192000}>高质量 (192 kbps)</MenuItem>
                  </Select>
                  <FormHelperText>更高的比特率会产生更清晰的声音</FormHelperText>
                </FormControl>
              </Stack>
            </Box>

            {/* 提示信息 */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <AlertTitle>提示</AlertTitle>
              • 选择合适的设置可以在文件大小和质量之间取得平衡<br />
              • 较低的分辨率和比特率可以加快转换速度<br />
              • 对于大多数屏幕录制，推荐使用 720p 分辨率和中等质量设置
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setSettings(defaultSettings)}
            startIcon={<RestartAlt />}
          >
            恢复默认设置
          </Button>
          <Button 
            onClick={() => setOpenSettings(false)}
            variant="contained"
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>

      {isConverting && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Paper 
            sx={{ 
              p: 3, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 2, 
              maxWidth: '80%',
              minWidth: 300,
            }}
          >
            <Box sx={{ width: '100%', mb: 1 }}>
              <LinearProgress 
                variant="determinate" 
                value={progressPercent} 
                sx={{
                  height: 8,
                  borderRadius: 4,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
            <Typography variant="h6" align="center">
              {progressPercent}%
            </Typography>
            <Typography align="center">
              {conversionProgress || '正在转换视频格式，请稍候...'}
            </Typography>
            <Typography variant="caption" color="text.secondary" align="center">
              转换过程中请勿关闭窗口
            </Typography>
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default ScreenRecorder; 