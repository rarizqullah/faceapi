'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Toast } from './Toast';

export default function FaceDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceFeatures, setFaceFeatures] = useState<Float32Array | null>(null);
  const [detectionMetrics, setDetectionMetrics] = useState<{
    accuracy: number;
    latencyMs: number;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Starting to load face-api models...');
        const modelPath = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        ]);
        console.log('Face-api models loaded successfully');
        setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    const setupCamera = async () => {
      try {
        console.log('Setting up camera...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('Camera stream set to video element');
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    loadModels();
    setupCamera();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoLoad = () => {
      console.log('Video element loaded data');
      setIsVideoReady(true);
    };

    video.addEventListener('loadeddata', handleVideoLoad);
    return () => {
      video.removeEventListener('loadeddata', handleVideoLoad);
    };
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady) {
      console.error('Video or canvas not ready');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Could not get canvas context');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    try {
      // Start timing
      const startTime = performance.now();
      
      context.drawImage(video, 0, 0);
      
      // Use more robust detection options
      const detection = await faceapi
        .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ 
          minConfidence: 0.8,  // Increased from 0.5 to 0.8
          maxResults: 1 
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      if (detection && detection.detection.score >= 0.8) {  // Added score threshold
        const accuracy = detection.detection.score;
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        
        setCapturedImage(imageDataUrl);
        setFaceFeatures(detection.descriptor);
        setDetectionMetrics({ accuracy, latencyMs });
        setIsCaptured(true);
        
        console.log('Face detection metrics:', { accuracy, latencyMs });
      } else {
        setToast({
          message: 'No face detected! Please try again.',
          type: 'error',
          isVisible: true
        });
      }
    } catch (error) {
      console.error('Error detecting faces:', error);
      setToast({
        message: 'Error detecting faces. Please try again.',
        type: 'error',
        isVisible: true
      });
    }
  };

  const sendAttendance = async () => {
    if (!capturedImage || !faceFeatures || !detectionMetrics) return;

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faceFeatures: Array.from(faceFeatures),
          timestamp: new Date().toISOString(),
          metrics: detectionMetrics
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setToast({
          message: data.message || 'Attendance recorded successfully!',
          type: 'success',
          isVisible: true
        });
        setIsCaptured(false);
        setCapturedImage(null);
        setFaceFeatures(null);
        setDetectionMetrics(null);
      } else {
        setToast({
          message: data.error || 'Failed to record attendance',
          type: 'error',
          isVisible: true
        });
      }
    } catch (error) {
      console.error('Error sending attendance:', error);
      setToast({
        message: 'Failed to send attendance data',
        type: 'error',
        isVisible: true
      });
    }
  };

  useEffect(() => {
    // Handle window resize and devicePixelRatio changes
    const handleResize = () => {
      if (videoRef.current && overlayCanvasRef.current) {
        const video = videoRef.current;
        const canvas = overlayCanvasRef.current;
        
        // Get the computed size of the video element
        const videoRect = video.getBoundingClientRect();
        
        // Set display size
        canvas.style.width = videoRect.width + 'px';
        canvas.style.height = videoRect.height + 'px';
        
        // Set actual size scaled by pixel ratio
        const dpr = window.devicePixelRatio || 1;
        canvas.width = videoRect.width * dpr;
        canvas.height = videoRect.height * dpr;
        
        // Scale the context to ensure correct drawing
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const detectFace = async () => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const context = canvas?.getContext('2d');
    
    if (!video || !canvas || !context || !isVideoReady) return;

    // Get video dimensions
    const displaySize = {
      width: video.videoWidth || video.clientWidth,
      height: video.videoHeight || video.clientHeight
    };

    // Validate dimensions
    if (displaySize.width === 0 || displaySize.height === 0) {
      console.warn('Invalid video dimensions, waiting for video to be ready...');
      return;
    }

    // Set canvas size to match video dimensions
    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;

      // Update canvas CSS dimensions for proper display
      canvas.style.width = video.clientWidth + 'px';
      canvas.style.height = video.clientHeight + 'px';
    }

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ 
          minConfidence: 0.5,
          maxResults: 1
        }))
        .withFaceLandmarks();

      if (detection) {
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Ensure we have valid dimensions before resizing
        if (displaySize.width > 0 && displaySize.height > 0) {
          const resizedDetection = faceapi.resizeResults(detection, displaySize);
          
          // Enhanced landmark drawing style
          context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          context.lineWidth = 2;
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
          
          // Draw detection box with enhanced style
          const box = resizedDetection.detection.box;
          context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          context.lineWidth = 2;
          context.strokeRect(box.x, box.y, box.width, box.height);
          
          // Add glow effect
          context.shadowColor = 'rgba(255, 255, 255, 0.5)';
          context.shadowBlur = 10;
        }
      }
    } catch (error) {
      console.error('Error in face detection:', error);
    }
  };

  // Add event listener for video load
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoLoad = () => {
      // Wait a brief moment for dimensions to stabilize
      setTimeout(() => {
        if (video.videoWidth && video.videoHeight) {
          console.log('Video dimensions ready:', { width: video.videoWidth, height: video.videoHeight });
          setIsVideoReady(true);
        }
      }, 100);
    };

    video.addEventListener('loadeddata', handleVideoLoad);
    video.addEventListener('loadedmetadata', handleVideoLoad);
    
    return () => {
      video.removeEventListener('loadeddata', handleVideoLoad);
      video.removeEventListener('loadedmetadata', handleVideoLoad);
    };
  }, []);

  useEffect(() => {
    if (!isModelLoaded || !isVideoReady || !videoRef.current || !overlayCanvasRef.current) return;

    let frameId: number | null = null;
    let isDetecting = false;

    const runDetection = async () => {
      if (!isDetecting) {
        isDetecting = true;
        await detectFace();
        isDetecting = false;
      }
      frameId = requestAnimationFrame(runDetection);
    };

    runDetection();

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isModelLoaded, isVideoReady]);

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800 mb-4 tracking-tight">Face Recognition Attendance</h1>
      
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-xl bg-white p-4">
        <div className="aspect-video w-full relative rounded-xl overflow-hidden bg-gray-100">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`rounded-xl ${isCaptured ? 'hidden' : 'block'} w-full h-full object-cover`}
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 z-10"
          />
          <canvas
            ref={canvasRef}
            className={`rounded-xl ${isCaptured ? 'block' : 'hidden'} w-full h-full object-cover`}
          />

          {detectionMetrics && (
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-gray-700 shadow-lg">
              <p className="font-medium">Accuracy: {(detectionMetrics.accuracy * 100).toFixed(1)}%</p>
              <p className="font-medium">Latency: {detectionMetrics.latencyMs}ms</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {!isCaptured ? (
          <button
            onClick={capturePhoto}
            disabled={!isModelLoaded || !isVideoReady}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
                     transition-all duration-200 ease-in-out font-semibold shadow-lg 
                     disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            {!isModelLoaded ? 'Loading...' : 'Take Photo'}
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setIsCaptured(false);
                setCapturedImage(null);
                setFaceFeatures(null);
              }}
              className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg
                       transition-all duration-200 ease-in-out font-semibold shadow-lg
                       transform hover:scale-105 focus:outline-none focus:ring-2 
                       focus:ring-gray-500 focus:ring-opacity-50"
            >
              Retake
            </button>
            <button
              onClick={sendAttendance}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg
                       transition-all duration-200 ease-in-out font-semibold shadow-lg
                       flex items-center gap-2 transform hover:scale-105
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              <span>Send Attendance</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}