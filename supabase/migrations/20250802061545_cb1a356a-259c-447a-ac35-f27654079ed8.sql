-- Fix the security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Only add to admin_users if this is a signup event and user doesn't already exist
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = NEW.email
  ) THEN
    INSERT INTO public.admin_users (email, role)
    VALUES (NEW.email, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to automatically add admin users when they sign up
-- Note: We cannot create triggers on auth.users as it's managed by Supabase
-- Instead, we'll handle this in the application code

-- Let's create a function to manually add admin users that can be called from the app
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