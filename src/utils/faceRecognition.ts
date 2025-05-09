// Set threshold for face matching similarity (0.80 or higher required for a match)
export const FACE_MATCH_THRESHOLD = 0.20; // This means similarity >= 0.80

/**
 * Compares two face descriptor arrays and returns a similarity score
 * Higher value indicates more similarity (0 to 1 range)
 */
export function compareFaceFeatures(features1: Float32Array, features2: Float32Array): number {
  if (features1.length !== features2.length) {
    throw new Error('Face descriptor arrays must have the same length');
  }
  
  // Calculate Euclidean distance
  const distance = euclideanDistance(features1, features2);
  
  // Convert distance to similarity score (0-1 range where 1 is perfect match)
  return Math.max(0, Math.min(1, 1 - distance));
}

/**
 * Calculates the mean descriptor from multiple face descriptors
 * This helps create a more robust representation of a person's face
 */
export function calculateMeanDescriptor(descriptors: Float32Array[]): Float32Array {
  if (!descriptors.length) {
    throw new Error('Must provide at least one descriptor');
  }

  const length = descriptors[0].length;
  const meanDescriptor = new Float32Array(length);

  // Sum all values at each position
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const descriptor of descriptors) {
      sum += descriptor[i];
    }
    meanDescriptor[i] = sum / descriptors.length;
  }

  return meanDescriptor;
}

/**
 * Helper function to calculate Euclidean distance between two Float32Arrays
 * Lower values indicate more similarity
 */
function euclideanDistance(arr1: Float32Array, arr2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}