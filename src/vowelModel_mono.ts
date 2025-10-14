/**
 * vowelModel_mono.ts
 * 
 * Korean Monophthong (단모음) Vowel Model
 * 
 * This module computes normalized articulatory features from facial landmarks
 * and models 12 Korean monophthongs using a 3D basis derived from calibration data.
 * 
 * Features:
 *   A (Aperture) - Vertical mouth opening normalized by eye distance
 *   W (Width)    - Horizontal mouth width normalized by eye distance
 *   P (Pucker)   - Inverse of width (lip rounding/protrusion)
 * 
 * Basis vectors (derived from calibration):
 *   open   - ㅏ movement (jaw opening)
 *   round  - ㅜ movement (lip rounding)
 *   spread - ㅣ movement (lip spreading)
 * 
 * Usage:
 *   import { computeFeatures, computeVowelBasis, vowelTarget } from './vowelModel_mono';
 *   
 *   const basis = computeVowelBasis(calibrationData);
 *   const targetFeatures = vowelTarget('ㅏ', basis);
 */

// Browser-compatible version - removed Node.js imports

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 3D feature vector representing mouth configuration
 */
export interface FeatureVec {
  A: number;  // Aperture (vertical opening)
  W: number;  // Width (horizontal spread)
  P: number;  // Pucker (lip rounding)
}

/**
 * Coefficients for vowel synthesis in basis space
 */
export interface Coeffs {
  open: number;    // Contribution from ㅏ (jaw opening)
  round: number;   // Contribution from ㅜ (lip rounding)
  spread: number;  // Contribution from ㅣ (lip spreading)
}

/**
 * Vowel basis derived from calibration data
 */
export interface VowelBasis {
  open: number[];     // ㅏ direction vector [ΔA, ΔW, ΔP]
  round: number[];    // ㅜ direction vector [ΔA, ΔW, ΔP]
  spread: number[];   // ㅣ direction vector [ΔA, ΔW, ΔP]
  features: {
    neutral: FeatureVec;
    a: FeatureVec;
    u: FeatureVec;
    i: FeatureVec;
  };
  rates: {
    openRate: number;   // Rate of change for opening
    roundRate: number;  // Rate of change for rounding
    spreadRate: number; // Rate of change for spreading
  };
}

/**
 * Calibration frame structure
 */
interface CalibrationFrame {
  landmarks: Record<number, [number, number, number]>;
  blendshapes?: Record<string, number>;
}

/**
 * Calibration JSON structure
 */
