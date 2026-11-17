-- ==============================================================================
-- RUET GUEST HOUSE - COMPLETE MASTER DATABASE SCHEMA
-- ==============================================================================
-- Project: RUET Guest House Management Portal
-- Target: Supabase PostgreSQL (SQL Editor)
--
-- Instructions:
-- 1. Open your Supabase Project Dashboard -> SQL Editor (+ New query).
-- 2. Paste this entire script into the editor and click "Run".
-- 3. This script will:
--    a. Safely drop all 9 old tables with CASCADE.
--    b. Re-create all 9 tables with strict types, constraints, defaults, and foreign keys.
--    c. Enable Row-Level Security (RLS) on all 9 tables.
--    d. Create full-access RLS policies for 'anon' and 'authenticated' roles.
--    e. Pre-seed all official rooms (201-206 VIP, 301-312 Type 3, 401-412 Type 4/5/6).
--    f. Pre-seed all users (Administrators, ETE Faculty Teachers, and Students).
-- ==============================================================================

-- ==============================================================================
-- 1. DROP EXISTING TABLES IN REVERSE DEPENDENCY ORDER
-- ==============================================================================
DROP TABLE IF EXISTS public.booking_portal_deletions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.meals CASCADE;
DROP TABLE IF EXISTS public.guests CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Ensure pgcrypto extension is enabled for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 2. CREATE MASTER TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table 1: USERS (Admin, Teachers, Students)
-- ------------------------------------------------------------------------------
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    name TEXT NOT NULL,
    department TEXT,
    designation TEXT,
    mobile TEXT,
    nid TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 2: ROOMS (Physical Guest House Rooms)
-- ------------------------------------------------------------------------------
CREATE TABLE public.rooms (
    room_number TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('VIP', 'TYPE_3', 'TYPE_4_5_6')),
    capacity INTEGER NOT NULL DEFAULT 1,
    floor TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'selected', 'occupied', 'in_progress', 'maintenance')),
    nightly_rate NUMERIC NOT NULL DEFAULT 0,
    beds INTEGER DEFAULT 1,
    bed_description TEXT,
    bathroom TEXT DEFAULT 'Attached bathroom',
    air_conditioning BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 3: BOOKINGS (Room Reservation Applications)
-- ------------------------------------------------------------------------------
CREATE TABLE public.bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    is_teacher_booking BOOLEAN DEFAULT false,
    applicant_name TEXT NOT NULL,
    designation TEXT,
    department TEXT,
    mobile_number TEXT,
    check_in_date TEXT NOT NULL,
    check_in_time TEXT DEFAULT '12:00 PM',
    check_out_date TEXT NOT NULL,
    check_out_time TEXT DEFAULT '11:00 AM',
    total_days INTEGER NOT NULL DEFAULT 1,
    requested_room_count INTEGER DEFAULT 1,
    requested_room_type TEXT,
    stay_purpose TEXT,
    assigned_room TEXT REFERENCES public.rooms(room_number) ON DELETE SET NULL,
    approving_teacher_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    total_amount NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'COMPLETED', 'REFUNDED')),
    approval_status TEXT DEFAULT 'PENDING_TEACHER_APPROVAL',
    booking_status TEXT DEFAULT 'PENDING' CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
    payment_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 4: GUESTS (Additional Accompanying Guests per Booking)
-- ------------------------------------------------------------------------------
CREATE TABLE public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
    key_label TEXT,
    name TEXT,
    nid TEXT,
    address TEXT,
    mobile TEXT,
    relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 5: MEALS (Dining Hall Orders)
