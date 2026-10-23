import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { AlertCircle, Plus, Trash2, CheckCircle, FileText, CreditCard } from 'lucide-react';
import { authService } from '../../services/authService';
import { roomService } from '../../services/roomService';
import { API_BASE_URL } from '../../config/api';

export default function BookingForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedRoom, roomType, bookingDate, checkOutDate, totalDays } = location.state || {};

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Step 1 State: Applicant Info
  const [applicantInfo, setApplicantInfo] = useState({
    applicantName: user?.role === 'teacher' ? user.name : '',
    designation: user?.role === 'teacher' ? 'Teacher' : '',
    department: user?.role === 'teacher' ? (user.department || '').toUpperCase() : '',
    mobileNumber: user?.role === 'teacher' ? (user.mobile || '') : ''
  });

  // Step 2 State: Guests (Guest A is mandatory, Guest B & C are optional)
  const [guests, setGuests] = useState([
    { key: 'A', name: '', nid: '', address: '', mobile: '', relationship: '' }
  ]);

  // Step 3 & 4 State: Dates
  const [dates, setDates] = useState({
    checkInDate: bookingDate || '',
    checkInTime: '12:00',
    checkOutDate: checkOutDate || (bookingDate ? new Date(new Date(bookingDate).getTime() + 86400000).toISOString().split('T')[0] : ''),
    checkOutTime: '12:00'
  });

  const [roomDetails, setRoomDetails] = useState({
    totalDays: totalDays || 0,
    requestedRoomCount: 1, // Fixed to 1
    requestedRoomType: roomType || '',
    stayPurpose: 'Personal'
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBooking, setSuccessBooking] = useState(null);

  // Teacher Approval Selection
  const [teachers, setTeachers] = useState([]);
  const [searchTeacherQuery, setSearchTeacherQuery] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
  const teacherDropdownRef = useRef(null);

  // Close teacher dropdown on outside click or tap
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (teacherDropdownRef.current && !teacherDropdownRef.current.contains(event.target)) {
        setIsTeacherDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelectTeacher = (teacher) => {
    setSelectedTeacherId(teacher.id);
    setSearchTeacherQuery(`${teacher.name} (Dept: ${teacher.department || 'N/A'})`);
    setIsTeacherDropdownOpen(false);
  };

  // Dynamic Room Categories
  const [availableCategories, setAvailableCategories] = useState([]);

  useEffect(() => {
    // Fetch room categories from Supabase
    const fetchCategories = async () => {
      try {
        const categories = await roomService.getRoomCategories();
        setAvailableCategories(categories);
      } catch (err) {
        console.error("Failed to fetch room categories", err);
      }
    };
    fetchCategories();

    if (user?.role !== 'teacher') {
      const fetchTeachers = async () => {
        try {
          const allUsers = await authService.getAllUsers();
          setTeachers(allUsers.filter(u => u.role === 'teacher'));
        } catch (err) {
          console.error("Failed to load teachers", err);
        }
      };
      fetchTeachers();
    }
  }, [user]);

  // Update applicant info when a student selects a teacher
  useEffect(() => {
    if (user?.role !== 'teacher' && selectedTeacherId) {
      const teacher = teachers.find(t => t.id === selectedTeacherId);
      if (teacher) {
        setApplicantInfo({
          applicantName: teacher.name,
          designation: teacher.designation || 'Teacher',
          department: (teacher.department || '').toUpperCase(),
          mobileNumber: teacher.mobile || ''
        });
      }
    }
  }, [selectedTeacherId, teachers, user?.role]);

  // Calculate nights automatically
  useEffect(() => {
    if (dates.checkInDate && dates.checkOutDate) {
      const inDate = new Date(dates.checkInDate);
      const outDate = new Date(dates.checkOutDate);
      const diffTime = Math.abs(outDate - inDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      setRoomDetails(prev => ({
        ...prev,
        totalDays: diffDays > 0 ? diffDays : 0
      }));
    }
  }, [dates.checkInDate, dates.checkOutDate]);

  const handleAddGuest = () => {
    if (guests.length >= 3) return;
    const keys = ['A', 'B', 'C'];
    const nextKey = keys[guests.length] || 'B';
    setGuests([...guests, { key: nextKey, name: '', nid: '', address: '', mobile: '', relationship: '' }]);
  };

  const handleRemoveGuest = (index) => {
    // Guest A (index 0) is mandatory and cannot be removed
    if (index === 0) return;
    const newGuests = guests.filter((_, i) => i !== index);
    const keys = ['A', 'B', 'C'];
    newGuests.forEach((g, i) => g.key = keys[i] || String.fromCharCode(65 + i));
    setGuests(newGuests);
  };

  const handleGuestChange = (index, field, value) => {
    const newGuests = [...guests];
    newGuests[index][field] = value;
    setGuests(newGuests);
  };

  const validateForm = () => {
    if (!applicantInfo.applicantName || !applicantInfo.mobileNumber || !applicantInfo.department) {
      return "Applicant information is incomplete.";
    }

    // Guest A is mandatory in every application
    if (!guests[0]?.name || !guests[0]?.nid || !guests[0]?.mobile || !guests[0]?.relationship) {
      return "Guest A (অতিথি A) information is mandatory and must be completely filled.";
    }

    // Guest B, C are optional, but if added, their fields must be filled
    for (let i = 1; i < guests.length; i++) {
      const g = guests[i];
      if (!g.name || !g.nid || !g.mobile || !g.relationship) {
        return `Guest ${g.key || (i === 1 ? 'B' : 'C')} information is incomplete. Please fill all fields or remove the guest.`;
      }
    }

    if (!dates.checkInDate || !dates.checkOutDate) {
      return "Please select check-in and check-out dates.";
    }

    if (new Date(dates.checkOutDate) <= new Date(dates.checkInDate)) {
      return "Checkout date must be after check-in date.";
    }

    if (roomDetails.totalDays <= 0) {
      return "Total days must be at least 1.";
    }

    // Room count logic
    if (guests.length > 2 && roomDetails.requestedRoomType === 'TYPE_3') {
      return "Room Type 3 has a maximum capacity of 2. For 3 guests, request Type 4/5/6 or book multiple rooms separately.";
    }

    if (user.role !== 'teacher' && !selectedTeacherId) {
      return "Please select a teacher for approval request.";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      window.scrollTo(0, 0);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // Find the dynamic rate for the selected category
      let rate = 0;
      try {
        const categories = await roomService.getRoomCategories();
        const selectedCategory = categories.find(c => c.category === roomDetails.requestedRoomType);
        rate = selectedCategory ? selectedCategory.nightlyRate : 0;
      } catch (err) {
        console.error("Failed to fetch rate on submit", err);
      }
      
      const totalAmount = rate * roomDetails.requestedRoomCount * roomDetails.totalDays;

      // Guest A is always kept; Guest B & C are kept if they have details
      const validGuests = guests.filter((g, index) => index === 0 || g.name || g.nid || g.mobile || g.address);

      const bookingData = {
        userId: user.id,
        isTeacherBooking: user.role === 'teacher',
        ...applicantInfo,
        guests: validGuests,
        ...dates,
        ...roomDetails,
        assignedRoom: selectedRoom || null,
        approvingTeacherId: user.role === 'teacher' ? user.id : selectedTeacherId,
        totalAmount
      };

      const newBooking = await bookingService.createBooking(bookingData);

      if (user.role === 'teacher') {
        alert("Booking created successfully! Redirecting to payment...");
        navigate('/teacher/payment');
      } else {
        const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
        
        // Dispatch teacher approval request email (non-blocking with 4s timeout: never freezes UI)
        if (selectedTeacher?.email) {
          fetch(`${API_BASE_URL}/api/email/teacher-approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teacherEmail: selectedTeacher.email,
              teacherName: selectedTeacher.name,
              applicantName: applicantInfo.applicantName,
              applicantMobile: applicantInfo.mobileNumber,
              applicantEmail: user.email,
              guestDetails: guests,
              checkInDate: dates.checkInDate,
              checkOutDate: dates.checkOutDate,
              bookingId: newBooking?.id
            }),
            signal: AbortSignal.timeout(4000)
          }).catch(e => {
            console.warn("Teacher approval notification dispatch error:", e);
          });
        }
        
        const teacherEmail = selectedTeacher?.email || 'the selected teacher';
        alert(`Application submitted successfully! It is now pending approval.\n\nNotification forwarded to ${teacherEmail} for their review.`);
        navigate('/student/history');
      }

    } catch (err) {
      setError("Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      <h1 className="text-2xl font-bold mb-6 pb-2" style={{ borderBottom: '2px solid var(--color-primary)' }}>
        রাজশাহীস্থ গেস্ট হাউজের কক্ষ ব্যবহারের আবেদন ফরম
      </h1>

      {!selectedRoom && (
        <div className="mb-6 p-4 rounded flex flex-col items-center gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
          <AlertCircle size={24} className="flex-shrink-0" />
          <p className="font-bold text-lg">No Room Selected!</p>
          <p>Please select a room first from the availability page before applying.</p>
          <button 
            type="button" 
            onClick={() => navigate(user.role === 'teacher' ? '/teacher/rooms' : '/student/rooms')} 
            className="btn btn-primary mt-2"
          >
            Go to Room Availability
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded flex items-start gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 01 */}
        <section className="card mb-6 hover-scale">
          <h2 className="text-lg font-bold mb-4 bg-primary text-white p-2 rounded">
            01. আবেদনকারীর তথ্য (Applicant Information)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">আবেদনকারীর নাম (Name)</label>
              <input type="text" className="form-input" required
                value={applicantInfo.applicantName}
                onChange={e => setApplicantInfo({ ...applicantInfo, applicantName: e.target.value })}
                readOnly={user?.role !== 'teacher'}
                placeholder={user?.role !== 'teacher' ? "Select a teacher from Section 07" : ""}
                style={user?.role !== 'teacher' ? { backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
              />
            </div>
            <div className="form-group">
              <label className="form-label">পদবী (Designation)</label>
              <input type="text" className="form-input" required
                value={applicantInfo.designation}
                onChange={e => setApplicantInfo({ ...applicantInfo, designation: e.target.value })}
                readOnly={user?.role !== 'teacher'}
                placeholder={user?.role !== 'teacher' ? "Auto-filled" : ""}
                style={user?.role !== 'teacher' ? { backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
              />
            </div>
            <div className="form-group">
              <label className="form-label">বিভাগ/শাখা (Department)</label>
              <input type="text" className="form-input" required
                value={applicantInfo.department}
                onChange={e => setApplicantInfo({ ...applicantInfo, department: e.target.value.toUpperCase() })}
                placeholder={user?.role !== 'teacher' ? "Auto-filled" : "e.g., CSE"}
                readOnly={user?.role !== 'teacher'}
                style={user?.role !== 'teacher' ? { backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
              />
            </div>
            <div className="form-group">
              <label className="form-label">মোবাইল নম্বর (Mobile)</label>
              <input type="text" className="form-input" required
                value={applicantInfo.mobileNumber}
                onChange={e => setApplicantInfo({ ...applicantInfo, mobileNumber: e.target.value })}
                readOnly={user?.role !== 'teacher'}
                placeholder={user?.role !== 'teacher' ? "Auto-filled" : ""}
                style={user?.role !== 'teacher' ? { backgroundColor: 'rgba(0,0,0,0.05)' } : {}}
              />
            </div>
          </div>
        </section>

        {/* Section 02 */}
        <section className="card mb-6 hover-scale">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4 bg-primary text-white p-3 rounded">
            <div>
              <h2 className="text-base sm:text-lg font-bold">02. অবস্থানকারীর তথ্য (Resident / Guest Information)</h2>
              <span className="text-xs opacity-90 block">Guest A is mandatory. Guest B and Guest C are optional.</span>
            </div>
            {guests.length < 3 && (
              <button 
                type="button" 
                onClick={handleAddGuest} 
                className="flex items-center gap-1 hover-scale" 
                style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                <Plus size={14} /> Add Guest
              </button>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {guests.map((guest, index) => (
              <div key={index} className="p-4 rounded border" style={{ borderColor: 'var(--color-border)', position: 'relative' }}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Guest {guest.key} (অতিথি {guest.key})</h3>
                    {index === 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.15)', color: 'var(--color-primary)', fontWeight: 600 }}>
                        Mandatory / আবশ্যক
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: 'var(--color-muted)', fontWeight: 500 }}>
                        Optional / ঐচ্ছিক
                      </span>
                    )}
                  </div>
                  {index > 0 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveGuest(index)} 
                      className="text-danger flex items-center gap-1 text-sm font-medium hover-scale" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={16} /> Remove Guest {guest.key}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group mb-0">
                    <label className="form-label">
                      Name (নাম) <span className="text-danger">*</span>
                    </label>
                    <input type="text" className="form-input" required
                      value={guest.name} onChange={e => handleGuestChange(index, 'name', e.target.value)} />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">
                      NID (NID নম্বর) <span className="text-danger">*</span>
                    </label>
                    <input type="text" className="form-input" required
                      value={guest.nid} onChange={e => handleGuestChange(index, 'nid', e.target.value)} />
                  </div>
                  <div className="form-group mb-0 md:col-span-2">
                    <label className="form-label">Address (ঠিকানা)</label>
                    <input type="text" className="form-input"
                      value={guest.address} onChange={e => handleGuestChange(index, 'address', e.target.value)} />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">
                      Mobile (মোবাইল নম্বর) <span className="text-danger">*</span>
                    </label>
                    <input type="text" className="form-input" required
                      value={guest.mobile} onChange={e => handleGuestChange(index, 'mobile', e.target.value)} />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">
                      Relationship to Applicant (সম্পর্ক) <span className="text-danger">*</span>
                    </label>
                    <input type="text" className="form-input" required placeholder="e.g., Self / Colleague / Relative"
                      value={guest.relationship} onChange={e => handleGuestChange(index, 'relationship', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 03 & 04 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <section className="card hover-scale">
            <h2 className="text-lg font-bold mb-4 bg-primary text-white p-2 rounded">
              03. কক্ষ প্রয়োজনের তারিখ (Check-in)
            </h2>
            <div className="form-group">
              <label className="form-label">তারিখ (Date)</label>
              <input type="date" className="form-input" required
                value={dates.checkInDate}
                onChange={e => setDates({ ...dates, checkInDate: e.target.value })}
                readOnly={!!bookingDate}
                style={bookingDate ? { backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' } : {}}
              />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">সময় (Time)</label>
              <input type="time" className="form-input" required
                value={dates.checkInTime} onChange={e => setDates({ ...dates, checkInTime: e.target.value })}
              />
            </div>
          </section>

          <section className="card hover-scale">
            <h2 className="text-lg font-bold mb-4 bg-primary text-white p-2 rounded">
              04. প্রস্থানের তারিখ (Check-out)
            </h2>
            <div className="form-group">
              <label className="form-label">তারিখ (Date)</label>
              <input type="date" className="form-input" required min={dates.checkInDate}
                value={dates.checkOutDate} 
                onChange={e => setDates({ ...dates, checkOutDate: e.target.value })}
                readOnly={!!checkOutDate || !!bookingDate}
                style={(checkOutDate || bookingDate) ? { backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' } : {}}
              />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">সময় (Time)</label>
              <input type="time" className="form-input" required
                value={dates.checkOutTime} onChange={e => setDates({ ...dates, checkOutTime: e.target.value })}
              />
            </div>
          </section>
        </div>

        {/* Section 05 & 06 */}
        <section className="card mb-6 hover-scale">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <h2 className="text-lg font-bold mb-2 text-primary">05. অবস্থানের দিন</h2>
              <label className="form-label">Total Days</label>
              <input type="number" className="form-input" readOnly value={roomDetails.totalDays} style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
            </div>

            <div className="form-group md:col-span-2">
              <h2 className="text-lg font-bold mb-2 text-primary">কক্ষ সংখ্যা ও ধরন</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Room No.</label>
                  <input type="text" className="form-input font-bold text-primary" readOnly
                    value={selectedRoom || 'Not Selected'}
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' }}
                  />
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <input type="text" className="form-input" readOnly
                    value={roomType ? roomType.replace(/_/g, ' ') : roomDetails.requestedRoomType.replace(/_/g, ' ')}
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded text-sm" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>
            <strong>Note:</strong> Types cannot be mixed. Final room approval will be done by administration.
          </div>
        </section>

        <section className="card mb-8 hover-scale">
          <h2 className="text-lg font-bold mb-4 bg-primary text-white p-2 rounded">
            06. অবস্থানের কারণ (Purpose of Stay)
          </h2>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="purpose" value="Official"
                checked={roomDetails.stayPurpose === 'Official' || roomDetails.stayPurpose === 'অফিসিয়াল'}
                onChange={e => setRoomDetails({ ...roomDetails, stayPurpose: e.target.value })}
              />
              Official (অফিসিয়াল)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="purpose" value="Personal"
                checked={roomDetails.stayPurpose === 'Personal' || roomDetails.stayPurpose === 'ব্যক্তিগত'}
                onChange={e => setRoomDetails({ ...roomDetails, stayPurpose: e.target.value })}
              />
              Personal (ব্যক্তিগত)
            </label>
          </div>
        </section>

        {user.role !== 'teacher' && (
          <section className="card mb-8 hover-scale">
            <h2 className="text-lg font-bold mb-4 bg-primary text-white p-2 rounded">
              07. অনুমোদনকারী শিক্ষক নির্বাচন (Select Teacher for Approval)
            </h2>
            <p className="text-sm text-muted mb-4">
              Search and select a teacher from any department to review and approve your application.
            </p>
            <div className="form-group mb-0 relative" ref={teacherDropdownRef}>
              <input
                type="text"
                className="form-input w-full p-3"
                placeholder="Search teacher by name or department..."
                value={searchTeacherQuery}
                onChange={(e) => {
                  setSearchTeacherQuery(e.target.value);
                  setSelectedTeacherId(''); // Reset selection when typing
                  setIsTeacherDropdownOpen(true);
                }}
                onFocus={() => setIsTeacherDropdownOpen(true)}
              />
              
              {isTeacherDropdownOpen && (
                <div 
                  className="absolute z-10 w-full border rounded shadow-lg max-h-60 overflow-y-auto mt-1" 
                  style={{ 
                    borderColor: 'var(--color-border)', 
                    backgroundColor: 'var(--color-surface, #ffffff)',
                    color: 'var(--color-text)'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {teachers.filter(t =>
                    t.name.toLowerCase().includes(searchTeacherQuery.toLowerCase()) ||
                    (t.department && t.department.toLowerCase().includes(searchTeacherQuery.toLowerCase()))
                  ).map(teacher => (
                    <div 
                      key={teacher.id} 
                      className="p-3 border-b cursor-pointer transition-colors" 
                      style={{ borderColor: 'var(--color-border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectTeacher(teacher);
                      }}
                      onPointerDown={() => {
                        handleSelectTeacher(teacher);
                      }}
                      onClick={() => {
                        handleSelectTeacher(teacher);
                      }}
                    >
                      <div className="font-bold" style={{ color: 'var(--color-text)' }}>{teacher.name}</div>
                      <div className="text-xs text-muted uppercase">Department: {teacher.department || 'N/A'}</div>
                    </div>
                  ))}
                  
                  {teachers.length > 0 && teachers.filter(t =>
                    t.name.toLowerCase().includes(searchTeacherQuery.toLowerCase()) ||
                    (t.department && t.department.toLowerCase().includes(searchTeacherQuery.toLowerCase()))
                  ).length === 0 && (
                    <div className="p-3 text-muted text-sm text-center italic">No teachers found matching your search.</div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 border-top pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button type="button" onClick={() => navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')} className="btn btn-secondary w-full sm:w-auto text-center">Cancel</button>
          <button type="submit" className="btn btn-primary w-full sm:w-auto text-center" disabled={isSubmitting || !selectedRoom}>
            {isSubmitting ? 'Processing...' : (
              user.role === 'teacher' ? (
                <span className="flex items-center justify-center gap-2"><CreditCard size={18} /> Pay Now</span>
              ) : 'Submit Application'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
