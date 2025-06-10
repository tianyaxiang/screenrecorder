import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

interface PreviewData {
  content: string;
  type: 'url' | 'html';
  backgroundColor: string;
  deviceMode: 'desktop' | 'mobile';
}

const PreviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const contentRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // 从 localStorage 读取数据
    const storedData = localStorage.getItem('previewData');
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setPreviewData(data);
        // 清除数据，避免内存泄漏
        localStorage.removeItem('previewData');
      } catch (error) {
        console.error('Failed to parse preview data:', error);
      }
    }
  }, [searchParams.get('timestamp')]);

  useEffect(() => {
    if (previewData?.type === 'html' && contentRef.current) {
      const iframe = contentRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        // 写入完整的 HTML 文档
        iframeDoc.open();
        
        // 如果内容不包含完整的 HTML 结构，添加基本结构
        let content = previewData.content.trim();
        if (!content.toLowerCase().includes('<!doctype html>')) {
          content = `
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
      height: 100%;
      overflow: auto;
    }
    * {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
        }

        iframeDoc.write(content);
        iframeDoc.close();

        // 等待 iframe 加载完成后执行脚本
        iframe.onload = () => {
          // 查找所有脚本标签并重新执行
          const scripts = iframeDoc.getElementsByTagName('script');
          Array.from(scripts).forEach(oldScript => {
            const newScript = iframeDoc.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
              newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode?.replaceChild(newScript, oldScript);
          });
        };
      }
    }
  }, [previewData]);

  if (!previewData) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          Loading preview...
        </div>
      </div>
    );
  }

  const { content, type, backgroundColor, deviceMode } = previewData;

  const containerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    backgroundColor,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    width: deviceMode === 'mobile' ? '375px' : '100%',
    height: deviceMode === 'mobile' ? '812px' : '100%',
    overflow: 'hidden',
    backgroundColor: 'white',
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {type === 'url' ? (
          <iframe
            src={content}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="Preview Content"
          />
        ) : (
          <iframe
            ref={contentRef}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="HTML Preview"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
};

export default PreviewPage; 