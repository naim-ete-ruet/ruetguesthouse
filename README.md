# RUET Guest House Management System

A web application designed for managing guest house bookings, meal reservations, teacher approvals, and digital payments at Rajshahi University of Engineering & Technology (RUET).

## 🚀 Features

- **Room Booking & Allocation**: Reserve and manage rooms with real-time status and availability.
- **Teacher Approval Workflow**: Automated teacher approval notifications for student applications.
- **Meal Booking System**: Order meals linked to room reservations.
- **Digital Payments**: Integrated SSLCommerz payment gateway and cash payment verification.
- **PDF Generation**: Download official guest house application forms with digital signatures.
- **Role-Based Access**: Dedicated portals for Students, Teachers, and Administrators.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, React Router v7, Lucide Icons, `@react-pdf/renderer`
- **Backend**: Node.js, Express, Nodemailer, SSLCommerz LTS
- **Database & Auth**: Supabase

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/naim-ete-ruet/ruetguesthouse.git
cd ruetguesthouse
```

### 2. Install dependencies
```bash
# Frontend
npm install

# Backend (optional, for email/payment server)
cd backend
npm install
cd ..
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory based on `.env.example`:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional Backend URL (defaults to http://localhost:5000)
VITE_BACKEND_URL=http://localhost:5000

# Backend Credentials (used only by backend server)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
STORE_ID=your_sslcommerz_store_id
STORE_PASSWORD=your_sslcommerz_store_password
```

### 4. Run Locally
```bash
# Start Frontend (http://localhost:5173)
npm run dev

# Start Backend Server (in a separate terminal, port 5000)
cd backend
npm run dev # or node server.js
```

## 🌐 Deploying to Netlify

1. Connect your GitHub repository (`naim-ete-ruet/ruetguesthouse`) to Netlify.
2. Netlify will automatically detect the build settings via `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. In **Site Configuration > Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
   - `VITE_BACKEND_URL`: (Optional) Your hosted backend URL (e.g., Render/Railway)
4. Trigger deploy!
