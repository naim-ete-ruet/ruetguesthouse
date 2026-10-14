import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
Font.register({
  family: 'Bornomala',
  fonts: [
    { src: '/fonts/Bornomala-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Bornomala-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: '30px 40px',
    fontFamily: 'Bornomala',
    fontSize: 11,
    lineHeight: 1.4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative'
  },
  logoPlaceholder: {
    position: 'absolute',
    left: 0,
    width: 60,
    height: 60,
    border: '1px solid #000',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTop: {
    fontSize: 9,
    marginBottom: 4,
  },
  headerMain: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  titleText: {
    fontSize: 14,
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  textLabel: {
    marginRight: 5,
  },
  dottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginRight: 10,
    textAlign: 'center',
  },
  dottedLineShort: {
    width: '30%',
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginRight: 10,
    textAlign: 'center',
  },
  dottedLineMedium: {
    width: '40%',
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginRight: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 5,
    marginBottom: 10,
  },
  guestSection: {
    marginLeft: 15,
    marginBottom: 15,
  },
  approvalSection: {
    alignItems: 'flex-end',
    marginTop: 20,
    marginBottom: 40,
  },
  footerSignatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 40,
  },
  signBlock: {
    alignItems: 'center',
    width: '30%',
  },
  signLine: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginBottom: 5,
  },
  signText: {
    fontSize: 10,
    textAlign: 'center',
  }
});

