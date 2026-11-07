export interface BookingGuidelinesConfig {
  dos: string[];
  donts: string[];
  footerNote: string;
}

export const DEFAULT_BOOKING_GUIDELINES: BookingGuidelinesConfig = {
  dos: [
    "Start and conclude your function strictly within the booked time slot so the hall can be cleaned for the next occasion.",
    "Inform the Jamaat office in advance about your caterer and decorator arrival timings.",
    "Count all Jamaat vessels, Thaals, Chilamchi-Lota, and crockery at the time of taking and again while returning.",
    "Return all store vessels properly washed, dried, and stacked at the store counter within 24 hours of the function.",
    "Use designated dustbins for food waste and ensure kitchen platforms and wash areas are left clean after cooking.",
    "Switch off AC units, fans, lights, and gas cylinders with the hall caretaker before leaving the premises.",
    "Ask guests to park vehicles neatly in allotted spaces without blocking the road or Masjid entrance.",
    "Maintain modest conduct, Jamaat adab, and respect prayer (Namaaz) timings throughout the function.",
  ],
  donts: [
    "Do not hammer nails, screws, staples, or strong glue tape onto hall walls, woodwork, pillars, or false ceilings.",
    "Do not use firecrackers, confetti poppers, smoke machines, or open flames inside the hall premises.",
    "Do not drag heavy tables, chairs, or gas stoves across the marble/tile flooring.",
    "Do not dispose of leftover food, oil, rice, or tea leaves inside washbasins or floor drains.",
    "Do not take Jamaat vessels or furniture outside the premises without prior office entry and permission.",
    "Do not play loud music or use external DJ sound systems inside the Jamaat compound.",
    "Do not alter electrical wiring or connect heavy decorative halogen loads without the hall electrician's approval.",
    "Do not leave personal valuables unattended; the Jamaat office will not be responsible for lost personal belongings.",
  ],
  footerNote:
    "Any damage to hall property or unreturned store items will be adjusted from the refundable security deposit. Thank you for your cooperation in keeping our Jamaat premises clean and well-maintained.",
};