interface CalibrationJSON {
  neutral: CalibrationFrame;
  a: CalibrationFrame;
  u: CalibrationFrame;
  i: CalibrationFrame;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Required landmark indices for feature computation
 */
const REQUIRED_LANDMARKS = [1, 133, 362, 61, 291, 0, 13, 14, 17, 39, 81, 269, 311, 402, 405, 178, 181];

/**
 * Time constant for rate computation (seconds)
 */
const T0 = 0.2;

/**
 * Small epsilon for numerical stability
 */
const EPSILON = 1e-6;

/**
 * Empirically-derived coefficients for 12 Korean monophthongs (단모음)
 * 
 * Each vowel is represented as a linear combination of three basis movements:
 *   - open:   jaw opening (ㅏ direction)
 *   - round:  lip rounding (ㅜ direction)
 *   - spread: lip spreading (ㅣ direction)
 * 
 * Coefficients are derived from visual phonetics and articulatory studies.
 */
export const VOWEL_COEFFS_MONO: Record<string, Coeffs> = {
  // Pure monophthongs (excluding ㅏ, ㅜ, ㅣ - these use calibrated data)
  'ㅓ': { open: 0.55, spread: 0.0,   round: 0.0  },  // [ʌ] Mid-low back unrounded
  'ㅔ': { open: 0.40, spread: 0.70,  round: 0.0  },  // [e̞] Mid front unrounded
  'ㅐ': { open: 0.42, spread: 0.68,  round: 0.0  },  // [ɛ] → [e̞] (merged with ㅔ for most speakers)
  'ㅗ': { open: 0.35, spread: -0.15, round: 0.85 },  // [o] Mid-high back rounded (raised)
  'ㅛ': { open: 0.25, spread: -0.10, round: 0.90 },  // [jo] Diphthong, but mid back rounded
  'ㅠ': { open: 0.12, spread: 0.15,  round: 0.98 },  // [ju] Diphthong, but high rounded
  'ㅡ': { open: 0.20, spread: 0.0,   round: 0.0  },  // [ɯ] High back unrounded (fronted to [ɯ̟])
};

// ============================================================================
// Vector Math Utilities
// ============================================================================

/**
 * Computes Euclidean distance between two 3D points
 */
function distance3D(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Computes average Y coordinate of multiple landmarks
 */
function avgY(landmarks: Record<number, [number, number, number]>, indices: number[]): number {
  let sum = 0;
  for (const idx of indices) {
    sum += landmarks[idx][1];
  }
  return sum / indices.length;
}

/**
 * Converts FeatureVec to array [A, W, P]
 */
function featureToArray(f: FeatureVec): number[] {
  return [f.A, f.W, f.P];
}

/**
 * Converts array [A, W, P] to FeatureVec
 */
function arrayToFeature(arr: number[]): FeatureVec {
  return { A: arr[0], W: arr[1], P: arr[2] };
}

/**
 * Subtracts two feature vectors
 */
function subtractFeatures(f1: FeatureVec, f2: FeatureVec): number[] {
  return [f1.A - f2.A, f1.W - f2.W, f1.P - f2.P];
}

/**
 * Computes L2 norm of a vector
 */
function norm(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
}

/**
 * Adds vectors: result = base + c1*v1 + c2*v2 + c3*v3
 */
function addScaledVectors(
  base: number[],
  c1: number, v1: number[],
  c2: number, v2: number[],
  c3: number, v3: number[]
): number[] {
  return [
    base[0] + c1 * v1[0] + c2 * v2[0] + c3 * v3[0],
    base[1] + c1 * v1[1] + c2 * v2[1] + c3 * v3[1],
    base[2] + c1 * v1[2] + c2 * v2[2] + c3 * v3[2],
  ];
}

// ============================================================================
// Feature Computation
// ============================================================================

/**
 * Computes normalized articulatory features from facial landmarks
 * 
 * @param landmarks - Dictionary mapping landmark indices to [x, y, z] coordinates
 * @returns FeatureVec with A (aperture), W (width), P (pucker)
 * 
 * Feature definitions:
 *   eyeDistance = ||[133] - [362]||  (normalization factor)
 *   W = ||[61] - [291]|| / eyeDistance  (mouth width)
 *   U = avgY([13], [81], [178])  (upper lip center Y)
 *   L = avgY([14], [311], [405])  (lower lip center Y)
 *   A = (L - U) / eyeDistance  (vertical opening)
 *   P = 1 / max(W, ε)  (inverse width, represents rounding)
 */
export function computeFeatures(landmarks: Record<number, [number, number, number]>): FeatureVec {
  // Validate required landmarks
  for (const idx of REQUIRED_LANDMARKS) {
    if (!(idx in landmarks)) {
      throw new Error(`Missing required landmark: ${idx}`);
    }
  }

  // Compute eye distance (normalization factor)
  const eyeDistance = distance3D(landmarks[133], landmarks[362]);
  
  if (eyeDistance < EPSILON) {
    throw new Error('Eye distance too small for normalization');
  }

  // Compute mouth width
  const mouthWidth = distance3D(landmarks[61], landmarks[291]);
  const W = mouthWidth / eyeDistance;

  // Compute upper lip center (average Y of upper lip landmarks)
  const U = avgY(landmarks, [13, 81, 178]);

  // Compute lower lip center (average Y of lower lip landmarks)
  const L = avgY(landmarks, [14, 311, 405]);

  // Compute aperture (vertical opening)
  const A = (L - U) / eyeDistance;

  // Compute pucker (inverse of width)
  const P = 1.0 / Math.max(W, EPSILON);

  return { A, W, P };
}

// ============================================================================
// Vowel Basis Computation
// ============================================================================

/**
 * Computes vowel basis from calibration data
 * 
 * @param cal - Calibration JSON containing neutral, a, u, i frames
 * @returns VowelBasis with basis vectors, features, and rates
 * 
 * Process:
 *   1. Compute features for each calibration vowel
 *   2. Compute basis vectors as differences from neutral:
 *      - open   = a.features - neutral.features
 *      - round  = u.features - neutral.features
 *      - spread = i.features - neutral.features
 *   3. Compute rate magnitudes: rate = ||basis|| / T0
 */
export function computeVowelBasis(cal: CalibrationJSON): VowelBasis {
  // Compute features for each calibration vowel
  const neutralFeatures = computeFeatures(cal.neutral.landmarks);
  const aFeatures = computeFeatures(cal.a.landmarks);
  const uFeatures = computeFeatures(cal.u.landmarks);
  const iFeatures = computeFeatures(cal.i.landmarks);

  // Compute basis vectors (differences from neutral)
  const open = subtractFeatures(aFeatures, neutralFeatures);
  const round = subtractFeatures(uFeatures, neutralFeatures);
  const spread = subtractFeatures(iFeatures, neutralFeatures);

  // Compute rate magnitudes
  const openRate = norm(open) / T0;
  const roundRate = norm(round) / T0;
  const spreadRate = norm(spread) / T0;

  return {
    open,
    round,
    spread,
    features: {
      neutral: neutralFeatures,
      a: aFeatures,
      u: uFeatures,
      i: iFeatures,
    },
    rates: {
      openRate,
      roundRate,
      spreadRate,
    },
  };
}

// ============================================================================
// Vowel Target Computation
// ============================================================================

/**
 * Computes target features for a given Korean vowel
 * 
 * @param vowel - Korean vowel character (e.g., 'ㅏ', 'ㅜ', 'ㅣ')
 * @param basis - Vowel basis computed from calibration
 * @returns FeatureVec representing target mouth configuration
 * 
 * Formula:
 *   Fv = F0 + c_open * open + c_round * round + c_spread * spread
 * 
 * where coefficients come from VOWEL_COEFFS_MONO
 */
export function vowelTarget(vowel: string, basis: VowelBasis): FeatureVec {
  if (!(vowel in VOWEL_COEFFS_MONO)) {
    throw new Error(`Unknown vowel: ${vowel}. Must be one of: ${Object.keys(VOWEL_COEFFS_MONO).join(', ')}`);
  }

  const coeffs = VOWEL_COEFFS_MONO[vowel];
  const F0 = featureToArray(basis.features.neutral);

  // Compute target: F0 + linear combination of basis vectors
  const targetArray = addScaledVectors(
    F0,
    coeffs.open, basis.open,
    coeffs.round, basis.round,
    coeffs.spread, basis.spread
  );

  return arrayToFeature(targetArray);
}

// ============================================================================
// Diagnostic Output
// ============================================================================

/**
 * Prints predicted features for all 12 Korean monophthongs
 * 
 * @param basis - Vowel basis computed from calibration
 * 
 * Output format:
 *   Vowel | open  | round | spread | A     | W     | P
 *   ------|-------|-------|--------|-------|-------|-------
 *   ㅏ    | 1.000 | 0.000 | 0.000  | 0.123 | 0.456 | 2.193
 *   ...
 */
export function printMonoVowels(basis: VowelBasis): void {
  console.log('\n' + '='.repeat(80));
  console.log('Korean Monophthongs (단모음) - Predicted Features');
  console.log('='.repeat(80));
  console.log('Vowel | open  | round | spread |   A   |   W   |   P   ');
  console.log('------|-------|-------|--------|-------|-------|-------');

  // Define vowel order for display (excluding ㅏ, ㅜ, ㅣ - these use calibrated data)
  const vowelOrder = ['ㅓ', 'ㅗ', 'ㅡ', 'ㅐ', 'ㅔ', 'ㅚ', 'ㅟ', 'ㅛ', 'ㅠ'];

  for (const vowel of vowelOrder) {
    const coeffs = VOWEL_COEFFS_MONO[vowel];
    const features = vowelTarget(vowel, basis);

    console.log(
      `  ${vowel}   | ${coeffs.open.toFixed(3)} | ${coeffs.round.toFixed(3)} | ${coeffs.spread.toFixed(3)}  | ` +
      `${features.A.toFixed(3)} | ${features.W.toFixed(3)} | ${features.P.toFixed(3)}`
    );
  }

  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// Export Summary
// ============================================================================

/**
 * This module provides:
 * - VOWEL_COEFFS_MONO: Coefficient definitions for vowel interpolation
 * - loadCalibrationData(): Load and validate calibration data
 * - computeVowelBasis(): Compute basis vectors from calibration
 * - vowelTarget(): Compute target features for any vowel
 * - printMonoVowels(): Diagnostic output for all vowels
 * 
 * Browser-compatible: No Node.js dependencies
 */

