'use client';

import React, { useState } from 'react'
import FaceDetection from '@/components/FaceDetection'
import RegistrationForm from '@/components/RegistrationForm'
import { Toast } from '@/components/Toast';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'register'>('attendance');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const handleRegistrationSuccess = () => {
    setToast({
      message: 'Registration successful! You can now take attendance.',
      type: 'success',
      isVisible: true
    });
    setActiveTab('attendance');

    // Hide toast after 5 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Face Attendance System</h1>
        
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-6 py-2 ${
                activeTab === 'attendance'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Take Attendance
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`px-6 py-2 ${
                activeTab === 'register'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Register New User
            </button>
          </div>
        </div>

        {activeTab === 'attendance' ? (
          <FaceDetection />
        ) : (
          <RegistrationForm onRegistrationSuccess={handleRegistrationSuccess} />
        )}

        {toast.isVisible && (
          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={toast.isVisible}
            onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
          />
        )}
      </div>
    </main>
  )
}