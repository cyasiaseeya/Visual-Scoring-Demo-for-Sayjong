/**
 * CalibrationCapture - Tool for capturing vowel calibration data
 * 
 * This component allows users to capture facial landmarks and blendshapes
 * for the four basis vowels (neutral, ㅏ, ㅜ, ㅣ) and saves them to
 * vowel_calibration.json
 */

import { useRef, useEffect, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { ALL_TRACKED_LANDMARKS } from '../constants/landmarks';

interface CalibrationData {
  neutral?: CapturedFrame;
  a?: CapturedFrame;
  u?: CapturedFrame;
  i?: CapturedFrame;
}

interface CapturedFrame {
  landmarks: Record<string, [number, number, number]>;
  blendshapes: Record<string, number>;
}

const CalibrationCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentVowel, setCurrentVowel] = useState<'neutral' | 'a' | 'u' | 'i'>('neutral');
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Target blendshapes to track
  const TARGET_BLENDSHAPES = ['jawOpen', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFunnel'];

  useEffect(() => {
    initializeMediaPipe();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeMediaPipe = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
      });

      faceLandmarkerRef.current = faceLandmarker;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsInitialized(true);
        startProcessing();
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  };

  const startProcessing = () => {
    const processFrame = () => {
      if (videoRef.current && canvasRef.current && faceLandmarkerRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Mirror the video
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Process with MediaPipe
        const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          
          // Draw landmarks
          ctx.fillStyle = '#00FF00';
          ALL_TRACKED_LANDMARKS.forEach(index => {
            const landmark = landmarks[index];
            const x = (1 - landmark.x) * canvas.width;
            const y = landmark.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const captureFrame = async () => {
    if (!faceLandmarkerRef.current || !videoRef.current) return;

    setIsCapturing(true);
    
    // Countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(null);

    // Capture
    const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());

    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const landmarks = results.faceLandmarks[0];
      const blendshapes = results.faceBlendshapes?.[0]?.categories || [];

      // Extract landmarks
      const capturedLandmarks: Record<string, [number, number, number]> = {};
      ALL_TRACKED_LANDMARKS.forEach(index => {
        const lm = landmarks[index];
        capturedLandmarks[index.toString()] = [lm.x, lm.y, lm.z];
      });

      // Extract blendshapes
      const capturedBlendshapes: Record<string, number> = {};
      blendshapes.forEach((bs: any) => {
        const name = bs.categoryName || bs.displayName || '';
        if (TARGET_BLENDSHAPES.includes(name)) {
          capturedBlendshapes[name] = bs.score || 0;
        }
      });

      const frame: CapturedFrame = {
        landmarks: capturedLandmarks,
        blendshapes: capturedBlendshapes,
      };

      setCalibrationData(prev => ({
        ...prev,
        [currentVowel]: frame,
      }));

      alert(`✅ Captured ${currentVowel}!`);
    }

    setIsCapturing(false);
  };

  const downloadCalibration = () => {
    const json = JSON.stringify(calibrationData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vowel_calibration.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const vowelInstructions = {
    neutral: '😐 Neutral face - Relax your mouth',
    a: '😮 Say "ㅏ" (ah) - Open mouth wide',
    u: '😗 Say "ㅜ" (oo) - Round and pucker lips',
    i: '😁 Say "ㅣ" (ee) - Spread lips wide',
  };

  return (
    <div style={{ 
      padding: '20px', 
      width: '100vw',
      backgroundColor: '#ffffff',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <h1 style={{ textAlign: 'center', color: '#f04299', fontSize: '2.5rem', marginBottom: '2rem' }}>Vowel Calibration Tool</h1>
      
      <div style={{ display: 'flex', gap: '30px', marginTop: '20px', maxWidth: '1400px', margin: '20px auto 0' }}>
        {/* Video/Canvas */}
        <div style={{ flex: '2', minWidth: '600px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', borderRadius: '10px', overflow: 'hidden' }}>
            <video
              ref={videoRef}
              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {countdown !== null && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '120px',
                fontWeight: 'bold',
                color: '#00FF00',
                textShadow: '0 0 20px rgba(0,255,0,0.8)',
              }}>
                {countdown}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '12px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#f04299', fontSize: '1.2rem' }}>Current Vowel</h3>
            <select
              value={currentVowel}
              onChange={(e) => setCurrentVowel(e.target.value as any)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '2px solid #f04299',
                marginBottom: '10px',
              }}
            >
              <option value="neutral">Neutral (중립)</option>
              <option value="a">ㅏ (ah)</option>
              <option value="u">ㅜ (oo)</option>
              <option value="i">ㅣ (ee)</option>
            </select>
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#ffffff', 
              borderRadius: '8px', 
              fontSize: '14px',
              border: '1px solid #dee2e6',
              color: '#495057'
            }}>
              {vowelInstructions[currentVowel]}
            </div>
          </div>

          <button
            onClick={captureFrame}
            disabled={!isInitialized || isCapturing}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: isCapturing ? '#ccc' : '#f04299',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: isCapturing ? 'not-allowed' : 'pointer',
            }}
          >
            {isCapturing ? 'Capturing...' : `Capture ${currentVowel.toUpperCase()}`}
          </button>

          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '12px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#f04299', fontSize: '1.2rem' }}>Captured Data</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['neutral', 'a', 'u', 'i'] as const).map(vowel => (
                <div
                  key={vowel}
                  style={{
                    padding: '12px',
                    backgroundColor: calibrationData[vowel] ? '#e8f5e8' : '#fff3cd',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: `1px solid ${calibrationData[vowel] ? '#c3e6c3' : '#ffeaa7'}`,
                  }}
                >
                  <span style={{ fontWeight: '600', color: '#495057' }}>{vowel}</span>
                  <span style={{ fontSize: '16px' }}>{calibrationData[vowel] ? '✅' : '⏳'}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={downloadCalibration}
            disabled={Object.keys(calibrationData).length < 4}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              fontWeight: '600',
              backgroundColor: Object.keys(calibrationData).length < 4 ? '#e9ecef' : '#28a745',
              color: Object.keys(calibrationData).length < 4 ? '#6c757d' : '#fff',
              border: 'none',
              borderRadius: '12px',
              cursor: Object.keys(calibrationData).length < 4 ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
            }}
          >
            Download Calibration
          </button>

          <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
            Tracking: {ALL_TRACKED_LANDMARKS.length} landmarks<br />
            (3 face + 40 mouth)
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalibrationCapture;

