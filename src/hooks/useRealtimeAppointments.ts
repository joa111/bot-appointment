import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Appointment {
  id: string;
  full_name: string;
  appointment_date: string;
  time_slot: string;
  queue_number: number;
  status: string;
  booking_reference: string;
  created_at: string;
  updated_at: string;
}

export const useRealtimeAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Initial load
    fetchAppointments();

    // Set up realtime subscription
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('New appointment:', payload.new);
          setAppointments(current => [payload.new as Appointment, ...current]);
          
          // Show toast notification for new appointments
          const newAppointment = payload.new as Appointment;
          toast({
            title: "New Appointment Booked",
            description: `${newAppointment.full_name} - ${newAppointment.time_slot}`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Updated appointment:', payload.new);
          setAppointments(current =>
            current.map(apt =>
              apt.id === payload.new.id ? payload.new as Appointment : apt
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Deleted appointment:', payload.old);
          setAppointments(current =>
            current.filter(apt => apt.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching appointments:', error);
        toast({
          title: "Error",
          description: "Failed to load appointments",
          variant: "destructive",
        });
        return;
      }

      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    appointments,
    loading,
    refetch: fetchAppointments
  };
};