-- ------------------------------------------------------------------------------
CREATE TABLE public.meals (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    user_role TEXT DEFAULT 'student',
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    applicant_name TEXT,
    room_number TEXT,
    meal_date TEXT,
    meal_time TEXT,
    meal_type TEXT,
    persons INTEGER DEFAULT 1,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    payment_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 6: COMPLAINTS (Feedback and Grievances)
-- ------------------------------------------------------------------------------
CREATE TABLE public.complaints (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    booking_id TEXT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    admin_reply TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 7: NOTIFICATIONS (User Alert Feed)
-- ------------------------------------------------------------------------------
CREATE TABLE public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 8: PAYMENTS (Permanent Revenue Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE public.payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    applicant_name TEXT,
    applicant_email TEXT,
    applicant_mobile TEXT,
    applicant_role TEXT DEFAULT 'student',
    check_in_date TEXT,
    check_out_date TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'COMPLETED', 'REFUNDED')),
    payment_method TEXT DEFAULT 'ONLINE',
    transaction_id TEXT,
    bank_tran_id TEXT,
    invoice_number TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 9: BOOKING_PORTAL_DELETIONS (Multi-Portal Soft Deletions)
-- ------------------------------------------------------------------------------
CREATE TABLE public.booking_portal_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL,
    portal_role TEXT NOT NULL CHECK (portal_role IN ('student', 'teacher', 'admin')),
    user_id TEXT,
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, portal_role, user_id)
);

-- ==============================================================================
-- 3. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_created_at ON public.bookings(created_at DESC);
CREATE INDEX idx_bookings_status ON public.bookings(approval_status, booking_status);
CREATE INDEX idx_guests_booking_id ON public.guests(booking_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX idx_portal_deletions_lookup ON public.booking_portal_deletions(booking_id, portal_role, user_id);

-- ==============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) FOR ALL 9 TABLES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_portal_deletions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;
DROP POLICY IF EXISTS "Allow all operations on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow all operations on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow all operations on guests" ON public.guests;
DROP POLICY IF EXISTS "Allow all operations on meals" ON public.meals;
DROP POLICY IF EXISTS "Allow all operations on complaints" ON public.complaints;
DROP POLICY IF EXISTS "Allow all operations on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow all operations on payments" ON public.payments;
DROP POLICY IF EXISTS "Allow all operations on booking_portal_deletions" ON public.booking_portal_deletions;

