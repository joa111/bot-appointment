-- Create a trigger function to automatically add new users to admin_users table
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;