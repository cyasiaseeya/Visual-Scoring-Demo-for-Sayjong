# SayJong - Visual Vowel Pronunciation Training

A real-time facial landmark tracking system for Korean vowel pronunciation training using MediaPipe and computer vision.

## How It Works

### 1. Face Anchoring System

The system uses a rigid head anchor with directional vectors to track your head movements and keep the vowel overlay perfectly positioned on your mouth.

#### Anchor Points
- **Nose tip** (landmark #1): Origin of coordinate system
- **Left eye inner corner** (landmark #133): Defines horizontal axis
- **Right eye inner corner** (landmark #362): Defines horizontal axis

#### 3D Coordinate System Construction
The system builds an orthonormal basis (3D coordinate frame) using three directional vectors:

```
1. Right Vector (X-axis)
   - Direction: Left eye inner → Right eye inner
   - Normalized: Yes (unit length)
   - Purpose: Defines horizontal direction across face

2. Down Vector (Temporary)
   - Direction: Eye center → Nose tip
   - Normalized: Yes (unit length)
   - Purpose: Defines face plane orientation

3. Forward Vector (Z-axis)
   - Computed: Right × Down (cross product)
   - Direction: Points out from face (perpendicular to face plane)
   - Purpose: Defines depth direction

4. Up Vector (Y-axis)
   - Computed: Forward × Right (cross product)
   - Direction: Points up along face
   - Purpose: Completes orthonormal basis
```

#### How the Anchor Works
```
1. Compute coordinate system for calibrated data (from vowel_calibration.json)
   - Origin: Calibrated nose position
   - Basis: Right, Up, Forward vectors from calibration

2. Compute coordinate system for live data (from camera)
   - Origin: Current nose position
   - Basis: Right, Up, Forward vectors from current frame

3. Transform overlay points:
   a. Express calibrated point relative to calibrated origin
   b. Convert to local coordinates using calibrated basis
   c. Scale by face size ratio (inter-eye distance)
   d. Convert back to world coordinates using live basis
   e. Add to live origin

4. Result: Overlay follows head rotation, tilt, and scale automatically
```

### 2. Scaling Factor

The system automatically adjusts the overlay size based on your face size.

#### Scale Calculation
```
Scale Factor = Your Face Width / Calibrated Face Width

Where:
- Face Width = Distance between left and right eye inner corners
- This ensures the overlay fits your mouth perfectly regardless of face size
```

#### Why This Matters
- Works for different face sizes (adults, children)
- Works at different distances from camera
- Maintains accurate overlay positioning

### 3. Target Vowel Calculation

The system supports two types of vowel generation:

#### A. Calibrated Vowels (Direct Data)
For vowels ㅏ, ㅜ, ㅣ:
- Uses your actual captured mouth shapes from calibration
- 100% accurate to your pronunciation
- No interpolation needed

```typescript
// Direct access to your calibrated data
const coords = calibrationData['a'].landmarks[landmarkId];
staticTargetShape[id] = [coords[0], coords[1], coords[2]];
```

#### B. Interpolated Vowels (Coefficient-Based)
For other vowels (ㅓ, ㅔ, ㅐ, ㅗ, ㅛ, ㅠ, ㅡ):
- Uses phonetic coefficients to blend between calibrated vowels
- Formula: Target = Neutral + (open × ㅏ_delta) + (round × ㅜ_delta) + (spread × ㅣ_delta)

```typescript
// Example for ㅔ (eh sound)
const coeffs = { open: 0.40, round: 0.0, spread: 0.70 };
staticTargetShape[id] = [
  neutral[0] + 0.40 * (ㅏ[0] - neutral[0]) + 0.70 * (ㅣ[0] - neutral[0]),
  neutral[1] + 0.40 * (ㅏ[1] - neutral[1]) + 0.70 * (ㅣ[1] - neutral[1]),
  neutral[2] + 0.40 * (ㅏ[2] - neutral[2]) + 0.70 * (ㅣ[2] - neutral[2])
];
```

### 4. Real-Time Processing Pipeline

```
1. Capture video frame
   ↓
2. Detect face landmarks (478 points)
   ↓
3. Extract tracked landmarks (43 points: 3 face + 40 mouth)
   ↓
4. Compute head pose (origin, rotation, scale)
   ↓
5. Calculate target vowel shape
   ↓
6. Transform overlay to match current head position
   ↓
7. Render overlay on canvas
```

## Visual Features

### Live Tracking
- **Blue dots**: Face anchor points (nose and eyes)
- **Orange dots**: Real-time mouth landmarks (40 points)
- **Pink overlay**: Live mouth contour
- **Green overlay**: Target vowel shape

### Overlay Rendering
- **Static shape**: Target vowel doesn't change shape
- **Follows head**: Overlay moves with your head movements
- **Perfect alignment**: Always positioned correctly on your mouth

## Technical Details

### Landmark Tracking
- **Total landmarks**: 43 points
  - 3 face anchors (nose, eyes)
  - 20 outer lip points
  - 20 inner lip points
- **Update rate**: Real-time (30+ FPS)
- **Accuracy**: Sub-pixel precision

### Coordinate System
- **Origin**: Nose tip
- **Units**: Normalized coordinates (0.0 - 1.0)
- **Z-depth**: 3D positioning for accurate overlay

### Performance
- **Smooth tracking**: EMA filtering for stable results
- **Low latency**: Optimized for real-time use
- **Cross-platform**: Works on desktop and mobile

## Getting Started

1. **Run the application**
   ```bash
   npm install
   npm run dev
   ```

2. **Calibrate your vowels** (first time only)
   - Click "Calibration Tool"
   - Follow prompts to capture neutral, ㅏ, ㅜ, ㅣ poses
   - Download the calibration file

3. **Practice pronunciation**
   - Click "Practice Mode"
   - See real-time overlay for target vowel
   - Adjust your mouth shape to match the overlay

## File Structure

```
src/
├── Components/
│   ├── CameraComponent.tsx      # Main tracking component
│   ├── CalibrationCapture.tsx   # Calibration tool
│   ├── Header.tsx              # App header
│   └── Footer.tsx              # App footer
├── constants/
│   └── landmarks.ts            # Landmark definitions
├── vowelModel_mono.ts          # Vowel calculation logic
├── vowel_calibration.json      # Your calibrated data
└── App.tsx                     # Main app component
```

## Key Benefits

- **Personalized**: Uses your actual mouth shapes
- **Real-time**: Instant feedback during practice
- **Accurate**: Sub-pixel landmark tracking
- **Stable**: Robust head pose estimation
- **Flexible**: Works with any face size or camera distance

---

*Built with MediaPipe, React, and TypeScript for precise Korean vowel pronunciation training.*

---

## 한국어 버전 (Korean Version)

# SayJong - 시각적 모음 발음 훈련 시스템

MediaPipe와 컴퓨터 비전을 사용한 한국어 모음 발음 훈련을 위한 실시간 얼굴 랜드마크 추적 시스템입니다.

## 작동 원리

### 1. 얼굴 앵커링 시스템

시스템은 방향 벡터를 사용한 강체 머리 앵커로 머리 움직임을 추적하고 모음 오버레이를 입에 완벽하게 위치시킵니다.

#### 앵커 포인트
- **코 끝** (랜드마크 #1): 좌표계의 원점
- **왼쪽 눈 안쪽 모서리** (랜드마크 #133): 수평 축 정의
- **오른쪽 눈 안쪽 모서리** (랜드마크 #362): 수평 축 정의

#### 3D 좌표계 구성
시스템은 세 개의 방향 벡터를 사용하여 정규직교 기저(3D 좌표 프레임)를 구축합니다:

```
1. 오른쪽 벡터 (X축)
   - 방향: 왼쪽 눈 안쪽 → 오른쪽 눈 안쪽
   - 정규화: 예 (단위 길이)
   - 목적: 얼굴의 수평 방향 정의

2. 아래쪽 벡터 (임시)
   - 방향: 눈 중심 → 코 끝
   - 정규화: 예 (단위 길이)
   - 목적: 얼굴 평면 방향 정의

3. 앞쪽 벡터 (Z축)
   - 계산: 오른쪽 × 아래쪽 (외적)
   - 방향: 얼굴에서 바깥쪽으로 (얼굴 평면에 수직)
   - 목적: 깊이 방향 정의

4. 위쪽 벡터 (Y축)
   - 계산: 앞쪽 × 오른쪽 (외적)
   - 방향: 얼굴을 따라 위쪽
   - 목적: 정규직교 기저 완성
```

#### 앵커 작동 방식
```
1. 교정 데이터의 좌표계 계산 (vowel_calibration.json에서)
   - 원점: 교정된 코 위치
   - 기저: 교정의 오른쪽, 위쪽, 앞쪽 벡터

2. 실시간 데이터의 좌표계 계산 (카메라에서)
   - 원점: 현재 코 위치
   - 기저: 현재 프레임의 오른쪽, 위쪽, 앞쪽 벡터

3. 오버레이 포인트 변환:
   a. 교정된 원점에 대해 교정된 포인트 표현
   b. 교정된 기저를 사용하여 로컬 좌표로 변환
   c. 얼굴 크기 비율로 스케일 (눈 사이 거리)
   d. 실시간 기저를 사용하여 월드 좌표로 다시 변환
   e. 실시간 원점에 추가

4. 결과: 오버레이가 머리 회전, 기울기, 스케일을 자동으로 따름
```

### 2. 스케일링 팩터

시스템은 얼굴 크기에 따라 오버레이 크기를 자동으로 조정합니다.

#### 스케일 계산
```
스케일 팩터 = 현재 얼굴 너비 / 교정된 얼굴 너비

여기서:
- 얼굴 너비 = 왼쪽과 오른쪽 눈 안쪽 모서리 사이의 거리
- 이는 얼굴 크기에 관계없이 오버레이가 입에 완벽하게 맞도록 보장
```

#### 이것이 중요한 이유
- 다양한 얼굴 크기에서 작동 (성인, 어린이)
- 카메라로부터의 다양한 거리에서 작동
- 정확한 오버레이 위치 유지

### 3. 목표 모음 계산

시스템은 두 가지 유형의 모음 생성을 지원합니다:

#### A. 교정된 모음 (직접 데이터)
모음 ㅏ, ㅜ, ㅣ의 경우:
- 교정에서 캡처한 실제 입 모양 사용
- 발음에 대해 100% 정확
- 보간이 필요 없음

```typescript
// 교정된 데이터에 직접 접근
const coords = calibrationData['a'].landmarks[landmarkId];
staticTargetShape[id] = [coords[0], coords[1], coords[2]];
```

#### B. 보간된 모음 (계수 기반)
다른 모음 (ㅓ, ㅔ, ㅐ, ㅗ, ㅛ, ㅠ, ㅡ)의 경우:
- 음성학적 계수를 사용하여 교정된 모음 간 블렌딩
- 공식: 목표 = 중립 + (열기 × ㅏ_델타) + (둥글기 × ㅜ_델타) + (퍼짐 × ㅣ_델타)

```typescript
// ㅔ (에 소리) 예시
const coeffs = { open: 0.40, round: 0.0, spread: 0.70 };
staticTargetShape[id] = [
  neutral[0] + 0.40 * (ㅏ[0] - neutral[0]) + 0.70 * (ㅣ[0] - neutral[0]),
  neutral[1] + 0.40 * (ㅏ[1] - neutral[1]) + 0.70 * (ㅣ[1] - neutral[1]),
  neutral[2] + 0.40 * (ㅏ[2] - neutral[2]) + 0.70 * (ㅣ[2] - neutral[2])
];
```

### 4. 실시간 처리 파이프라인

```
1. 비디오 프레임 캡처
   ↓
2. 얼굴 랜드마크 감지 (478개 점)
   ↓
3. 추적된 랜드마크 추출 (43개 점: 얼굴 3개 + 입 40개)
   ↓
4. 머리 포즈 계산 (원점, 회전, 스케일)
   ↓
5. 목표 모음 모양 계산
   ↓
6. 현재 머리 위치에 맞게 오버레이 변환
   ↓
7. 캔버스에 오버레이 렌더링
```

## 시각적 기능

### 실시간 추적
- **파란 점**: 얼굴 앵커 포인트 (코와 눈)
- **주황 점**: 실시간 입 랜드마크 (40개 점)
- **분홍 오버레이**: 실시간 입 윤곽
- **초록 오버레이**: 목표 모음 모양

### 오버레이 렌더링
- **정적 모양**: 목표 모음이 모양을 바꾸지 않음
- **머리 추적**: 오버레이가 머리 움직임에 따라 이동
- **완벽한 정렬**: 항상 입에 정확하게 위치

## 기술적 세부사항

### 랜드마크 추적
- **총 랜드마크**: 43개 점
  - 3개 얼굴 앵커 (코, 눈)
  - 20개 외부 입술 점
  - 20개 내부 입술 점
- **업데이트 속도**: 실시간 (30+ FPS)
- **정확도**: 서브픽셀 정밀도

### 좌표계
- **원점**: 코 끝
- **단위**: 정규화된 좌표 (0.0 - 1.0)
- **Z 깊이**: 정확한 오버레이를 위한 3D 위치

### 성능
- **부드러운 추적**: 안정적인 결과를 위한 EMA 필터링
- **낮은 지연시간**: 실시간 사용에 최적화
- **크로스 플랫폼**: 데스크톱과 모바일에서 작동

## 시작하기

1. **애플리케이션 실행**
   ```bash
   npm install
   npm run dev
   ```

2. **모음 교정** (최초 1회만)
   - "Calibration Tool" 클릭
   - 중립, ㅏ, ㅜ, ㅣ 포즈 캡처 프롬프트 따르기
   - 교정 파일 다운로드

3. **발음 연습**
   - "Practice Mode" 클릭
   - 목표 모음에 대한 실시간 오버레이 확인
   - 입 모양을 오버레이에 맞게 조정

## 파일 구조

```
src/
├── Components/
│   ├── CameraComponent.tsx      # 메인 추적 컴포넌트
│   ├── CalibrationCapture.tsx   # 교정 도구
│   ├── Header.tsx              # 앱 헤더
│   └── Footer.tsx              # 앱 푸터
├── constants/
│   └── landmarks.ts            # 랜드마크 정의
├── vowelModel_mono.ts          # 모음 계산 로직
├── vowel_calibration.json      # 교정된 데이터
└── App.tsx                     # 메인 앱 컴포넌트
```

## 주요 장점

- **개인화**: 실제 입 모양 사용
- **실시간**: 연습 중 즉시 피드백
- **정확함**: 서브픽셀 랜드마크 추적
- **안정적**: 강력한 머리 포즈 추정
- **유연함**: 모든 얼굴 크기나 카메라 거리에서 작동

---

*정확한 한국어 모음 발음 훈련을 위해 MediaPipe, React, TypeScript로 구축됨*