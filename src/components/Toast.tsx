'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export default function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 300);
  }, [id, onClose]);

  useEffect(() => {
    setIsVisible(true);
    
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200', 
      iconColor: 'text-red-600',
      titleColor: 'text-red-800'
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800'
    }
  }[type];

  const Icon = config.icon;

  return (
    <div className={`
      transform transition-all duration-300 ease-in-out
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      max-w-sm w-full ${config.bgColor} ${config.borderColor} border rounded-lg shadow-lg p-4
    `}>
      <div className="flex items-start">
        <Icon className={`size-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${config.titleColor}`}>
            {title}
          </p>
          {message && (
            <p className="mt-1 text-sm text-gray-600">
              {message}
            </p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}