-- Create seamless RLS policies for anon and authenticated clients
CREATE POLICY "Allow all operations on users"
ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on rooms"
ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on bookings"
ON public.bookings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on guests"
ON public.guests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on meals"
ON public.meals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on complaints"
ON public.complaints FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on notifications"
ON public.notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on payments"
ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on booking_portal_deletions"
ON public.booking_portal_deletions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. PRE-SEED USERS DATA (Admin, Teachers & Students)
-- ==============================================================================
INSERT INTO public.users (id, email, password, role, name, department, designation, mobile, nid)
VALUES
    ('admin_1', 'naimpower8666@gmail.com', 'admin123', 'admin', 'RUET Admin', 'Guest House Administration', 'System Administrator', '01700000000', ''),
    ('teacher_1', 'kamaleteruet@gmail.com', 'teacher123', 'teacher', 'Dr. Md. Kamal Hosain', 'ETE', 'Professor', '880-1716130151', ''),
    ('teacher_2', 'fatehasamad@ete.ruet.ac.bd', 'teacher123', 'teacher', 'Dr. Mst. Fateha Samad', 'ETE', 'Professor', '880-1796382971', ''),
    ('teacher_3', 'ruet10aslam@gmail.com', 'teacher123', 'teacher', 'Md. Aslam Mollah', 'ETE', 'Assistant Professor', '880-1738643809', ''),
    ('teacher_4', 'yeakub.ruet08@gmail.com', 'teacher123', 'teacher', 'Dr. Md. Yeakub Ali', 'ETE', 'Assistant Professor', '880-1722923669', ''),
    ('teacher_5', 'rakib.hossain@ete.ruet.ac.bd', 'teacher123', 'teacher', 'Md. Rakib Hossain', 'ETE', 'Assistant Professor', '880-1743293555', ''),
    ('teacher_6', 'hasan.ruet.ete@gmail.com', 'teacher123', 'teacher', 'Hasan Sarker', 'ETE', 'Assistant Professor', '880-1612707075', ''),
    ('teacher_7', 'farzanaeteruet@gmail.com', 'teacher123', 'teacher', 'Farzana Akter', 'ETE', 'Assistant Professor', '880-1791282222', ''),
    ('teacher_8', 'saif101303@gmail.com', 'teacher123', 'teacher', 'Md Abu Ismail Siddique', 'ETE', 'Assistant Professor', '880-1521300294', ''),
    ('teacher_9', 'sharaftasnim786@gmail.com', 'teacher123', 'teacher', 'Sharaf Tasnim', 'ETE', 'Assistant Professor', '880-1789223600', ''),
    ('teacher_10', 'mahmudul@ete.ruet.ac.bd', 'teacher123', 'teacher', 'Md. Mahmudul Hasan', 'ETE', 'Lecturer', '880-1710132822', ''),
    ('teacher_11', 'rakibulislam@ete.ruet.ac.bd', 'teacher123', 'teacher', 'Md. Rakibul Islam', 'ETE', 'Lecturer', '880-1304172487', ''),
    ('teacher_12', 'nahinete.ruet@gmail.com', 'teacher123', 'teacher', 'Mohammed Nazmul Islam Nahin', 'ETE', 'Lecturer', '880-1876519534', ''),
    ('teacher_13', 'rubaeat.ahammed@ete.ruet.ac.bd', 'teacher123', 'teacher', 'Rubaeat Ahammed', 'ETE', 'Lecturer', '880-1782359987', ''),
    ('teacher_14', 'rifa.mim@ete.ruet.ac.bd', 'teacher123', 'teacher', 'Rifa Tabassum Mim', 'ETE', 'Lecturer', '880-1754320604', ''),
    ('teacher_15', 'naim.ete.ruet@gmail.com', 'teacher123', 'teacher', 'TEST TEACHER A', 'ETE', 'Professor', '880-1576668319', ''),
    ('teacher_16', 'mohammadnaim969@gmail.com', 'teacher123', 'teacher', 'TEST TEACHER B', 'ETE', 'Professor', '01576668319', ''),
    ('user_1', '2204024@student.ruet.ac.bd', 'password123', 'student', 'Mohammad Naim', 'ETE', 'Student', '880-1576668319', '2204024'),
    ('user_1794545751493', 'arafatghosh@gmail.com', 'password111', 'student', 'Imrul Islam', 'ETE', 'Student', '+8801756243606', '2204060')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation,
    mobile = EXCLUDED.mobile,
    nid = EXCLUDED.nid;

