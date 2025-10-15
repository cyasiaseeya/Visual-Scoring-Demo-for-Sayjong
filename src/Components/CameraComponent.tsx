/**
 * CameraComponent - Real-time Mouth Tracking with Vowel Overlay
 * 
 * Features:
 * - 43 landmark tracking (3 face anchors + 40 mouth points)
 * - 3D head pose tracking with full rotation support (pitch, yaw, roll)
 * - Nose-tip anchor system with eye-based coordinate frame
 * - Real-time blendshape analysis for pronunciation training
 * - Target vowel overlay with calibration-based positioning (static shape)
 * - Smooth motion tracking with EMA filtering
 * - Full 40-point mouth detail (20 outer lip + 20 inner lip)
 * 
 * Anchor System:
 * - Origin: Nose tip (landmark #1) - stable reference point
 * - Right vector: Normalized direction from left eye inner to right eye inner
 * - Up vector: Perpendicular to face plane (forward × right)
 * - Forward vector: Cross product of right vector and eye-to-nose vector
 * - Scale: Inter-eye distance for proportional sizing
 * - Transforms calibrated overlay to match user's head orientation automatically
 */

import { useRef, useEffect, useState } from 'react';
import calibrationData from '../vowel_calibration.json';
import { VOWEL_COEFFS_MONO } from '../vowelModel_mono';
import { FACE_ANCHORS, MOUTH_LANDMARKS } from '../constants/landmarks';

interface CameraComponentProps {
  onResults?: (results: {
    landmarks?: LandmarkPoint[];
    blendshapes?: Record<string, number>;
  }) => void;
}

interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

