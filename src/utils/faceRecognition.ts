export function compareFaceFeatures(features1: Float32Array, features2: Float32Array): number {
  return euclideanDistance(features1, features2);
}

export const FACE_MATCH_THRESHOLD = 0.6;

// Helper function to calculate Euclidean distance between two Float32Arrays
function euclideanDistance(arr1: Float32Array, arr2: Float32Array): number {
  if (arr1.length !== arr2.length) {
    throw new Error('Arrays must have equal length');
  }

  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}