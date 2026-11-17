export const emails = {
  footer: {
    en: 'You are receiving this email because of activity on {platform}.',
    de: 'Sie erhalten diese E-Mail aufgrund einer Aktivität auf {platform}.',
  },
  button: { en: 'Open', de: 'Öffnen' },
  claimInvitation: {
    subject: { en: 'Claim the profile of {school} on {platform}', de: 'Übernehmen Sie das Profil von {school} auf {platform}' },
    heading: { en: 'Your school is listed on {platform}', de: 'Ihre Schule ist auf {platform} gelistet' },
    body: {
      en: 'We list language schools in NRW so students can find courses with confirmed dates, transparent prices and free places. {school} is in our directory. Claim your profile to publish your courses, manage seats and accept bookings. Listing in our directory does not mean you have agreed to anything — only schools that claim their profile can receive bookings.',
      de: 'Wir listen Sprachschulen in NRW, damit Lernende Kurse mit festen Terminen, transparenten Preisen und freien Plätzen finden. {school} ist in unserem Verzeichnis. Übernehmen Sie Ihr Profil, um Kurse zu veröffentlichen, Plätze zu verwalten und Buchungen anzunehmen. Der Eintrag im Verzeichnis bedeutet keine Zustimmung – nur Schulen, die ihr Profil übernehmen, können Buchungen erhalten.',
    },
    cta: { en: 'Claim profile', de: 'Profil übernehmen' },
    expires: { en: 'This link is valid for {days} days.', de: 'Dieser Link ist {days} Tage gültig.' },
  },
  adminClaim: {
    subject: { en: 'New profile claim: {school}', de: 'Neue Profilübernahme: {school}' },
    body: { en: '{name} has asked to manage {school}. Please verify that they are authorised.', de: '{name} möchte {school} verwalten. Bitte prüfen Sie die Berechtigung.' },
    cta: { en: 'Review claim', de: 'Antrag prüfen' },
  },
  claimApproved: {
    subject: { en: 'You now manage {school} on {platform}', de: 'Sie verwalten jetzt {school} auf {platform}' },
    body: {
      en: 'Hello {name}, your claim for {school} has been approved. You can now add branches, courses and dated intakes. Turn on instant booking once your seat numbers are up to date.',
      de: 'Hallo {name}, Ihre Profilübernahme für {school} wurde bestätigt. Sie können jetzt Standorte, Kurse und Termine anlegen. Aktivieren Sie die Sofortbuchung, sobald Ihre Platzzahlen aktuell sind.',
    },
    cta: { en: 'Open school app', de: 'Schul-App öffnen' },
  },
  claimRejected: {
    subject: { en: 'Your claim for {school}', de: 'Ihre Profilübernahme für {school}' },
    body: {
      en: 'Hello {name}, we could not confirm that you are authorised to manage {school}.',
      de: 'Hallo {name}, wir konnten nicht bestätigen, dass Sie berechtigt sind, {school} zu verwalten.',
    },
    reason: { en: 'Reason: {note}', de: 'Begründung: {note}' },
  },
  staffInvitation: {
    subject: { en: '{inviter} invited you to {school}', de: '{inviter} hat Sie zu {school} eingeladen' },
    body: {
      en: '{inviter} has invited you to help manage {school} on {platform}. Sign in or create an account with this email address to accept.',
      de: '{inviter} hat Sie eingeladen, {school} auf {platform} mitzuverwalten. Melden Sie sich mit dieser E-Mail-Adresse an oder registrieren Sie sich, um die Einladung anzunehmen.',
    },
    cta: { en: 'Accept invitation', de: 'Einladung annehmen' },
  },
  bookingConfirmed: {
    subject: { en: 'Booking confirmed: {course} ({reference})', de: 'Buchung bestätigt: {course} ({reference})' },
    heading: { en: 'Your place is confirmed', de: 'Ihr Platz ist bestätigt' },
    intro: { en: 'Hello {name}, your booking is confirmed. Your booking reference is {reference}.', de: 'Hallo {name}, Ihre Buchung ist bestätigt. Ihre Buchungsnummer lautet {reference}.' },
    course: { en: 'Course', de: 'Kurs' },
    school: { en: 'School', de: 'Schule' },
    location: { en: 'Location', de: 'Ort' },
    dates: { en: 'Dates', de: 'Zeitraum' },
    schedule: { en: 'Schedule', de: 'Unterrichtszeiten' },
    total: { en: 'Total price', de: 'Gesamtpreis' },
    paid: { en: 'Paid', de: 'Bezahlt' },
    payAtSchool: { en: 'To pay at the school', de: 'Zahlung an der Schule' },
    cancellation: { en: 'Cancellation terms', de: 'Stornobedingungen' },
    cta: { en: 'View booking', de: 'Buchung ansehen' },
  },
  schoolNewBooking: {
    subject: { en: 'New booking {reference}: {course}', de: 'Neue Buchung {reference}: {course}' },
    body: {
      en: '{student} booked {course} starting {start}. {seats} places left on this intake.',
      de: '{student} hat {course} ab {start} gebucht. Für diesen Termin sind noch {seats} Plätze frei.',
    },
    cta: { en: 'Open booking', de: 'Buchung öffnen' },
  },
  bookingRefunded: {
    subject: { en: 'We could not confirm your booking — full refund issued', de: 'Buchung nicht möglich – Betrag vollständig erstattet' },
    body: {
      en: 'Hello {name}, your payment for {course} arrived after the last place was taken or the course was closed. We have refunded {amount} in full. It usually reaches your account within 5–10 days.',
      de: 'Hallo {name}, Ihre Zahlung für {course} ist eingegangen, nachdem der letzte Platz vergeben oder der Kurs geschlossen wurde. Wir haben {amount} vollständig erstattet. Die Gutschrift erfolgt in der Regel innerhalb von 5–10 Tagen.',
    },
  },
  bookingCancelled: {
    subject: { en: 'Booking cancelled: {reference}', de: 'Buchung storniert: {reference}' },
    body: { en: 'Hello {name}, your booking {reference} for {course} has been cancelled.', de: 'Hallo {name}, Ihre Buchung {reference} für {course} wurde storniert.' },
    refund: { en: 'A refund of {amount} has been issued.', de: 'Eine Erstattung von {amount} wurde veranlasst.' },
  },
  bookingTransferred: {
    subject: { en: 'Your booking moved to a new date: {reference}', de: 'Ihre Buchung wurde verlegt: {reference}' },
    body: {
      en: 'Hello {name}, your place has been moved to {course} starting {start}. Your new booking reference is {reference}.',
      de: 'Hallo {name}, Ihr Platz wurde auf {course} ab {start} verlegt. Ihre neue Buchungsnummer lautet {reference}.',
    },
  },
  enquiryReceived: {
    subject: { en: 'New enquiry: {course}', de: 'Neue Anfrage: {course}' },
    body: { en: '{name} asked about {course}: “{message}”', de: '{name} hat zu {course} angefragt: „{message}“' },
    cta: { en: 'Reply', de: 'Antworten' },
  },
  enquiryAnswered: {
    subject: { en: '{school} replied to your enquiry', de: '{school} hat auf Ihre Anfrage geantwortet' },
    body: { en: 'Hello {name}, {school} replied about {course}:', de: 'Hallo {name}, {school} hat zu {course} geantwortet:' },
    notGuaranteed: {
      en: 'An enquiry does not reserve a place. Book directly if the course shows “Book instantly”.',
      de: 'Eine Anfrage reserviert keinen Platz. Buchen Sie direkt, wenn der Kurs „Sofort buchen“ anzeigt.',
    },
  },
  directEnrolment: {
    subject: { en: 'Your place at {school}: {course}', de: 'Ihr Platz bei {school}: {course}' },
    intro: { en: 'Hello {name}, {school} has registered you for {course}. Your booking reference is {reference}.', de: 'Hallo {name}, {school} hat Sie für {course} angemeldet. Ihre Buchungsnummer lautet {reference}.' },
  },
} as const
