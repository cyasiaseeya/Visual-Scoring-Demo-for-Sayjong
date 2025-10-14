/**
 * MediaPipe Face Landmark Constants
 * 
 * This file contains all landmark indices used for face tracking and mouth overlay.
 * Based on MediaPipe's 478-point face mesh model.
 */

/**
 * Face anchor points for head pose estimation
 * - 1: Nose tip
 * - 133: Left eye inner corner
 * - 362: Right eye inner corner
 */
export const FACE_ANCHORS = [1, 133, 362];

/**
 * Outer lip contour landmarks (20 points)
 * Forms the outer boundary of the mouth
 */
export const OUTER_LIP_LANDMARKS = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146
];

/**
 * Inner lip contour landmarks (20 points)
 * Forms the inner boundary of the mouth (teeth line)
 */
export const INNER_LIP_LANDMARKS = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 
  308, 324, 318, 402, 317, 14, 87, 178, 88, 95
];

/**
 * All mouth landmarks (40 points total)
 * Combines outer and inner lip landmarks
 */
export const MOUTH_LANDMARKS = [...OUTER_LIP_LANDMARKS, ...INNER_LIP_LANDMARKS];

/**
 * All tracked landmarks (43 points total)
 * Combines face anchors and mouth landmarks
 */
export const ALL_TRACKED_LANDMARKS = [...FACE_ANCHORS, ...MOUTH_LANDMARKS];

