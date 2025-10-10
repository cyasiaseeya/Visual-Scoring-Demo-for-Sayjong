import { useRef, useEffect, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
// import { drawConnectors } from '@mediapipe/drawing_utils';

interface CameraComponentProps {
  onResults?: (results: any) => void;
}

const CameraComponent: React.FC<CameraComponentProps> = ({ onResults }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        if (!videoRef.current || !canvasRef.current) return;

        const faceMesh = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults((results) => {
          if (canvasRef.current && videoRef.current) {
            const canvasCtx = canvasRef.current.getContext('2d');
            if (canvasCtx) {
              canvasCtx.save();
              canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              canvasCtx.drawImage(
                results.image, 0, 0, canvasRef.current.width, canvasRef.current.height
              );
              
              // 얼굴 랜드마크는 그리지 않음
              canvasCtx.restore();
            }
          }
          
          if (onResults) {
            onResults(results);
          }
        });

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await faceMesh.send({ image: videoRef.current! });
          },
          width: 563,
          height: 357
        });

        await camera.start();
        setIsInitialized(true);
        setError(null);

      } catch (err) {
        console.error('카메라 초기화 실패:', err);
        setError('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.');
      }
    };

    initializeCamera();
  }, [onResults]);

  return (
    <div style={{ position: 'relative', width: '563px', height: '357px' }}>
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
        width={563}
        height={357}
      />
      {!isInitialized && !error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#666',
          fontSize: '16px'
        }}>
          카메라 초기화 중...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#ff4444',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default CameraComponent;
