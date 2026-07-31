-- Migration: Add phone_number and notes to appointments
-- Run this in your Supabase SQL editor

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS notes TEXT;
