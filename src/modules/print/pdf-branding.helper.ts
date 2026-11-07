"use client";

import type jsPDF from "jspdf";
import { formatIST } from "@sezsec/shared";

export const A4_LEFT = 6;
export const A4_WIDTH = 198;
export const A4_RIGHT = 204;

export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function registerArabicFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch("/kanz-marjaan.ttf");
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    doc.addFileToVFS("KanzMarjaan.ttf", base64);
    doc.addFont("KanzMarjaan.ttf", "KanzMarjaan", "normal");
    return true;
  } catch {
    return false;
  }
}

/**
 * Draws a single Fatimid 8-pointed star & geometric lattice tile centered at (cx, cy)
 * matching /fatimid-lattice.svg from the website background.
 */
function drawFatimidStarMotif(doc: jsPDF, cx: number, cy: number, r: number) {
  // Outer 8-pointed star (two rotated squares)
  const s = r * 0.72;
  doc.rect(cx - s / 2, cy - s / 2, s, s, "S");

  const d = r * 0.52;
  doc.line(cx, cy - d, cx + d, cy);
  doc.line(cx + d, cy, cx, cy + d);
  doc.line(cx, cy + d, cx - d, cy);
  doc.line(cx - d, cy, cx, cy - d);

  // Inner rosette ring
  doc.circle(cx, cy, r * 0.16, "S");

  // Connecting lattice rays
  doc.line(cx - r, cy, cx - d, cy);
  doc.line(cx + d, cy, cx + r, cy);
  doc.line(cx, cy - r, cx, cy - d);
  doc.line(cx, cy + d, cx, cy + r);
}

/**
 * Draws the Royal Fatimid Letterhead spanning the full clean A4 content width (198mm)
 * with subtle tiled Arabic geometric lattice pattern, official Anjuman-e-Mohammedi crest (/crest.png),
 * Bismillah, Trust title, and document banner — without outer page border lines.
 * Returns the next Y coordinate in mm.
 */
