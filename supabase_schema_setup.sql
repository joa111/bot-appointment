-- ==========================================
-- AppointmentBot Pro Complete Database Setup
-- ==========================================

-- 1. CLEANUP (Optional: Uncomment if resetting an existing database)
-- DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
-- DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
-- DROP TABLE IF EXISTS public.appointments;
-- DROP TABLE IF EXISTS public.queue_counters;
-- DROP TABLE IF EXISTS public.admin_users;
-- DROP TABLE IF EXISTS public.system_settings;
-- DROP FUNCTION IF EXISTS public.is_admin();
-- DROP FUNCTION IF EXISTS public.update_updated_at_column();
-- DROP FUNCTION IF EXISTS public.create_admin_user(text);
-- DROP FUNCTION IF EXISTS public.handle_admin_user_signup();

-- 2. CREATE CORE TABLES

-- Create admin_users table
CREATE TABLE public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(30),
  notes TEXT,
  time_slot VARCHAR(50) CHECK (time_slot IN ('Morning', 'Afternoon')),
  queue_number INTEGER NOT NULL,
  appointment_date DATE DEFAULT CURRENT_DATE,
  booking_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create queue_counters table
CREATE TABLE public.queue_counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  morning_count INTEGER DEFAULT 0,
  afternoon_count INTEGER DEFAULT 0,
  UNIQUE(date)
);

-- Create singleton system_settings table
CREATE TABLE public.system_settings (
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

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 4. HELPER FUNCTIONS

-- Function to check if the current auth user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Function to automatically update the updated_at timestamp column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Function to manually create admin users (called from client during admin signup)
CREATE OR REPLACE FUNCTION public.create_admin_user(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.admin_users (email, role)
  VALUES (user_email, 'admin')
  ON CONFLICT (email) DO NOTHING;
END;
$$;

-- Trigger function placeholder for auth event logging (if needed)
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = NEW.email
  ) THEN
    INSERT INTO public.admin_users (email, role)
    VALUES (NEW.email, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. CREATE AUTOMATIC TRIGGERS

-- Trigger for updating updated_at on appointments
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. SETUP ROW LEVEL SECURITY POLICIES

-- Policies for admin_users
CREATE POLICY "Only admins can view admin users" 
  ON public.admin_users FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "Only admins can manage admin users" 
  ON public.admin_users FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policies for appointments
CREATE POLICY "Anyone can view appointments" 
  ON public.appointments FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create appointments" 
  ON public.appointments FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Only admins can update appointments" 
  ON public.appointments FOR UPDATE 
  USING (public.is_admin());

CREATE POLICY "Only admins can delete appointments" 
  ON public.appointments FOR DELETE 
  USING (public.is_admin());

-- Policies for queue_counters
CREATE POLICY "Anyone can view queue counters" 
  ON public.queue_counters FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create queue counters" 
  ON public.queue_counters FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update queue counters" 
  ON public.queue_counters FOR UPDATE 
  USING (true);

CREATE POLICY "Only admins can delete queue counters" 
  ON public.queue_counters FOR DELETE 
  USING (public.is_admin());

-- Policies for system_settings
CREATE POLICY "Anyone can view system settings" 
  ON public.system_settings FOR SELECT 
  USING (true);

CREATE POLICY "Only admins can insert system settings" 
  ON public.system_settings FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update system settings" 
  ON public.system_settings FOR UPDATE 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete system settings" 
  ON public.system_settings FOR DELETE 
  USING (public.is_admin());

-- 7. INSERT DEFAULT SYSTEM CONFIGURATION
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

-- 8. CONFIGURE SUPABASE REALTIME REPLICATION

-- Enable Realtime replica identity configuration
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.queue_counters REPLICA IDENTITY FULL;
ALTER TABLE public.system_settings REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_counters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