const CameraComponent: React.FC<CameraComponentProps> = ({ onResults }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Smoothing configuration
  const blendshapesHistory = useRef<number[][]>([]);
  const smoothingFactor = 0.7;

  // MediaPipe blendshape names (ARKit compatible)
  const BLENDSHAPE_NAMES = [
    'neutral', 'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft',
    'browOuterUpRight', 'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft',
    'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft',
    'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
    'jawForward', 'jawLeft', 'jawOpen', 'jawRight', 'mouthClose', 'mouthDimpleLeft',
    'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel',
    'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft',
    'mouthPressRight', 'mouthPucker', 'mouthRight', 'mouthRollLower', 'mouthRollUpper',
    'mouthShrugLower', 'mouthShrugUpper', 'mouthSmileLeft', 'mouthSmileRight',
    'mouthStretchLeft', 'mouthStretchRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
    'noseSneerLeft', 'noseSneerRight'
  ];

  // Target blendshapes for pronunciation training
  const TARGET_BLENDSHAPES = ['jawOpen', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFunnel'];
  const ADDITIONAL_BLENDSHAPES = ['mouthClose', 'mouthStretchLeft', 'mouthStretchRight', 'browInnerUp'];

  // All tracked landmarks (43 points: 3 face anchors + 40 mouth landmarks)
  const TRACKED_LANDMARKS = [...FACE_ANCHORS, ...MOUTH_LANDMARKS];
  
  // Target vowel overlay configuration
  const TARGET_VOWEL = 'ㅔ';
  
  /**
   * Note: Vowel coefficients imported from vowelModel_mono.ts
   * - ㅏ, ㅜ, ㅣ use calibrated data directly from vowel_calibration.json
   * - Other vowels use VOWEL_COEFFS_MONO for interpolation
   */

  /**
   * Extracts only the tracked landmarks (17 points)
   */
  const extractTrackedLandmarks = (landmarks: LandmarkPoint[]) => {
    return TRACKED_LANDMARKS.map(index => ({
      index,
      ...landmarks[index]
    }));
  };

  interface HeadPoseAnchor {
    origin: { x: number; y: number; z: number };  // Nose tip (landmark 1)
    rightVector: { x: number; y: number; z: number };  // Unit vector from left eye to right eye
    upVector: { x: number; y: number; z: number };  // Unit vector perpendicular to face plane
    forwardVector: { x: number; y: number; z: number };  // Unit vector pointing out from face
    scale: number;  // Inter-eye distance for scaling
  }

  const computeHeadPoseAnchor = (landmarks: LandmarkPoint[] | Record<string, number[]>): HeadPoseAnchor => {
    let nose, leftEye, rightEye;
    
    if (Array.isArray(landmarks)) {
      nose = landmarks[1];  // Nose tip - used as anchor origin
      leftEye = landmarks[133];
      rightEye = landmarks[362];
    } else {
      nose = { x: landmarks[1][0], y: landmarks[1][1], z: landmarks[1][2] };
      leftEye = { x: landmarks[133][0], y: landmarks[133][1], z: landmarks[133][2] };
      rightEye = { x: landmarks[362][0], y: landmarks[362][1], z: landmarks[362][2] };
    }

    // Compute right vector (left eye → right eye)
    const rightVec = {
      x: rightEye.x - leftEye.x,
      y: rightEye.y - leftEye.y,
      z: rightEye.z - leftEye.z
    };
    const rightLength = Math.sqrt(rightVec.x * rightVec.x + rightVec.y * rightVec.y + rightVec.z * rightVec.z);
    const rightVector = {
      x: rightVec.x / rightLength,
      y: rightVec.y / rightLength,
      z: rightVec.z / rightLength
    };

    // Compute eye center
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
      z: (leftEye.z + rightEye.z) / 2
    };

    // Compute temporary down vector (eye center → nose, normalized)
    const eyeToNose = {
      x: nose.x - eyeCenter.x,
      y: nose.y - eyeCenter.y,
      z: nose.z - eyeCenter.z
    };
    const eyeToNoseLength = Math.sqrt(eyeToNose.x * eyeToNose.x + eyeToNose.y * eyeToNose.y + eyeToNose.z * eyeToNose.z);
    const downVector = {
      x: eyeToNose.x / eyeToNoseLength,
      y: eyeToNose.y / eyeToNoseLength,
      z: eyeToNose.z / eyeToNoseLength
    };

    // Forward vector = right × down (cross product, points out from face)
    const forwardVec = {
      x: rightVector.y * downVector.z - rightVector.z * downVector.y,
      y: rightVector.z * downVector.x - rightVector.x * downVector.z,
      z: rightVector.x * downVector.y - rightVector.y * downVector.x
    };
    const forwardLength = Math.sqrt(forwardVec.x * forwardVec.x + forwardVec.y * forwardVec.y + forwardVec.z * forwardVec.z);
    const forwardVector = {
      x: forwardVec.x / forwardLength,
      y: forwardVec.y / forwardLength,
      z: forwardVec.z / forwardLength
    };

    // Up vector = forward × right (cross product, orthogonal to face plane)
    const upVec = {
      x: forwardVector.y * rightVector.z - forwardVector.z * rightVector.y,
      y: forwardVector.z * rightVector.x - forwardVector.x * rightVector.z,
      z: forwardVector.x * rightVector.y - forwardVector.y * rightVector.x
    };
    const upLength = Math.sqrt(upVec.x * upVec.x + upVec.y * upVec.y + upVec.z * upVec.z);
    const upVector = {
      x: upVec.x / upLength,
      y: upVec.y / upLength,
      z: upVec.z / upLength
    };

    return {
      origin: { x: nose.x, y: nose.y, z: nose.z }, // Nose tip as origin
      rightVector,
      upVector,
      forwardVector,
      scale: rightLength
    };
  };

  const computeTargetLandmarks = (
    allLandmarks: LandmarkPoint[],
    vowel: string
  ): Record<number, LandmarkPoint> => {
    // All 40 mouth landmarks (20 outer + 20 inner) from calibration
    const outerLipIds = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
    const innerLipIds = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
    const allMouthIds = [...outerLipIds, ...innerLipIds];
    
    // Compute static target shape in calibrated space using all 40 landmarks
    const staticTargetShape: Record<number, [number, number, number]> = {};
    
    // Check if vowel uses calibrated data directly or needs interpolation
    const isCalibrated = vowel === 'ㅏ' || vowel === 'ㅜ' || vowel === 'ㅣ';
    
    if (isCalibrated) {
      // Use calibrated data directly for ㅏ, ㅜ, ㅣ
      const calibratedKey = vowel === 'ㅏ' ? 'a' : vowel === 'ㅜ' ? 'u' : 'i';
      allMouthIds.forEach(id => {
        const coords = (calibrationData[calibratedKey].landmarks as any)[id.toString()];
        staticTargetShape[id] = [coords[0], coords[1], coords[2]];
      });
    } else {
      // Use coefficients to interpolate for other vowels
      if (!(vowel in VOWEL_COEFFS_MONO)) {
        throw new Error(`Unknown vowel: ${vowel}. Must be one of: ㅏ, ㅜ, ㅣ, ${Object.keys(VOWEL_COEFFS_MONO).join(', ')}`);
      }
      
      const coeffs = VOWEL_COEFFS_MONO[vowel];
      
      allMouthIds.forEach(id => {
        const idStr = id.toString();
        const neutral = (calibrationData.neutral.landmarks as any)[idStr];
        const a = (calibrationData.a.landmarks as any)[idStr];
        const u = (calibrationData.u.landmarks as any)[idStr];
        const i = (calibrationData.i.landmarks as any)[idStr];
        
        // Compute deltas from neutral
        const deltaA = [a[0] - neutral[0], a[1] - neutral[1], a[2] - neutral[2]];
        const deltaU = [u[0] - neutral[0], u[1] - neutral[1], u[2] - neutral[2]];
        const deltaI = [i[0] - neutral[0], i[1] - neutral[1], i[2] - neutral[2]];
        
        // Interpolate to get target shape
        staticTargetShape[id] = [
          neutral[0] + coeffs.open * deltaA[0] + coeffs.round * deltaU[0] + coeffs.spread * deltaI[0],
          neutral[1] + coeffs.open * deltaA[1] + coeffs.round * deltaU[1] + coeffs.spread * deltaI[1],
          neutral[2] + coeffs.open * deltaA[2] + coeffs.round * deltaU[2] + coeffs.spread * deltaI[2]
        ];
      });
    }
    
    // Compute head pose anchors for calibrated and user data
    const calibratedPose = computeHeadPoseAnchor(calibrationData.neutral.landmarks);
    const userPose = computeHeadPoseAnchor(allLandmarks);
    
    
    const targetLandmarks: Record<number, LandmarkPoint> = {};
    
    // Get calibrated nose position for transformation (if needed later)
    // const calibratedLandmark1 = (calibrationData.neutral.landmarks as any)['1'];
    
    // Create a static 'ㅔ' vowel overlay that follows head movements
    allMouthIds.forEach(id => {
      const staticPoint = staticTargetShape[id];
      
      // 1. Get vector from calibrated lip corner to static point
      const calibratedOffset = {
        x: staticPoint[0] - calibratedPose.origin.x,
        y: staticPoint[1] - calibratedPose.origin.y,
        z: staticPoint[2] - calibratedPose.origin.z
      };
      
      // 2. Express this offset in the calibrated coordinate system
      const localX = calibratedOffset.x * calibratedPose.rightVector.x + 
                     calibratedOffset.y * calibratedPose.rightVector.y + 
                     calibratedOffset.z * calibratedPose.rightVector.z;
      const localY = calibratedOffset.x * calibratedPose.upVector.x + 
                     calibratedOffset.y * calibratedPose.upVector.y + 
                     calibratedOffset.z * calibratedPose.upVector.z;
      const localZ = calibratedOffset.x * calibratedPose.forwardVector.x + 
                     calibratedOffset.y * calibratedPose.forwardVector.y + 
                     calibratedOffset.z * calibratedPose.forwardVector.z;
      
      // 3. Scale by face size ratio (keep original scaling)
      const scaleFactor = userPose.scale / calibratedPose.scale;
      const scaledLocalX = localX * scaleFactor;
      const scaledLocalY = localY * scaleFactor;
      const scaledLocalZ = localZ * scaleFactor;
      
      // 4. Transform back to world space using user's coordinate system
      const worldOffset = {
        x: scaledLocalX * userPose.rightVector.x + 
           scaledLocalY * userPose.upVector.x + 
           scaledLocalZ * userPose.forwardVector.x,
        y: scaledLocalX * userPose.rightVector.y + 
           scaledLocalY * userPose.upVector.y + 
           scaledLocalZ * userPose.forwardVector.y,
        z: scaledLocalX * userPose.rightVector.z + 
           scaledLocalY * userPose.upVector.z + 
           scaledLocalZ * userPose.forwardVector.z
      };
      
      // 5. Add to user's anchor position (nose tip)
      targetLandmarks[id] = {
        x: userPose.origin.x + worldOffset.x,
        y: userPose.origin.y + worldOffset.y,
        z: userPose.origin.z + worldOffset.z
      };
    });
    
    return targetLandmarks;
  };

  const smoothBlendshapes = (newBlendshapes: number[]): number[] => {
    const history = blendshapesHistory.current;
    
    if (history.length === 0) {
      history.push([...newBlendshapes]);
      return [...newBlendshapes];
    }
    
    const lastBlendshapes = history[history.length - 1];
    const smoothed = newBlendshapes.map((newVal, index) => {
      const lastVal = lastBlendshapes[index] || 0;
      return lastVal * smoothingFactor + newVal * (1 - smoothingFactor);
    });
    
    history.push(smoothed);
    if (history.length > 5) history.shift();
    
    return smoothed;
  };

  const extractBlendshapes = (results: any): any[] => {
    if (!results.faceBlendshapes || !Array.isArray(results.faceBlendshapes) || results.faceBlendshapes.length === 0) {
      return [];
    }

    const firstFace = results.faceBlendshapes[0];
    
    if (Array.isArray(firstFace)) {
      return firstFace;
    }
    
    if (firstFace?.categories) {
      return firstFace.categories;
    }
    
    return results.faceBlendshapes;
  };

  const displayBlendshapesAsObjects = (blendshapes: any[]): string => {
    let html = '<strong>Target Blendshapes:</strong><br/>';
    
    const targetData = blendshapes.filter((bs: any) => {
      const name = bs.categoryName || bs.category || bs.name || '';
      return TARGET_BLENDSHAPES.includes(name);
    });
    
    if (targetData.length > 0) {
      targetData.forEach((bs: any) => {
        const name = bs.categoryName || bs.category || bs.name;
        const score = bs.score || bs.value || 0;
        html += `<span class="blendshapeValue">${name}:</span> ${score.toFixed(3)}<br/>`;
      });
    } else {
      html += 'No target blendshapes found<br/>';
    }
    
    html += '<br/><strong>Additional Pronunciation Blendshapes:</strong><br/>';
    const additionalData = blendshapes.filter((bs: any) => {
      const name = bs.categoryName || bs.category || bs.name || '';
      return ADDITIONAL_BLENDSHAPES.includes(name);
    });
    
    if (additionalData.length > 0) {
      additionalData.forEach((bs: any) => {
        const name = bs.categoryName || bs.category || bs.name;
        const score = bs.score || bs.value || 0;
        html += `<span class="blendshapeValue">${name}:</span> ${score.toFixed(3)}<br/>`;
      });
    }
    
    return html;
  };

  const displayBlendshapesAsNumbers = (blendshapes: number[]): string => {
    let html = '';
    
    TARGET_BLENDSHAPES.forEach(targetName => {
      const index = BLENDSHAPE_NAMES.indexOf(targetName);
      if (index !== -1 && index < blendshapes.length) {
        const score = blendshapes[index];
        html += `<span class="blendshapeValue">${targetName}:</span> ${score.toFixed(3)}<br/>`;
      }
    });
    
    html += '<br/><strong>Additional Pronunciation Blendshapes:</strong><br/>';
    ADDITIONAL_BLENDSHAPES.forEach(targetName => {
      const index = BLENDSHAPE_NAMES.indexOf(targetName);
      if (index !== -1 && index < blendshapes.length) {
        const score = blendshapes[index];
        html += `<span class="blendshapeValue">${targetName}:</span> ${score.toFixed(3)}<br/>`;
      }
    });
    
    return html;
  };

  const updateLandmarksDisplay = (results: any) => {
    const displayElement = document.getElementById('landmarks-display');
    
    if (!displayElement) return;
    if (!results) {
      displayElement.innerHTML = '<div>No results available</div>';
      return;
    }
    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      displayElement.innerHTML = '<div>No face detected</div>';
      return;
    }

    const allLandmarks = results.faceLandmarks[0];
    const trackedLandmarks = extractTrackedLandmarks(allLandmarks);
    let blendshapes = extractBlendshapes(results);
    
    if (blendshapes.length > 0 && typeof blendshapes[0] === 'number') {
      blendshapes = smoothBlendshapes(blendshapes);
    }

    let displayHTML = '<div><strong>Live Stream Mode</strong><br/>';
    
    displayHTML += '<strong>Face Anchors (Head Pose):</strong><br/>';
    trackedLandmarks.slice(0, 3).forEach((landmark: any) => {
      const label = landmark.index === 1 ? 'Nose' : landmark.index === 133 ? 'L Eye Inner' : 'R Eye Inner';
      displayHTML += `<span class="landmarkPoint">${label} [${landmark.index}]:</span> (${landmark.x.toFixed(3)}, ${landmark.y.toFixed(3)}, ${landmark.z.toFixed(3)})<br/>`;
    });
    
    displayHTML += '<br/><strong>Outer Lip Landmarks (20 points):</strong><br/>';
    const outerLipLandmarks = trackedLandmarks.slice(3, 23);
    outerLipLandmarks.forEach((landmark: any) => {
      displayHTML += `<span class="landmarkPoint">[${landmark.index}]:</span> (${landmark.x.toFixed(3)}, ${landmark.y.toFixed(3)}, ${landmark.z.toFixed(3)})<br/>`;
    });
    
    displayHTML += '<br/><strong>Inner Lip Landmarks (20 points):</strong><br/>';
    const innerLipLandmarks = trackedLandmarks.slice(23);
    innerLipLandmarks.forEach((landmark: any) => {
      displayHTML += `<span class="landmarkPoint">[${landmark.index}]:</span> (${landmark.x.toFixed(3)}, ${landmark.y.toFixed(3)}, ${landmark.z.toFixed(3)})<br/>`;
    });
    
    displayHTML += `<br/><strong>Total Tracked:</strong> 43 points (3 face + 40 mouth) / 478<br/><br/>`;
    
    if (blendshapes.length > 0) {
      displayHTML += '<strong>Face Blend Shapes:</strong><br/>';
      
      if (typeof blendshapes[0] === 'number') {
        displayHTML += displayBlendshapesAsNumbers(blendshapes);
      } else if (typeof blendshapes[0] === 'object' && blendshapes[0] !== null) {
        displayHTML += displayBlendshapesAsObjects(blendshapes);
      } else {
        displayHTML += 'Unsupported blendshapes format<br/>';
      }
    } else {
      displayHTML += '<strong>Face Blend Shapes:</strong> No blendshapes data<br/>';
    }
    
    displayHTML += '</div>';
    displayElement.innerHTML = displayHTML;
  };

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        if (!videoRef.current || !canvasRef.current) {
          console.error('Video or canvas ref not available');
          return;
        }

        // Import MediaPipe
        const vision = await import("@mediapipe/tasks-vision");
        const { FaceLandmarker, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // Create FaceLandmarker
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5
        });

        // Camera class for managing video stream
        class Camera {
          video: HTMLVideoElement;
          options: any;
          isProcessing: boolean = false;
          
          constructor(video: HTMLVideoElement, options: any) {
            this.video = video;
            this.options = options;
          }
          
          async start() {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.play();
            
            // Wait for video metadata
            await new Promise((resolve) => {
              this.video.onloadedmetadata = () => resolve(void 0);
            });
            
            // Start frame processing
            const onFrame = () => {
              if (this.options.onFrame && !this.isProcessing) {
                this.isProcessing = true;
                this.options.onFrame().finally(() => {
                  this.isProcessing = false;
                });
              }
              requestAnimationFrame(onFrame);
            };
            onFrame();
          }
        }

        // Initialize camera
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && canvasRef.current) {
              // Skip if video not ready
              if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
                return;
              }
              
              try {
                const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());
              
                // Draw on canvas
              if (canvasRef.current) {
                const canvasCtx = canvasRef.current.getContext('2d');
                if (canvasCtx) {
                  canvasCtx.save();
                  canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  canvasCtx.drawImage(
                    videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height
                  );
                  
                    // Draw tracked landmarks and mouth overlay
                    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                      const allLandmarks = results.faceLandmarks[0];
                      
                      const w = canvasRef.current!.width;
                      const h = canvasRef.current!.height;
                      
                      const toCanvas = (p: LandmarkPoint) => ({ x: p.x * w, y: p.y * h });
                      
                      // Draw live mouth overlay with full detail (20 points per contour)
                      // Outer lip contour - smooth, natural shape
                      const outerLipPoints = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
                      canvasCtx.strokeStyle = '#f04299';
                      canvasCtx.lineWidth = 2;
                      canvasCtx.lineCap = 'round';
                      canvasCtx.lineJoin = 'round';
                      canvasCtx.beginPath();
                      outerLipPoints.forEach((index, i) => {
                        const point = toCanvas(allLandmarks[index]);
                        i === 0 ? canvasCtx.moveTo(point.x, point.y) : canvasCtx.lineTo(point.x, point.y);
                      });
                      canvasCtx.closePath();
                      canvasCtx.stroke();
                      
                      // Inner lip contour - adds depth
                      const innerLipPoints = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
                      canvasCtx.strokeStyle = '#f04299';
                      canvasCtx.lineWidth = 1.5;
                      canvasCtx.beginPath();
                      innerLipPoints.forEach((index, i) => {
                        const point = toCanvas(allLandmarks[index]);
                        i === 0 ? canvasCtx.moveTo(point.x, point.y) : canvasCtx.lineTo(point.x, point.y);
                      });
                      canvasCtx.closePath();
                      canvasCtx.stroke();
                      
                      // Draw landmarks
                      canvasCtx.fillStyle = '#4299f0';
                      FACE_ANCHORS.forEach(index => {
                        const p = toCanvas(allLandmarks[index]);
                        canvasCtx.beginPath();
                        canvasCtx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
                        canvasCtx.fill();
                      });
                      
                      canvasCtx.fillStyle = '#ff8800';
                      MOUTH_LANDMARKS.forEach(index => {
                        const p = toCanvas(allLandmarks[index]);
                        canvasCtx.beginPath();
                        canvasCtx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
                        canvasCtx.fill();
                      });

        // Now let's compute the actual target overlay with proper transformation
        const targetLandmarks = computeTargetLandmarks(allLandmarks, TARGET_VOWEL);
        
        const targetOuterLipIds = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
        const targetInnerLipIds = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
        
        
        // Draw target overlay using computed target landmarks
        canvasCtx.strokeStyle = '#00FF00';
        canvasCtx.lineWidth = 3;
        canvasCtx.setLineDash([]);
        canvasCtx.lineCap = 'round';
        canvasCtx.lineJoin = 'round';
        
        // Draw target outer lip contour using computed target landmarks
        canvasCtx.beginPath();
        targetOuterLipIds.forEach((index, i) => {
          const landmark = targetLandmarks[index];
          if (landmark) {
            const point = toCanvas(landmark);
            if (i === 0) {
              canvasCtx.moveTo(point.x, point.y);
            } else {
              canvasCtx.lineTo(point.x, point.y);
            }
          }
        });
        canvasCtx.closePath();
        canvasCtx.stroke();
        
        // Draw target inner lip contour using computed target landmarks
        canvasCtx.strokeStyle = '#00FF00';
        canvasCtx.lineWidth = 2;
        canvasCtx.beginPath();
        targetInnerLipIds.forEach((index, i) => {
          const landmark = targetLandmarks[index];
          if (landmark) {
            const point = toCanvas(landmark);
            if (i === 0) {
              canvasCtx.moveTo(point.x, point.y);
            } else {
              canvasCtx.lineTo(point.x, point.y);
            }
          }
        });
        canvasCtx.closePath();
        canvasCtx.stroke();

                      // Draw vowel label
                      canvasCtx.save();
                      const labelLandmark = targetLandmarks[0];
                      if (labelLandmark) {
                        const labelPos = toCanvas(labelLandmark);
                        canvasCtx.translate(labelPos.x - 40, labelPos.y);
                        canvasCtx.scale(-1, 1);
                        
                        canvasCtx.font = 'bold 28px Arial';
                        canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                        canvasCtx.lineWidth = 4;
                        canvasCtx.strokeText(TARGET_VOWEL, 0, 0);
                        
                        canvasCtx.fillStyle = 'rgba(0, 255, 100, 1)';
                        canvasCtx.fillText(TARGET_VOWEL, 0, 0);
                      }
                      canvasCtx.restore();
                    }
                    
                    canvasCtx.restore();
                  }
                }
                
                if (onResults) {
                  const processedResults = {
                    landmarks: results.faceLandmarks?.[0]?.map(lm => ({
                      x: lm.x,
                      y: lm.y,
                      z: lm.z
                    })),
                    blendshapes: results.faceBlendshapes?.[0]?.categories?.reduce((acc, category) => {
                      acc[category.categoryName] = category.score;
                      return acc;
                    }, {} as Record<string, number>)
                  };
                  onResults(processedResults);
                }
                
                updateLandmarksDisplay(results);
                
              } catch (error) {
                console.error('Error processing frame:', error);
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
        console.error('Camera initialization failed:', err);
        setError(`Camera initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
          height: '100%',
          transform: 'scaleX(-1)'
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
          Initializing camera...
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
