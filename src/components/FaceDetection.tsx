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
    console.log('capturePhoto called', {
      videoReady: isVideoReady,
      modelLoaded: isModelLoaded,
      videoRef: !!videoRef.current,
      canvasRef: !!canvasRef.current
    });

    if (!videoRef.current || !canvasRef.current || !isVideoReady) {
      console.error('Video or canvas not ready', {
        videoExists: !!videoRef.current,
        canvasExists: !!canvasRef.current,
        isVideoReady
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Could not get canvas context');
      return;
    }

    // Ensure video has valid dimensions
    console.log('Video dimensions:', {
      width: video.videoWidth,
      height: video.videoHeight
    });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions not ready');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    try {
      context.drawImage(video, 0, 0);
      console.log('Drew video frame to canvas');
    } catch (error) {
      console.error('Error drawing to canvas:', error);
      return;
    }

    try {
      console.log('Starting face detection...');
      // Detect faces and get face features
      const detection = await faceapi
        .detectSingleFace(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

      console.log('Face detection result:', !!detection);

      if (detection) {
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageDataUrl);
        setFaceFeatures(detection.descriptor);
        setIsCaptured(true);
        console.log('Successfully captured photo and detected face');
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
    if (!capturedImage || !faceFeatures) return;

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faceFeatures: Array.from(faceFeatures),
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setToast({
          message: data.message || 'Attendance recorded successfully!',
          type: 'success',
          isVisible: true
        });
        // Reset capture state
        setIsCaptured(false);
        setCapturedImage(null);
        setFaceFeatures(null);
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
    if (!isModelLoaded || !isVideoReady || !videoRef.current || !overlayCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const context = canvas.getContext('2d');

    const detectFace = async () => {
      if (!video || !canvas || !context) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks();

      if (detection) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const resizedDetection = faceapi.resizeResults(detection, {
          width: video.videoWidth,
          height: video.videoHeight
        });
        
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
      }
    };

    const interval = setInterval(detectFace, 100);
    return () => clearInterval(interval);
  }, [isModelLoaded, isVideoReady]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      <div className="relative w-full max-w-3xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`rounded-lg ${isCaptured ? 'hidden' : 'block'} w-full`}
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 z-10"
        />
        <canvas
          ref={canvasRef}
          className={`rounded-lg ${isCaptured ? 'block' : 'hidden'} w-full`}
        />
      </div>

      <div className="flex gap-4">
        {!isCaptured ? (
          <button
            onClick={capturePhoto}
            disabled={!isModelLoaded || !isVideoReady}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-400"
          >
            Take Photo
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setIsCaptured(false);
                setCapturedImage(null);
                setFaceFeatures(null);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg"
            >
              Retake
            </button>
            <button
              onClick={sendAttendance}
              className="px-4 py-2 bg-green-500 text-white rounded-lg"
            >
              Send Attendance
            </button>
          </>
        )}
      </div>
    </div>
  );
}