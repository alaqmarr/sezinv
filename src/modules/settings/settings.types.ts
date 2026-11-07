import type { BookingGuidelinesConfig } from "@sezsec/print/dos-and-donts.constants";

export interface HallVenueItem {
  id: string;
  name: string;
  width: number | null;
  length: number | null;
}

export interface DirectoryContactItem {
  id: string;
  name: string;
  phone: string;
}

export interface OfficeEmailSettingsSummary {
  smtpEmail: string;
  hasPassword: boolean;
  maskedPassword: string;
}

export interface PortalMasterSettings {
  bookingWindowMinutes: number;
  guidelines: BookingGuidelinesConfig;
  halls: HallVenueItem[];
  caterers: DirectoryContactItem[];
  decorators: DirectoryContactItem[];
  emailSettings: OfficeEmailSettingsSummary;
}
