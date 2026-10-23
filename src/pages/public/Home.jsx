import { Link } from 'react-router-dom';
import { Home as HomeIcon, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="container">
      {/* Hero Section */}
      <section className="text-center py-8 sm:py-12 px-4 mb-8 sm:mb-12 bg-flow animate-fade-in flex flex-col justify-center items-center" style={{
        background: 'linear-gradient(135deg, var(--color-primary), #6366F1, var(--color-primary-hover))',
        color: 'white',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        minHeight: '220px'
      }}>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">RUET Guest House</h1>
        <p className="mb-6 sm:mb-8 max-w-2xl mx-auto text-sm sm:text-base" style={{ opacity: 0.9 }}>
          Welcome to the official guest house booking portal of Rajshahi University of Engineering & Technology.
          Students and faculty can easily book accommodations for their guests.
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 w-full">
          {user ? (
            <>
              <Link to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} className="btn btn-outline-light hover-scale">
                Go to Dashboard
              </Link>
              {user.role === 'student' && (
                <Link to="/student/rooms" className="btn hover-scale" style={{ backgroundColor: 'white', color: 'var(--color-primary)' }}>
                  Book a Room
                </Link>
              )}
              {user.role === 'teacher' && (
                <Link to="/teacher/rooms" className="btn hover-scale" style={{ backgroundColor: 'white', color: 'var(--color-primary)' }}>
                  Book a Room
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/register" className="btn hover-scale" style={{ backgroundColor: 'white', color: 'var(--color-primary)' }}>Book a Room</Link>
              <Link to="/login" className="btn btn-outline-light hover-scale">Login</Link>
            </>
          )}
        </div>
      </section>

      {/* Overview Section */}
      <section className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <HomeIcon className="text-primary" /> Guest House Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="card text-center hover-scale animate-stagger-1">
            <h3 className="font-bold mb-2">4 Floors</h3>
            <p className="text-sm text-muted">Including ground floor with office, lobby, waiting room, and prayer room.</p>
          </div>
          <div className="card text-center hover-scale animate-stagger-2">
            <h3 className="font-bold mb-2">Dining Facility</h3>
            <p className="text-sm text-muted">Available on the ground floor at personal cost.</p>
          </div>
          <div className="card text-center hover-scale animate-stagger-3">
            <h3 className="font-bold mb-2">Conference Room</h3>
            <p className="text-sm text-muted">Located on the 3rd floor for official meetings.</p>
          </div>
          <div className="card text-center hover-scale animate-stagger-4">
            <h3 className="font-bold mb-2">Air Conditioning</h3>
            <p className="text-sm text-muted">Available in all VIP, Type 3, and Type 4/5/6 rooms.</p>
          </div>
        </div>
      </section>

      {/* Rules and Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
        {/* Booking Rules Card */}
        <section className="card hover-scale animate-stagger-1" style={{ borderRadius: '12px' }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Info className="text-primary" size={20} /> Booking Rules
          </h2>
          <ul className="flex-col gap-3 sm:gap-4" style={{ display: 'flex' }}>
            <li className="flex items-start gap-2 text-sm text-text">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-text" style={{ strokeWidth: 2 }} />
              <span style={{ lineHeight: '1.5' }}><strong>Room Type 3:</strong> Requires administrative approval before payment.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-text" style={{ strokeWidth: 2 }} />
              <span style={{ lineHeight: '1.5' }}><strong>Type 4/5/6 Rooms:</strong> Requires immediate payment within 5 minutes.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-text" style={{ strokeWidth: 2 }} />
              <span style={{ lineHeight: '1.5' }}>Room type categories (Type 3 and Type 4/5/6) <strong>cannot be mixed</strong> in a single booking.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-text" style={{ strokeWidth: 2 }} />
              <span style={{ lineHeight: '1.5' }}>Guests must physically stay at the guest house on the reservation dates.</span>
            </li>
          </ul>
        </section>

        {/* Pricing Preview Card */}
        <section className="card hover-scale animate-stagger-2" style={{ borderRadius: '12px' }}>
          <h2 className="text-lg font-bold mb-4 text-text">Pricing Preview</h2>
          <div className="flex-col gap-4 sm:gap-6" style={{ display: 'flex' }}>

            <div className="flex justify-between items-center gap-2">
              <div>
                <h4 className="font-bold text-base mb-1 text-text">Room Type 3</h4>
                <p className="text-muted text-xs">Single/couple bed, Attached bath, AC</p>
              </div>
              <div className="text-primary font-bold text-lg sm:text-xl flex-shrink-0">
                ৳200<span className="text-muted font-bold text-xs">/night</span>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2">
              <div>
                <h4 className="font-bold text-base mb-1 text-text">Room Type 4/5/6</h4>
                <p className="text-muted text-xs">1 or 2 beds (4×7 ft), Non-attached bath, AC</p>
              </div>
              <div className="text-primary font-bold text-lg sm:text-xl flex-shrink-0">
                ৳150<span className="text-muted font-bold text-xs">/night</span>
              </div>
            </div>

          </div>
        </section>
      </div>

      <footer className="text-center py-8 text-sm text-muted border-top" style={{ borderTop: '1px solid var(--color-border)' }}>
        <p>&copy; {new Date().getFullYear()} Rajshahi University of Engineering & Technology. All rights reserved.</p>
      </footer>
    </div>
  );
}
