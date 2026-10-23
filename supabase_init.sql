-- Run this entire script in your Supabase SQL Editor to initialize your database!

-- 0. Drop existing tables to allow safe re-initialization
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.meals CASCADE;
DROP TABLE IF EXISTS public.guests CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Create Users Table
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    name TEXT NOT NULL,
    department TEXT,
    designation TEXT,
    mobile TEXT,
    nid TEXT
);


-- 2. Create Rooms Table
CREATE TABLE public.rooms (
    room_number TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    floor TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    nightly_rate INTEGER NOT NULL,
    beds INTEGER,
    bed_description TEXT,
    bathroom TEXT,
    air_conditioning BOOLEAN DEFAULT false
);


-- 3. Create Bookings Table
CREATE TABLE public.bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id),
    is_teacher_booking BOOLEAN DEFAULT false,
    applicant_name TEXT,
    designation TEXT,
    department TEXT,
    mobile_number TEXT,
    check_in_date TEXT,
    check_in_time TEXT,
    check_out_date TEXT,
    check_out_time TEXT,
    total_days INTEGER,
    requested_room_count INTEGER,
    requested_room_type TEXT,
    stay_purpose TEXT,
    assigned_room TEXT REFERENCES public.rooms(room_number),
    approving_teacher_id TEXT REFERENCES public.users(id),
    total_amount INTEGER,
    payment_status TEXT DEFAULT 'PENDING',
    approval_status TEXT DEFAULT 'PENDING_TEACHER_APPROVAL',
    booking_status TEXT DEFAULT 'PENDING'
);

-- 4. Create Guests Table (One-to-Many with Bookings)
CREATE TABLE public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
    key_label TEXT,
    name TEXT,
    nid TEXT,
    address TEXT,
    mobile TEXT,
    relationship TEXT
);

-- 5. Create Meals Table
CREATE TABLE public.meals (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id),
    user_role TEXT,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
    applicant_name TEXT,
    room_number TEXT,
    meal_date TEXT,
    meal_type TEXT,
    persons INTEGER,
    total_amount INTEGER,
    status TEXT DEFAULT 'PENDING',
    payment_status TEXT DEFAULT 'PENDING'
);

-- 6. Create Complaints Table
CREATE TABLE public.complaints (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id),
    booking_id TEXT,
    category TEXT,
    description TEXT,
    status TEXT DEFAULT 'Open',
    priority TEXT DEFAULT 'Normal',
    created_at TEXT
);
