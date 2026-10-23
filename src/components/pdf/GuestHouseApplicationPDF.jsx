import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

const getAssetUrl = (relativePath) => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${relativePath}`;
  }
  return `http://localhost:5173${relativePath}`;
};

Font.register({
  family: 'Cambria',
  fonts: [
    { src: getAssetUrl('/fonts/Cambria-Regular.ttf'), fontWeight: 'normal' },
    { src: getAssetUrl('/fonts/Cambria-Bold.ttf'), fontWeight: 'bold' },
    { src: getAssetUrl('/fonts/Cambria-Italic.ttf'), fontStyle: 'italic' },
  ]
});


const styles = StyleSheet.create({
  page: {
    padding: '22px 32px',
    fontFamily: 'Cambria',
    fontSize: 9.5,
    lineHeight: 1.3,
    color: '#000000',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
    minHeight: 52,
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    width: 60,
  },
  logoImage: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  paidSealContainer: {
    position: 'absolute',
    right: 0,
    top: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
  },
  paidSealOuter: {
    borderWidth: 1.8,
    borderColor: '#dc2626',
    borderRadius: 3,
    padding: 1.5,
    borderStyle: 'solid',
  },
  paidSealInner: {
    borderWidth: 0.8,
    borderColor: '#dc2626',
    borderRadius: 2,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidSealText: {
    fontSize: 11.5,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#dc2626',
    letterSpacing: 2,
    textAlign: 'center',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerMotto: {
    fontSize: 8.5,
    fontFamily: 'Cambria',
    fontStyle: 'italic',
    color: '#222222',
    marginBottom: 2,
  },
  headerMain: {
    fontSize: 12.5,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 9,
    fontFamily: 'Cambria',
    color: '#333333',
  },
  doubleLineContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 10,
  },
  boldLine: {
    width: '100%',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    marginBottom: 2,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  titleBadge: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 14,
    paddingVertical: 3.5,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  titleText: {
    fontSize: 10.5,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 4,
  },
  sectionTitleText: {
    fontSize: 9.5,
    fontFamily: 'Cambria',
    fontWeight: 'normal',
    color: '#000000',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6.5,
    alignItems: 'flex-end',
  },
  textLabel: {
    fontSize: 9,
    fontFamily: 'Cambria',
    color: '#000000',
    marginRight: 4,
  },
  dottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    paddingBottom: 1,
    marginRight: 6,
    fontSize: 9,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#000000',
    minHeight: 12,
  },
  dottedLineShort: {
    width: '24%',
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    paddingBottom: 1,
    marginRight: 6,
    fontSize: 9,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#000000',
    minHeight: 12,
  },
  dottedLineMedium: {
    width: '36%',
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    paddingBottom: 1,
    marginRight: 6,
    fontSize: 9,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#000000',
    minHeight: 12,
  },
  guestBlock: {
    marginLeft: 12,
    marginBottom: 3,
    paddingBottom: 2,
  },
  approvalSection: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 16,
  },
  approvalBadge: {
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 6,
    paddingVertical: 3.5,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  approvalText: {
    fontSize: 9,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    color: '#111111',
  },
  footerSignatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 16,
  },
  signBlock: {
    alignItems: 'center',
    width: '31%',
  },
  signLine: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    marginBottom: 5,
  },
  signTitle: {
    fontSize: 8.5,
    fontFamily: 'Cambria',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 2,
  },
  signSubtitle: {
    fontSize: 8,
    fontFamily: 'Cambria',
    textAlign: 'center',
    color: '#333333',
    marginBottom: 1,
  },
  signNote: {
    fontSize: 7.5,
    fontFamily: 'Cambria',
    textAlign: 'center',
    color: '#555555',
  }
});

const formatStayPurpose = (purpose) => {
  if (!purpose) return '';
  if (purpose === 'অফিসিয়াল' || String(purpose).toLowerCase() === 'official') return 'Official';
  if (purpose === 'ব্যক্তিগত' || String(purpose).toLowerCase() === 'personal') return 'Personal';
  return purpose;
};

const formatRoomType = (booking) => {
  if (!booking) return '';
  const count = booking.requestedRoomCount || 1;
  const rawType = booking.requestedRoomType || booking.assignedRoom || '';
  if (!rawType) return '';
  const cleanType = rawType.replace(/_/g, ' ');
  return `${count} x ${cleanType}`;
};

