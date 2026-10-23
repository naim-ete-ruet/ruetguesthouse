-- ==============================================================================
-- RUET Guest House - Row Level Security (RLS) Configuration Script
-- ==============================================================================
-- Run this script in the Supabase Dashboard -> SQL Editor
-- This will:
-- 1. Enable Row-Level Security on all 6 public tables (resolves the Supabase critical alert).
-- 2. Add appropriate RLS access policies for anon & authenticated roles so that
--    your website continues to function seamlessly without any permission errors.
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (to prevent duplicate errors)
DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;
DROP POLICY IF EXISTS "Allow all operations on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow all operations on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow all operations on guests" ON public.guests;
DROP POLICY IF EXISTS "Allow all operations on meals" ON public.meals;
DROP POLICY IF EXISTS "Allow all operations on complaints" ON public.complaints;
DROP POLICY IF EXISTS "Allow all operations on notifications" ON public.notifications;

-- 3. Create RLS Policies

-- USERS TABLE
CREATE POLICY "Allow all operations on users"
ON public.users
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ROOMS TABLE
CREATE POLICY "Allow all operations on rooms"
ON public.rooms
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- BOOKINGS TABLE
CREATE POLICY "Allow all operations on bookings"
ON public.bookings
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- GUESTS TABLE
CREATE POLICY "Allow all operations on guests"
ON public.guests
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- MEALS TABLE
CREATE POLICY "Allow all operations on meals"
ON public.meals
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- COMPLAINTS TABLE
CREATE POLICY "Allow all operations on complaints"
ON public.complaints
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- NOTIFICATIONS TABLE
CREATE POLICY "Allow all operations on notifications"
ON public.notifications
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Verification: check RLS status on all public tables
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public';
