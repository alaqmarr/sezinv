import { formatInTimeZone } from "date-fns-tz";
import { IST_TIMEZONE } from "./ist-date.helper";
import type { MisriDateInfo } from "./shared.types";

export const MISRI_MONTH_NAMES_EN = [
  "Moharram-ul-Haraam",
  "Safar-ul-Muzaffar",
  "Rabi-ul-Awwal",
  "Rabi-ul-Aakhar",
  "Jumadal-Ula",
  "Jumadal-Ukhra",
  "Rajab-ul-Asab",
  "Shaban-ul-Karim",
  "Ramadan-ul-Moazzam",
  "Shawwal-ul-Mukarram",
  "Zilqadat-il-Haraam",
  "Zilhaj-il-Haraam",
] as const;

export const MISRI_MONTH_NAMES_AR = [
  "محرم الحرام",
  "صفر المظفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الأخرى",
  "رجب الأصب",
  "شعبان الكريم",
  "رمضان المعظم",
  "شوال المكرم",
  "ذو القعدة الحرام",
  "ذو الحجة الحرام",
] as const;

const LEAP_YEARS_PATTERN = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];
const MISRI_EPOCH_JD = 1948439;

export function toArabicNumerals(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Converts a Gregorian date to the Dawoodi Bohra Fatimid Misri Hijri calendar,
 * anchored strictly to Asia/Kolkata (IST).
 */
export function getMisriDate(date: Date | string): MisriDateInfo {
  let year: number;
  let month: number;
  let day: number;

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const parts = date.trim().split("-").map(Number);
    year = parts[0];
    month = parts[1] - 1;
    day = parts[2];
  } else {
    const d = typeof date === "string" ? new Date(date) : date;
    const dateStr = formatInTimeZone(d, IST_TIMEZONE, "yyyy-MM-dd");
    const parts = dateStr.split("-").map(Number);
    year = parts[0];
    month = parts[1] - 1;
    day = parts[2];
  }

  const a = Math.floor((14 - (month + 1)) / 12);
  const y = year + 4800 - a;
  const m = month + 1 + 12 * a - 3;
  const jd =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  const daysSince = jd - MISRI_EPOCH_JD;
  const daysIn30Years = 10631;
  const cycles = Math.floor(daysSince / daysIn30Years);
  let remainingDays = ((daysSince % daysIn30Years) + daysIn30Years) % daysIn30Years;

  let hijriYear = cycles * 30 + 1;

  for (let i = 1; i <= 30; i++) {
    const isLeap = LEAP_YEARS_PATTERN.includes(i);
    const daysInYear = isLeap ? 355 : 354;
    if (remainingDays < daysInYear) {
      break;
    }
    remainingDays -= daysInYear;
    hijriYear++;
  }

  let hijriMonth = 0;
  const currentCycleYear = ((hijriYear - 1) % 30) + 1;
  const isCurrentLeap = LEAP_YEARS_PATTERN.includes(currentCycleYear);

  for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
    const daysInMonth =
      monthIdx === 11
        ? isCurrentLeap
          ? 30
          : 29
        : monthIdx % 2 === 0
          ? 30
          : 29;

    if (remainingDays < daysInMonth) {
      hijriMonth = monthIdx;
      break;
    }
    remainingDays -= daysInMonth;
  }

  const hijriDay = remainingDays + 1;

  return {
    day: hijriDay,
    month: hijriMonth + 1,
    year: hijriYear,
    monthNameEn: MISRI_MONTH_NAMES_EN[hijriMonth],
    monthNameAr: MISRI_MONTH_NAMES_AR[hijriMonth],
    dayAr: toArabicNumerals(hijriDay),
    yearAr: toArabicNumerals(hijriYear),
    formattedEn: `${hijriDay}${getOrdinal(hijriDay)} ${MISRI_MONTH_NAMES_EN[hijriMonth]} ${hijriYear}H`,
    formattedAr: `${toArabicNumerals(hijriDay)} ${MISRI_MONTH_NAMES_AR[hijriMonth]} ${toArabicNumerals(hijriYear)} هـ`,
  };
}