-- ==============================================================================
-- 6. PRE-SEED ROOMS DATA (29 Guest Rooms Across Floors 2, 3 and 4)
-- ==============================================================================
INSERT INTO public.rooms (room_number, category, capacity, floor, status, nightly_rate, beds, bed_description, bathroom, air_conditioning)
VALUES
    -- Floor 2: VIP Suites
    ('201', 'VIP', 1, '2', 'available', 200, 1, 'approximately 6x7 ft', 'Attached bathroom', true),
    ('202', 'VIP', 1, '2', 'available', 200, 1, 'approximately 6x7 ft', 'Attached bathroom', true),
    ('203', 'VIP', 1, '2', 'available', 200, 1, 'approximately 6x7 ft', 'Attached bathroom', true),
    ('204', 'VIP', 1, '2', 'available', 200, 1, 'approximately 6x7 ft', 'Attached bathroom', true),
    ('205', 'VIP', 1, '2', 'available', 200, 1, 'approximately 6x7 ft', 'Attached bathroom', true),
    ('206', 'VIP', 1, '2', 'available', 200, 1, 'approximately 6x7 ft', 'Attached bathroom', true),

    -- Floor 3: Type 3 Rooms
    ('301', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('302', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('303', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('304', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('305', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('306', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('307', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('308', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('309', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('310', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('311', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),
    ('312', 'TYPE_3', 2, '3', 'available', 200, 1, 'approximately 14 ft', 'Attached bathroom', true),

    -- Floor 4: Type 4/5/6 Rooms
    ('401', 'TYPE_4_5_6', 2, '4', 'available', 150, 2, '4 x 7 ft', 'Non-attached bathroom', true),
    ('402', 'TYPE_4_5_6', 1, '4', 'available', 150, 1, '4 x 7 ft', 'Non-attached bathroom', true),
    ('403', 'TYPE_4_5_6', 2, '4', 'available', 150, 2, '4 x 7 ft', 'Non-attached bathroom', true),
    ('404', 'TYPE_4_5_6', 1, '4', 'available', 150, 1, '4 x 7 ft', 'Non-attached bathroom', true),
    ('405', 'TYPE_4_5_6', 2, '4', 'available', 150, 2, '4 x 7 ft', 'Non-attached bathroom', true),
    ('406', 'TYPE_4_5_6', 1, '4', 'available', 150, 1, '4 x 7 ft', 'Non-attached bathroom', true),
    ('407', 'TYPE_4_5_6', 1, '4', 'available', 150, 1, '4 x 7 ft', 'Non-attached bathroom', true),
    ('408', 'TYPE_4_5_6', 2, '4', 'available', 150, 2, '4 x 7 ft', 'Non-attached bathroom', true),
    ('409', 'TYPE_4_5_6', 1, '4', 'available', 150, 1, '4 x 7 ft', 'Non-attached bathroom', true),
    ('410', 'TYPE_4_5_6', 2, '4', 'available', 150, 2, '4 x 7 ft', 'Non-attached bathroom', true),
    ('411', 'TYPE_4_5_6', 1, '4', 'available', 150, 1, '4 x 7 ft', 'Non-attached bathroom', true),
    ('412', 'TYPE_4_5_6', 2, '4', 'available', 150, 2, '4 x 7 ft', 'Non-attached bathroom', true)
ON CONFLICT (room_number) DO UPDATE SET
    category = EXCLUDED.category,
    capacity = EXCLUDED.capacity,
    floor = EXCLUDED.floor,
    status = EXCLUDED.status,
    nightly_rate = EXCLUDED.nightly_rate,
    beds = EXCLUDED.beds,
    bed_description = EXCLUDED.bed_description,
    bathroom = EXCLUDED.bathroom,
    air_conditioning = EXCLUDED.air_conditioning;

-- ==============================================================================
-- 7. PRE-SEED PAYMENTS DATA (Permanent Revenue Ledger)
-- ==============================================================================
INSERT INTO public.payments (
    id,
    booking_id,
    user_id,
    applicant_name,
    applicant_email,
    applicant_mobile,
    applicant_role,
    check_in_date,
    check_out_date,
    amount,
    payment_status,
    payment_method,
    transaction_id,
    bank_tran_id,
    invoice_number,
    paid_at,
    created_at
)
VALUES
    ('PAY-BKG-2026-969', 'BKG-2026-969', 'user_1', 'TEST TEACHER B', NULL, '880-1576668319', 'student', '2026-10-11', '2026-10-23', 600, 'REFUNDED', 'ONLINE', 'BKG-2026-969_1791680853394', '26101170705oD6b1hmysxYkxrZ', '26101170705oD6b1hmysxYkxrZ', '2026-10-11T01:07:47.577+00:00', '2026-10-11T01:07:33.395+00:00'),
    ('PAY-BKG-2026-541', 'BKG-2026-541', NULL, 'TEST TEACHER B', NULL, '880-1576668319', 'student', '2026-10-11', '2026-10-23', 1400, 'PAID', 'CASH', 'CASH_BKG-2026-541_1791686410459', 'CASH_VERIFIED', 'CASH_BKG-2026-541', '2026-10-11T02:40:10.459+00:00', '2026-10-11T02:40:10.459+00:00'),
    ('PAY-BKG-2026-469', 'BKG-2026-469', 'user_1', 'TEST TEACHER B', NULL, '880-1576668319', 'student', '2026-10-22', '2026-10-23', 600, 'PAID', 'ONLINE', 'BKG-2026-469_1792632123010', '26102272104Ie4DdIrwdVz2JoT', '26102272104Ie4DdIrwdVz2JoT', '2026-10-22T01:22:23.491+00:00', '2026-10-22T01:22:03.011+00:00'),
    ('PAY-BKG-2026-160', 'BKG-2026-160', 'teacher_15', 'TEST TEACHER A', NULL, '880-1576668319', 'teacher', '2026-10-22', '2026-10-23', 200, 'PAID', 'ONLINE', 'BKG-2026-160_1792677215850', '2610221953506lKSgcNe2jdkEDP', '2610221953506lKSgcNe2jdkEDP', '2026-10-22T13:53:55.873+00:00', '2026-10-22T13:53:35.852+00:00'),
    ('PAY-BKG-2026-592', 'BKG-2026-592', 'teacher_15', 'TEST TEACHER A', 'naim.ete.ruet@gmail.com', '880-1576668319', 'teacher', '2026-10-22', '2026-10-23', 200, 'PAID', 'ONLINE', 'BKG-2026-592_1792689298192', '261022231507czrSBrfyJ6UrZKL', '261022231507czrSBrfyJ6UrZKL', '2026-10-22T17:15:12.874+00:00', '2026-10-22T17:14:58.192+00:00'),
    ('PAY-BKG-2026-440', 'BKG-2026-440', 'user_1', 'TEST TEACHER B', '2204024@student.ruet.ac.bd', '880-1576668319', 'student', '2026-10-22', '2026-10-23', 150, 'PAID', 'ONLINE', 'BKG-2026-440_1792691080957', '261022234449220wek2wqvItsBm', '261022234449220wek2wqvItsBm', '2026-10-22T17:44:54.464+00:00', '2026-10-22T17:44:40.958+00:00'),
    ('PAY-BKG-2026-226', 'BKG-2026-226', 'user_1', 'TEST TEACHER B', '2204024@student.ruet.ac.bd', '880-1576668319', 'student', '2026-10-22', '2026-10-24', 400, 'PAID', 'ONLINE', 'BKG-2026-226_1792691964191', '261022235932wUC2vRgvmB9Ejj5', '261022235932wUC2vRgvmB9Ejj5', '2026-10-22T17:59:37.468+00:00', '2026-10-22T17:59:24.192+00:00'),
    ('PAY-BKG-2026-746', 'BKG-2026-746', 'teacher_16', 'TEST TEACHER A', NULL, '880-1576668319', 'teacher', '2026-10-23', '2026-10-23', 200, 'PAID', 'ONLINE', 'BKG-2026-746_1792746124005', '261023150211wNRaM7PJb6MBCP9', '261023150211wNRaM7PJb6MBCP9', '2026-10-23T09:02:19.1+00:00', '2026-10-23T09:02:04.012+00:00'),
    ('PAY-BKG-2026-667', 'BKG-2026-667', 'teacher_15', 'TEST TEACHER A', 'teacher@ruet.ac.bd', '880-1576668319', 'teacher', '2026-11-13', '2026-11-14', 150, 'PAID', 'ONLINE', 'BKG-2026-667_TX', NULL, NULL, '2026-11-13T10:00:00+00:00', '2026-11-13T10:00:00+00:00'),
    ('PAY-BKG-2026-837', 'BKG-2026-837', 'user_1', 'TEST TEACHER B', '2204024@student.ruet.ac.bd', '01576668319', 'student', '2026-11-13', '2026-11-14', 200, 'PAID', 'CASH', 'BKG-2026-837_INIT', NULL, NULL, '2026-11-16T07:48:45.849+00:00', '2026-11-16T07:48:45.85+00:00'),
    ('PAY-BKG-2026-990', 'BKG-2026-990', 'teacher_16', 'TEST TEACHER B', 'mohammadnaim969@gmail.com', '01576668319', 'teacher', NULL, NULL, 200, 'PENDING', 'ONLINE', 'BKG-2026-990_1794817439387', NULL, NULL, NULL, '2026-11-16T08:23:59.391+00:00'),
    ('PAY-BKG-2026-077', 'BKG-2026-077', 'teacher_16', 'TEST TEACHER B', 'mohammadnaim969@gmail.com', '01576668319', 'teacher', NULL, NULL, 200, 'PENDING', 'ONLINE', 'BKG-2026-077_1794817912639', NULL, NULL, NULL, '2026-11-16T08:31:52.642+00:00'),
    ('PAY-BKG-2026-153', 'BKG-2026-153', 'teacher_16', 'TEST TEACHER B', 'mohammadnaim969@gmail.com', '01576668319', 'teacher', '2026-11-16', '2026-11-17', 200, 'PENDING', 'CASH', 'BKG-2026-153_INIT', NULL, NULL, NULL, '2026-11-16T09:06:39.398+00:00'),
    ('PAY-BKG-2026-522', 'BKG-2026-522', 'teacher_16', 'TEST TEACHER B', 'mohammadnaim969@gmail.com', '01576668319', 'teacher', '2026-11-16', '2026-11-17', 200, 'PENDING', 'CASH', 'BKG-2026-522_INIT', NULL, NULL, NULL, '2026-11-16T09:06:39.4+00:00'),
    ('PAY-BKG-2026-660', 'BKG-2026-660', 'teacher_16', 'TEST TEACHER B', 'mohammadnaim969@gmail.com', '01576668319', 'teacher', '2026-11-16', '2026-11-17', 200, 'PENDING', 'ONLINE', 'BKG-2026-660_1794820519904', NULL, NULL, NULL, '2026-11-16T09:15:19.855+00:00'),
    ('PAY-BKG-2026-730', 'BKG-2026-730', 'user_1', 'TEST TEACHER A', '2204024@student.ruet.ac.bd', '880-1576668319', 'student', '2026-11-16', '2026-11-17', 200, 'PENDING', 'CASH', 'BKG-2026-730_INIT', NULL, NULL, NULL, '2026-11-16T12:02:31.727+00:00'),
    ('PAY-BKG-2026-586', 'BKG-2026-586', 'user_1', 'TEST TEACHER A', '2204024@student.ruet.ac.bd', '880-1576668319', 'student', '2026-11-16', '2026-11-17', 200, 'PAID', 'SSLCOMMERZ', 'BKG-2026-586_1794838500738', '261116201455gyBwJTJVjKv6XtG', '261116201455gyBwJTJVjKv6XtG', '2026-11-16T14:15:14.561+00:00', '2026-11-16T14:15:00.74+00:00')
ON CONFLICT (id) DO UPDATE SET
    booking_id = EXCLUDED.booking_id,
    user_id = EXCLUDED.user_id,
    applicant_name = EXCLUDED.applicant_name,
    applicant_email = EXCLUDED.applicant_email,
    applicant_mobile = EXCLUDED.applicant_mobile,
    applicant_role = EXCLUDED.applicant_role,
    check_in_date = EXCLUDED.check_in_date,
    check_out_date = EXCLUDED.check_out_date,
    amount = EXCLUDED.amount,
    payment_status = EXCLUDED.payment_status,
    payment_method = EXCLUDED.payment_method,
    transaction_id = EXCLUDED.transaction_id,
    bank_tran_id = EXCLUDED.bank_tran_id,
    invoice_number = EXCLUDED.invoice_number,
    paid_at = EXCLUDED.paid_at;

-- ==============================================================================
-- 8. VERIFICATION QUERY
-- ==============================================================================
SELECT 
    tablename, 
    rowsecurity AS rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