export const GuestHouseApplicationPDF = ({ booking }) => {
  // Ensure we have 3 guests for the form structure
  const guests = [
    booking?.guests?.[0] || { name: '', nid: '', address: '', mobile: '', relationship: '' },
    booking?.guests?.[1] || { name: '', nid: '', address: '', mobile: '', relationship: '' },
    booking?.guests?.[2] || { name: '', nid: '', address: '', mobile: '', relationship: '' },
  ];

  return (
    <Document>
      <Page size="LEGAL" style={styles.page}>

        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>RUET Logo</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTop}>ঐশী জ্যোতিই আমাদের পথ প্রদর্শক</Text>
            <Text style={styles.headerMain}>রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়</Text>
            <Text style={styles.headerSub}>রাজশাহী-৬২০৪ ।</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>রাজশাহীস্থ গেস্ট হাউজের কক্ষ ব্যবহারের আবেদন ফরম</Text>
        </View>

        {/* 01. Applicant Info */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>(০১) আবেদনকারীর নাম :</Text>
          <Text style={styles.dottedLine}>{booking?.applicantName || ''}</Text>
          <Text style={styles.textLabel}>পদবী :</Text>
          <Text style={styles.dottedLineShort}>{booking?.designation || ''}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.textLabel}>বিভাগ/শাখা :</Text>
          <Text style={styles.dottedLineMedium}>{booking?.department || ''}</Text>
          <Text style={styles.textLabel}>মোবাইল নম্বর :</Text>
          <Text style={styles.dottedLine}>{booking?.mobileNumber || ''}</Text>
        </View>

        {/* 02. Guest Info */}
        <View style={styles.sectionTitle}>
          <Text>(০২) অবস্থানকারীর পূর্ণাঙ্গ তথ্য :</Text>
        </View>

        {/* Guest Ka */}
        <View style={styles.guestSection}>
          <View style={styles.row}>
            <Text style={styles.textLabel}>ক) নাম :</Text>
            <Text style={styles.dottedLine}>{guests[0].name}</Text>
            <Text style={styles.textLabel}>NID নম্বর :</Text>
            <Text style={styles.dottedLineShort}>{guests[0].nid}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>ঠিকানা :</Text>
            <Text style={styles.dottedLine}>{guests[0].address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>মোবাইল নম্বর :</Text>
            <Text style={styles.dottedLineMedium}>{guests[0].mobile}</Text>
            <Text style={styles.textLabel}>আবেদনকারীর সাথে সম্পর্ক :</Text>
            <Text style={styles.dottedLine}>{guests[0].relationship}</Text>
          </View>
        </View>

        {/* Guest Kha */}
        <View style={styles.guestSection}>
          <View style={styles.row}>
            <Text style={styles.textLabel}>খ) নাম :</Text>
            <Text style={styles.dottedLine}>{guests[1].name}</Text>
            <Text style={styles.textLabel}>NID নম্বর :</Text>
            <Text style={styles.dottedLineShort}>{guests[1].nid}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>ঠিকানা :</Text>
            <Text style={styles.dottedLine}>{guests[1].address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>মোবাইল নম্বর :</Text>
            <Text style={styles.dottedLineMedium}>{guests[1].mobile}</Text>
            <Text style={styles.textLabel}>আবেদনকারীর সাথে সম্পর্ক :</Text>
            <Text style={styles.dottedLine}>{guests[1].relationship}</Text>
          </View>
        </View>

        {/* Guest Ga */}
        <View style={styles.guestSection}>
          <View style={styles.row}>
            <Text style={styles.textLabel}>গ) নাম :</Text>
            <Text style={styles.dottedLine}>{guests[2].name}</Text>
            <Text style={styles.textLabel}>NID নম্বর :</Text>
            <Text style={styles.dottedLineShort}>{guests[2].nid}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>ঠিকানা :</Text>
            <Text style={styles.dottedLine}>{guests[2].address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.textLabel}>মোবাইল নম্বর :</Text>
            <Text style={styles.dottedLineMedium}>{guests[2].mobile}</Text>
            <Text style={styles.textLabel}>আবেদনকারীর সাথে সম্পর্ক :</Text>
            <Text style={styles.dottedLine}>{guests[2].relationship}</Text>
          </View>
        </View>

        {/* 03. Check-In */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>(০৩) কক্ষ প্রয়োজনের তারিখ :</Text>
          <Text style={styles.dottedLine}>{booking?.checkInDate || ''}</Text>
          <Text style={styles.textLabel}>সময় :</Text>
          <Text style={styles.dottedLineShort}>{booking?.checkInTime || ''}</Text>
        </View>

        {/* 04. Check-Out */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>(০৪) প্রস্থানের তারিখ :</Text>
          <Text style={styles.dottedLine}>{booking?.checkOutDate || ''}</Text>
          <Text style={styles.textLabel}>সময় :</Text>
          <Text style={styles.dottedLineShort}>{booking?.checkOutTime || ''}</Text>
        </View>

        {/* 05. Duration and Room Info */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>(০৫) মোট অবস্থানের দিন :</Text>
          <Text style={styles.dottedLineMedium}>{booking?.totalDays || ''}</Text>
          <Text style={styles.textLabel}>কক্ষ সংখ্যা ও ধরন :</Text>
          <Text style={styles.dottedLine}>{booking?.requestedRoomCount ? `${booking?.requestedRoomCount} x ${booking?.requestedRoomType.replace(/_/g, ' ')}` : ''}</Text>
        </View>

        {/* 06. Purpose */}
        <View style={styles.row}>
          <Text style={styles.textLabel}>(০৬) অবস্থানের কারণ (অফিসিয়াল/ব্যক্তিগত) :</Text>
          <Text style={styles.dottedLine}>{booking?.stayPurpose || ''}</Text>
        </View>

        {/* 07. Signature & Date */}
        <View style={[styles.row, { minHeight: 40 }]}>
          <Text style={styles.textLabel}>(০৭) আবেদনকারীর স্বাক্ষর ও তারিখ :</Text>
          <View style={[styles.dottedLine, { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-end', paddingLeft: 10 }]}>
            {booking?.signatureImage && (
              <Image
                src={booking.signatureImage}
                style={{ height: 35, width: 80, objectFit: 'contain', marginBottom: 0, marginRight: 15 }}
              />
            )}
            <Text style={{ marginBottom: 2, fontSize: 10 }}>
              {new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Approval block */}
        <View style={styles.approvalSection}>
          <Text>অনুমোদিত/ অ-অনুমোদিত</Text>
        </View>

        {/* Signatures */}
        <View style={styles.footerSignatures}>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signText}>বিভাগীয় প্রধান/ শাখা প্রধান</Text>
            <Text style={styles.signText}>সুপারিশ করা হইল/ হইল না ।</Text>
            <Text style={styles.signText}>(অফিসিয়াল বুকিং এর ক্ষেত্রে)</Text>
          </View>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signText}>ইনচার্জ</Text>
            <Text style={styles.signText}>গেস্ট হাউজ</Text>
            <Text style={styles.signText}>রুয়েট, রাজশাহী।</Text>
          </View>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signText}>ভাইস-চ্যান্সেলর</Text>
            <Text style={styles.signText}>রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়।</Text>
            <Text style={styles.signText}>রুয়েট, রাজশাহী।</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};
