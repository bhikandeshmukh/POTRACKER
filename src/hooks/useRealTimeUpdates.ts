'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ToastContainer';
import type { Timeout } from 'node:timers';

interface UseRealTimeUpdatesProps {
  onUpdate: () => void;
  interval?: number;
  enabled?: boolean;
}

/**
* Manages polling-based real-time updates and exposes controls.
* @example
* useRealTimeUpdates({ onUpdate: () => console.log('updated') })
* { isActive: true, lastUpdate: new Date(), toggleRealTime: () => {}, forceUpdate: () => {} }
* @param {{UseRealTimeUpdatesProps}} {{config}} - Configuration for update callback, polling interval, and enable state.
* @returns {{isActive: boolean, lastUpdate: Date, toggleRealTime: () => void, forceUpdate: () => void}} Object with current status, timestamp, and control helpers.
**/
export function useRealTimeUpdates({ 
  onUpdate, 
  interval = 30000, // 30 seconds default
  enabled = true 
}: UseRealTimeUpdatesProps) {
  const [isActive, setIsActive] = useState(enabled);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<Timeout | null>(null);
  const { showInfo } = useToast();

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const startPolling = () => {
      intervalRef.current = setInterval(() => {
        onUpdate();
        setLastUpdate(new Date());
        showInfo('Dashboard refreshed with latest data');
      }, interval);
    };

    startPolling();

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, interval, onUpdate, showInfo]);

  const toggleRealTime = () => {
    setIsActive(!isActive);
  };

  const forceUpdate = () => {
    onUpdate();
    setLastUpdate(new Date());
    showInfo('Manual Refresh', 'Data refreshed successfully');
  };

  return {
    isActive,
    lastUpdate,
    toggleRealTime,
    forceUpdate
  };
}