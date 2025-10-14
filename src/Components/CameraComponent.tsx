import { useRef, useEffect, useState } from 'react';

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

        // 최신 MediaPipe API 사용
        const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3" as any);
        const { FaceLandmarker, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendShapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        class Camera {
          video: HTMLVideoElement;
          options: any;
          
          constructor(video: HTMLVideoElement, options: any) {
            this.video = video;
            this.options = options;
          }
          
          async start() {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.play();
            
            const onFrame = () => {
              if (this.options.onFrame) {
                this.options.onFrame();
              }
              requestAnimationFrame(onFrame);
            };
            onFrame();
          }
        }

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && canvasRef.current) {
              const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());
              
              if (canvasRef.current) {
                const canvasCtx = canvasRef.current.getContext('2d');
                if (canvasCtx) {
                  canvasCtx.save();
                  canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  canvasCtx.drawImage(
                    videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height
                  );
                  
                  // 얼굴 랜드마크는 그리지 않음
                  canvasCtx.restore();
                }
              }
              
              if (onResults) {
                onResults(results);
              }
            }
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
          objectFit: 'cover',
          transform: 'scaleX(-1)'
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

