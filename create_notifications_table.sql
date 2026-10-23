-- ==============================================================================
-- RUET Guest House - Notifications Table with Row Level Security (RLS)
-- ==============================================================================
-- Run this script in the Supabase Dashboard -> SQL Editor (+ New query -> Run)
-- This table stores all notifications for corresponding users in Supabase.
-- Deleting a notification removes it directly from this Supabase table.
-- ==============================================================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'danger'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Anon and Authenticated Roles
DROP POLICY IF EXISTS "Allow all operations on notifications" ON public.notifications;
CREATE POLICY "Allow all operations on notifications"
ON public.notifications
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Verify that the table is created and RLS is enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS rls_enabled 
FROM pg_tables 
WHERE tablename = 'notifications';
