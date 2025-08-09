-- Create appointments table
CREATE TABLE public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  time_slot VARCHAR(50) CHECK (time_slot IN ('Morning', 'Afternoon')),
  queue_number INTEGER NOT NULL,
  appointment_date DATE DEFAULT CURRENT_DATE,
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

-- Create admin_users table
CREATE TABLE public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for appointments table
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

-- RLS Policies for queue_counters table
CREATE POLICY "Anyone can view queue counters" 
  ON public.queue_counters FOR SELECT 
  USING (true);

CREATE POLICY "Only admins can manage queue counters" 
  ON public.queue_counters FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS Policies for admin_users table
CREATE POLICY "Only admins can view admin users" 
  ON public.admin_users FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "Only admins can manage admin users" 
  ON public.admin_users FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());