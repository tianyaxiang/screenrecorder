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
  const contentRef = useRef<HTMLDivElement>(null);

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
      // 创建一个安全的方式来渲染 HTML 内容
      const contentContainer = contentRef.current;
      contentContainer.innerHTML = previewData.content;

      // 添加默认样式
      const style = document.createElement('style');
      style.textContent = `
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
      `;
      contentContainer.appendChild(style);
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
          <div 
            ref={contentRef}
            style={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PreviewPage; 