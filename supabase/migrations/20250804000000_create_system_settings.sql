-- Create singleton settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_guard INTEGER UNIQUE DEFAULT 1 CHECK (singleton_guard = 1),
  daily_morning_limit INTEGER NOT NULL DEFAULT 50,
  daily_afternoon_limit INTEGER NOT NULL DEFAULT 50,
  booking_cutoff_hour INTEGER NOT NULL DEFAULT 18,
  enable_notifications BOOLEAN NOT NULL DEFAULT true,
  welcome_message TEXT NOT NULL DEFAULT 'Welcome to AppointmentBot Pro! I''m here to help you book your appointment quickly and easily.',
  confirmation_message TEXT NOT NULL DEFAULT 'Your appointment has been successfully booked! Please keep your booking reference for future use.',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies
-- Select is allowed for everyone (public)
CREATE POLICY "Anyone can view system settings" ON public.system_settings
  FOR SELECT USING (true);

-- Insert/Update/Delete requires admin privileges
CREATE POLICY "Only admins can insert system settings" ON public.system_settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update system settings" ON public.system_settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete system settings" ON public.system_settings
  FOR DELETE USING (public.is_admin());

-- Setup update trigger for updated_at column
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add default configuration row
INSERT INTO public.system_settings (
  daily_morning_limit,
  daily_afternoon_limit,
  booking_cutoff_hour,
  enable_notifications,
  welcome_message,
  confirmation_message
) VALUES (
  50,
  50,
  18,
  true,
  'Welcome to AppointmentBot Pro! I''m here to help you book your appointment quickly and easily.',
  'Your appointment has been successfully booked! Please keep your booking reference for future use.'
) ON CONFLICT (singleton_guard) DO NOTHING;

-- Enable realtime for system_settings table
ALTER TABLE public.system_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- RLS check/fix for booking_reference schema consistency in appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='appointments' AND column_name='booking_reference'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN booking_reference VARCHAR(255);
  END IF;
END $$;