export function drawFatimidA4Header(
  doc: jsPDF,
  opts: {
    crestDataUrl: string | null;
    hasArabicFont: boolean;
    documentTitle: string;
    subtitle?: string;
    compact?: boolean;
  }
): number {
  const {
    crestDataUrl,
    hasArabicFont,
    documentTitle,
    subtitle = "Hall Bookings, Thaal & Jamaat Arrangements",
    compact = false,
  } = opts;

  const bandX = A4_LEFT;
  const bandY = 6.5;
  const bandW = A4_WIDTH;
  const bandH = compact ? 20 : 23.5;

  // Warm Alabaster background band
  doc.setFillColor(250, 247, 242);
  doc.setDrawColor(217, 195, 152);
  doc.setLineWidth(0.28);
  doc.roundedRect(bandX, bandY, bandW, bandH, 1.8, 1.8, "FD");

  // Tiled subtle Fatimid geometric Arabic lattice pattern inside the header band
  doc.setDrawColor(232, 220, 196);
  doc.setLineWidth(0.14);
  const stepX = 15.2;
  const rows = compact
    ? [bandY + 5.5, bandY + 14.5]
    : [bandY + 6, bandY + 17.5];
  for (const ry of rows) {
    for (let rx = bandX + 7.6; rx < bandX + bandW - 4; rx += stepX) {
      drawFatimidStarMotif(doc, rx, ry, 5.2);
    }
  }

  // Center clean ivory veil behind typography so text stays razor-sharp over the lattice
  doc.setFillColor(250, 247, 242);
  doc.rect(40, bandY + 1.2, 130, bandH - 2.4, "F");

  // Bottom fine brass hairline accent on header band
  doc.setDrawColor(184, 146, 74);
  doc.setLineWidth(0.35);
  doc.line(bandX + 2, bandY + bandH, bandX + bandW - 2, bandY + bandH);

  // Left: Official Anjuman-e-Mohammedi Crest
  const crestSize = compact ? 15.5 : 18;
  const crestX = bandX + 4;
  const crestY = bandY + (bandH - crestSize) / 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(217, 195, 152);
  doc.setLineWidth(0.25);
  doc.roundedRect(
    crestX - 1,
    crestY - 1,
    crestSize + 2,
    crestSize + 2,
    2,
    2,
    "FD"
  );
  if (crestDataUrl) {
    try {
      doc.addImage(crestDataUrl, "PNG", crestX, crestY, crestSize, crestSize);
    } catch {
      // Fallback monogram if image decode fails
    }
  }

  // Right: Subtle Fatimid Brass Seal
  const sealCx = bandX + bandW - 12;
  const sealCy = bandY + bandH / 2;
  doc.setFillColor(251, 246, 235);
  doc.setDrawColor(184, 146, 74);
  doc.setLineWidth(0.28);
  doc.circle(sealCx, sealCy, compact ? 6.5 : 7.5, "FD");
  doc.setDrawColor(184, 146, 74);
  doc.setLineWidth(0.18);
  drawFatimidStarMotif(doc, sealCx, sealCy, compact ? 4.5 : 5.3);

  // Center Typography
  let textY = bandY + (compact ? 5.2 : 5.8);
  if (hasArabicFont) {
    doc.setFont("KanzMarjaan", "normal");
    doc.setFontSize(compact ? 11.5 : 13);
    doc.setTextColor(106, 27, 27);
    doc.text("بسم الله الرحمن الرحيم", 105, textY, { align: "center" });
    textY += compact ? 4.5 : 5.2;
  } else {
    textY += 2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(138, 100, 33); // Antique gold
  doc.text("DAWOODI BOHRA JAMAAT TRUST", 105, textY, { align: "center" });
  textY += compact ? 4.4 : 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 10.5 : 11.8);
  doc.setTextColor(35, 25, 23);
  doc.text("ANJUMAN-E-MOHAMMEDI, SECUNDERABAD", 105, textY, {
    align: "center",
  });
  textY += compact ? 3.8 : 4.3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(110, 93, 85);
  doc.text(subtitle, 105, textY, { align: "center" });

  // Royal Maroon Title Pill Strip
  const stripY = bandY + bandH + 2;
  const stripH = 7;
  doc.setFillColor(106, 27, 27);
  doc.roundedRect(bandX, stripY, bandW, stripH, 1.3, 1.3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(250, 247, 242);
  doc.text(documentTitle.toUpperCase(), 105, stripY + 4.8, {
    align: "center",
  });

  return stripY + stripH + 3.5;
}

/**
 * Draws the standard Anjuman-e-Mohammedi bottom A4 footer across all pages of a jsPDF document.
 */
export function drawFatimidA4Footers(
  doc: jsPDF,
  opts: {
    refCode: string;
    docLabel: string;
  }
) {
  const totalPages = doc.getNumberOfPages();
  const generatedStamp = formatIST(new Date(), "dd MMM yyyy, hh:mm a");

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(217, 195, 152);
    doc.setLineWidth(0.28);
    doc.line(A4_LEFT, 280.5, A4_RIGHT, 280.5);

    // Left: Jamaat title & doc label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(106, 27, 27);
    doc.text("ANJUMAN-E-MOHAMMEDI", A4_LEFT, 285.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 93, 85);
    doc.text(`${opts.docLabel} • Secunderabad Jamaat`, A4_LEFT, 288.8);

    // Center: Page X of Y
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(123, 107, 99);
    doc.text(`Page ${i} of ${totalPages}`, 105, 288.8, { align: "center" });

    // Right: Ref ID & Digital Timestamp
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(35, 25, 23);
    doc.text(`Ref: ${opts.refCode}`, A4_RIGHT, 285.2, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(123, 107, 99);
    doc.text(`Generated on ${generatedStamp}`, A4_RIGHT, 288.8, {
      align: "right",
    });
  }
}
