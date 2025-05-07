import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export default function RegistrationForm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    loadModels();
    setupCamera();
    return () => {
      // Cleanup camera on unmount
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      setIsModelLoaded(true);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context?.drawImage(video, 0, 0);

      try {
        // Detect face and get descriptor
        const detection = await faceapi
          .detectSingleFace(canvas)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const imageDataUrl = canvas.toDataURL('image/jpeg');
          setCapturedImage(imageDataUrl);
          setFaceDescriptor(detection.descriptor);
          setIsCaptured(true);
        } else {
          alert('No face detected! Please try again.');
        }
      } catch (error) {
        console.error('Error detecting face:', error);
        alert('Error detecting face. Please try again.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedImage || !faceDescriptor || !formData.name || !formData.email) {
      alert('Please fill all fields and capture a photo');
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          faceData: Array.from(faceDescriptor), // Convert Float32Array to regular array
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('Registration successful!');
        // Reset form
        setFormData({ name: '', email: '' });
        setIsCaptured(false);
        setCapturedImage(null);
        setFaceDescriptor(null);
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Error registering:', error);
      alert('Registration failed');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">User Registration</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <div className="mt-4">
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              className={`w-full h-full object-cover ${isCaptured ? 'hidden' : 'block'}`}
            />
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-cover ${isCaptured ? 'block' : 'hidden'}`}
            />
          </div>
          <div className="mt-2 flex justify-center gap-2">
            {!isCaptured ? (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!isModelLoaded}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-400 hover:bg-blue-600 transition-colors"
              >
                {isModelLoaded ? 'Capture Photo' : 'Loading...'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsCaptured(false);
                  setCapturedImage(null);
                  setFaceDescriptor(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Retake Photo
              </button>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={!isCaptured || !faceDescriptor}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg disabled:bg-gray-400 hover:bg-green-600 transition-colors"
        >
          Register
        </button>
      </form>
    </div>
  );
}