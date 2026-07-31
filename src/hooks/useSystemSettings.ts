import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemSettings {
  id: string;
  daily_morning_limit: number;
  daily_afternoon_limit: number;
  booking_cutoff_hour: number;
  enable_notifications: boolean;
  welcome_message: string;
  confirmation_message: string;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching system settings:', error);
        return;
      }

      if (data) {
        setSettings(data as SystemSettings);
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    if (!settings) return { error: new Error('Settings not loaded') };
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .update(newSettings)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      setSettings(data as SystemSettings);
      return { data, error: null };
    } catch (err: any) {
      console.error('Error updating system settings:', err);
      return { data: null, error: err };
    }
  };

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime updates on system settings changes
    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings'
        },
        (payload) => {
          console.log('System settings changed in realtime:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setSettings(payload.new as SystemSettings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading, fetchSettings, updateSettings };
};
