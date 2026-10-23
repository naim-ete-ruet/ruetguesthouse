-- ==============================================================================
-- RUET Guest House - Drop Signature Column
-- ==============================================================================
-- Run this script in the Supabase Dashboard -> SQL Editor:
ALTER TABLE public.bookings DROP COLUMN IF EXISTS signature_image;
