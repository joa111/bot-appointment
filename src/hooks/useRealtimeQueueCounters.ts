import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QueueCounter {
  id: string;
  date: string;
  morning_count: number;
  afternoon_count: number;
}

export const useRealtimeQueueCounters = () => {
  const [queueCounters, setQueueCounters] = useState<QueueCounter[]>([]);
  const [todayCounter, setTodayCounter] = useState<QueueCounter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    fetchQueueCounters();

    // Set up realtime subscription
    const channel = supabase
      .channel('queue-counters-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_counters'
        },
        (payload) => {
          console.log('Queue counter changed:', payload);
          
          if (payload.eventType === 'INSERT') {
            setQueueCounters(current => [payload.new as QueueCounter, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setQueueCounters(current =>
              current.map(counter =>
                counter.id === payload.new.id ? payload.new as QueueCounter : counter
              )
            );
          }

          // Update today's counter if it's the current date
          const today = new Date().toISOString().split('T')[0];
          const newPayload = payload.new as QueueCounter;
          if (newPayload?.date === today) {
            setTodayCounter(newPayload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueueCounters = async () => {
    try {
      const { data, error } = await supabase
        .from('queue_counters')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching queue counters:', error);
        return;
      }

      setQueueCounters(data || []);

      // Find today's counter
      const today = new Date().toISOString().split('T')[0];
      const todaysCounter = data?.find(counter => counter.date === today);
      setTodayCounter(todaysCounter || null);
    } catch (error) {
      console.error('Error fetching queue counters:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentQueueNumber = (timeSlot: string): number => {
    if (!todayCounter) return 0;
    
    return timeSlot === 'Morning Appointment' 
      ? todayCounter.morning_count 
      : todayCounter.afternoon_count;
  };

  return {
    queueCounters,
    todayCounter,
    loading,
    getCurrentQueueNumber,
    refetch: fetchQueueCounters
  };
};