export const formatIssueDateTime = (dateObj) => {
  if (!dateObj) dateObj = new Date();
  if (typeof dateObj === 'string' || typeof dateObj === 'number') {
    dateObj = new Date(dateObj);
  }
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year}   (${strHours}:${minutes}:${seconds} ${ampm})`;
};

export const GuestHouseApplicationPDF = ({ booking, issueDateTime }) => {
  const allGuests = booking?.guests || [];
  // Guest A (Resident A) is mandatory in every application
  const guestA = allGuests.find(g => g.key === 'A') || allGuests[0] || { name: '', nid: '', address: '', mobile: '', relationship: '' };

  const formattedIssueDate = formatIssueDateTime(issueDateTime || booking?.issueDateTime);

  // Guest B, Guest C are optional and only included if added from the application form
  const additionalGuests = allGuests.filter(
    g => g !== guestA && (
      (typeof g.name === 'string' && g.name.trim() !== '') ||
      (typeof g.nid === 'string' && g.nid.trim() !== '') ||
      (typeof g.mobile === 'string' && g.mobile.trim() !== '') ||
      (typeof g.address === 'string' && g.address.trim() !== '')
    )
  );

  const logoSrc = getAssetUrl('/images/ruet-logo.jpg');

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.headerContainer}>
          {/* Top-left: RUET Logo (without text) */}
          <View style={styles.logoContainer}>
            <Image src={logoSrc} style={styles.logoImage} />
          </View>

          {/* Centered: Motto, University Name & Address */}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerMotto}>Heaven's Light is Our Guide</Text>
            <Text style={styles.headerMain}>Rajshahi University of Engineering and Technology</Text>
            <Text style={styles.headerSub}>Rajshahi-6204.</Text>
          </View>

          {/* Top-right: PAID Seal */}
          <View style={styles.paidSealContainer}>
            <View style={styles.paidSealOuter}>
              <View style={styles.paidSealInner}>
                <Text style={styles.paidSealText}>PAID</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Double bold parallel separation line between header and under sections */}
        <View style={styles.doubleLineContainer}>
          <View style={styles.boldLine} />
          <View style={styles.boldLine} />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <View style={styles.titleBadge}>
            <Text style={styles.titleText}>Application Form for Guest House Room in Rajshahi</Text>
          </View>
        </View>

        {/* 01. Applicant Info */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>01. Applicant's name:</Text>
          <Text style={styles.dottedLine}>{booking?.applicantName || ''}</Text>
          <Text style={styles.textLabel}>Title:</Text>
          <Text style={styles.dottedLineShort}>{booking?.designation || ''}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.textLabel}>Department:</Text>
          <Text style={styles.dottedLineMedium}>{booking?.department || ''}</Text>
          <Text style={styles.textLabel}>Mobile Number:</Text>
          <Text style={styles.dottedLine}>{booking?.mobileNumber || ''}</Text>
        </View>

        {/* 02. Full information of the resident (not bold) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleText}>02. Full information of the resident:</Text>
        </View>

        {/* Guest A - Mandatory in every application */}
        <View style={styles.guestBlock}>
          <View style={styles.row}>
            <Text style={styles.textLabel}>A) Name:</Text>
            <Text style={styles.dottedLine}>{guestA.name || ''}</Text>
            <Text style={styles.textLabel}>NID Number:</Text>
            <Text style={styles.dottedLineMedium}>{guestA.nid || ''}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>Address:</Text>
            <Text style={styles.dottedLine}>{guestA.address || ''}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>Mobile Number:</Text>
            <Text style={styles.dottedLineMedium}>{guestA.mobile || ''}</Text>
            <Text style={styles.textLabel}>Relationship to the applicant:</Text>
            <Text style={styles.dottedLine}>{guestA.relationship || ''}</Text>
          </View>
        </View>

        {/* Guest B, C - Optional, rendered only if added from the application form */}
        {additionalGuests.map((guest, idx) => {
          const letter = String.fromCharCode(66 + idx); // 'B', 'C'
          return (
            <View key={idx} style={styles.guestBlock}>
              <View style={styles.row}>
                <Text style={styles.textLabel}>{letter}) Name:</Text>
                <Text style={styles.dottedLine}>{guest.name || ''}</Text>
                <Text style={styles.textLabel}>NID Number:</Text>
                <Text style={styles.dottedLineMedium}>{guest.nid || ''}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.textLabel}>Address:</Text>
                <Text style={styles.dottedLine}>{guest.address || ''}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.textLabel}>Mobile Number:</Text>
                <Text style={styles.dottedLineMedium}>{guest.mobile || ''}</Text>
                <Text style={styles.textLabel}>Relationship to the applicant:</Text>
                <Text style={styles.dottedLine}>{guest.relationship || ''}</Text>
              </View>
            </View>
          );
        })}

        {/* 03. Date of room requirement */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>03. Date of room requirement:</Text>
          <Text style={styles.dottedLine}>{booking?.checkInDate || ''}</Text>
          <Text style={styles.textLabel}>Time:</Text>
          <Text style={styles.dottedLineShort}>{booking?.checkInTime || ''}</Text>
        </View>

        {/* 04. Departure date */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>04. Departure date:</Text>
          <Text style={styles.dottedLine}>{booking?.checkOutDate || ''}</Text>
          <Text style={styles.textLabel}>Time:</Text>
          <Text style={styles.dottedLineShort}>{booking?.checkOutTime || ''}</Text>
        </View>

        {/* 05. Total days of stay and Room No. */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>05. Total days of stay:</Text>
          <Text style={styles.dottedLineShort}>{booking?.totalDays || ''}</Text>
          <Text style={styles.textLabel}>Room No. :</Text>
          <Text style={styles.dottedLine}>
            {booking?.assignedRoom || booking?.assigned_room || booking?.roomNumber || booking?.room_number || ''}
          </Text>
        </View>

        {/* 06. Reason for stay */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>06. Reason for stay (official/personal):</Text>
          <Text style={styles.dottedLine}>{formatStayPurpose(booking?.stayPurpose)}</Text>
        </View>

        {/* 07. Date & Time of Issue */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>07. Date & Time of Issue:</Text>
          <Text style={styles.dottedLine}>{formattedIssueDate}</Text>
        </View>

        {/* Approval block */}
        <View style={styles.approvalSection}>
          <View style={styles.approvalBadge}>
            <Text style={styles.approvalText}>Approved/Unapproved</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.footerSignatures}>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>Head of Department</Text>
            <Text style={styles.signSubtitle}>Recommended/ Not Recommended</Text>
            <Text style={styles.signNote}>(For official bookings)</Text>
          </View>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>In Charge</Text>
            <Text style={styles.signSubtitle}>Guest House</Text>
            <Text style={styles.signNote}>RUET, Rajshahi.</Text>
          </View>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>Vice-Chancellor</Text>
            <Text style={styles.signSubtitle}>RUET, Rajshahi.</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};
