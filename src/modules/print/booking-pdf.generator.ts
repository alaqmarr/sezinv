"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatIST,
  formatRupees,
  formatTimeDisplay,
  getMisriDate,
  isSelfEventVenue,
} from "@sezsec/shared";
import type { PortalEvent } from "@sezsec/events";
import type { BookingGuidelinesConfig } from "./dos-and-donts.constants";
import {
  A4_LEFT,
  A4_RIGHT,
  A4_WIDTH,
  drawFatimidA4Footers,
  drawFatimidA4Header,
  loadImageAsDataUrl,
  registerArabicFont,
} from "./pdf-branding.helper";

function fmtPdfRs(amount: number | null | undefined): string {
  const num = Number(amount) || 0;
  return `Rs. ${formatRupees(num, false)}`;
}

export async function downloadBookingPdf(options: {
  event: PortalEvent;
  guidelines: BookingGuidelinesConfig;
  mode: "BOOKING_FORM" | "CHECKLIST";
  includeDosAndDonts: boolean;
  showAmounts: boolean;
}): Promise<void> {
  const { event, guidelines, mode, includeDosAndDonts, showAmounts } = options;
  const isChecklist = mode === "CHECKLIST";
  const canPrintAmounts = !isChecklist && showAmounts && !event.amountsLocked;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const [crestDataUrl, hasArabicFont] = await Promise.all([
    loadImageAsDataUrl("/crest.png"),
    registerArabicFont(doc),
  ]);

  const refCode =
    event.reference ||
    `${formatIST(event.occasionDate, "yyyyMMdd")}-${event.mobile}`;

  // =========================================================================
  // PAGE 1 (STRICT SINGLE A4 SHEET: 210mm x 297mm, clean 6mm margins = 198mm)
  // =========================================================================
  let y = drawFatimidA4Header(doc, {
    crestDataUrl,
    hasArabicFont,
    documentTitle: isChecklist
      ? "Hall & Store Verification Checklist"
      : "Miqaat Booking Confirmation Form",
    subtitle: "Miqaat Hall Booking, Store Vessels & Jamaat Arrangements",
  });

  // 1. Reference & Misri / Gregorian Date Strip
  const misri = getMisriDate(event.occasionDate);
  doc.setFillColor(251, 246, 235);
  doc.setDrawColor(217, 195, 152);
  doc.setLineWidth(0.25);
  doc.roundedRect(A4_LEFT, y, A4_WIDTH, 11, 1.4, 1.4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(35, 25, 23);
  doc.text(`Booking Ref: ${refCode}`, A4_LEFT + 3.5, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(74, 59, 54);
  doc.text(
    `${formatIST(event.occasionDate, "EEEE, dd MMMM yyyy")}  •  ${formatTimeDisplay(event.occasionTime)}`,
    A4_LEFT + 3.5,
    y + 8.8
  );

  if (hasArabicFont) {
    doc.setFont("KanzMarjaan", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(106, 27, 27);
    doc.text(misri.formattedAr, A4_RIGHT - 3.5, y + 4.8, { align: "right" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(106, 27, 27);
  doc.text(`Hijri: ${misri.formattedEn}`, A4_RIGHT - 3.5, y + 8.9, {
    align: "right",
  });

  y += 14;

  // 2. Booker & Occasion (2-Column Executive Block)
  const col1X = A4_LEFT;
  const col2X = 108;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(123, 107, 99);
  doc.text("BOOKER DETAILS", col1X, y);
  doc.text("OCCASION DETAILS", col2X, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.setTextColor(35, 25, 23);
  const bookerNameLines = doc.splitTextToSize(event.name || "—", 98);
  doc.text(bookerNameLines[0], col1X, y + 4.6);

  const occasionLines = doc.splitTextToSize(event.description || "—", 94);
  doc.text(occasionLines[0], col2X, y + 4.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(61, 46, 42);
  doc.text(
    `Mobile: ${event.mobile}${event.email ? `  •  ${event.email}` : ""}`,
    col1X,
    y + 9
  );
  doc.text(
    `${event.eventType === "PUBLIC" ? "Public Jamaat Miqaat" : "Private Family Function"}  •  Raza: ${event.razaGranted ? "Granted" : "Pending"}`,
    col2X,
    y + 9
  );

  y += 12.5;

  // 3. Venue, Catering & Decorator Box
  const isSelf = isSelfEventVenue(event.halls);
  const hallsDisplay =
    event.halls
      .map((h) =>
        event.hallCounts?.[h] ? `${h} (${event.hallCounts[h]})` : h
      )
      .join(", ") || "Self";

  const hasDecorator = Boolean(event.decorations && !isSelf);
  const splitHalls = doc.splitTextToSize(hallsDisplay, hasDecorator ? 69 : 96);
  const catererDisplay = `${event.catererName || "Self"}${event.catererPhone ? ` (${event.catererPhone})` : ""}`;
  const splitCaterer = doc.splitTextToSize(
    catererDisplay,
    hasDecorator ? 60 : 92
  );
  const decoratorDisplay = `${event.decoratorName || "To be confirmed"}${event.decoratorPhone ? ` (${event.decoratorPhone})` : ""}`;
  const splitDecorator = doc.splitTextToSize(decoratorDisplay, 56);

  const venueLines = Math.max(
    splitHalls.length,
    splitCaterer.length,
    hasDecorator ? splitDecorator.length : 1
  );
  const venueBoxH = Math.max(15.5, 10 + venueLines * 3.8);

  doc.setFillColor(250, 247, 242);
  doc.setDrawColor(216, 206, 190);
  doc.setLineWidth(0.25);
  doc.roundedRect(A4_LEFT, y, A4_WIDTH, venueBoxH, 1.4, 1.4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(106, 27, 27);
  doc.text("HALL(S) / VENUE", A4_LEFT + 3.5, y + 4.5);

  const catColX = hasDecorator ? 81 : 108;
  doc.text("CATERER", catColX, y + 4.5);
  if (hasDecorator) {
    doc.text("DECORATOR", 144, y + 4.5);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 25, 23);
  doc.text(splitHalls, A4_LEFT + 3.5, y + 8.8);
  doc.text(splitCaterer, catColX, y + 8.8);
  if (hasDecorator) {
    doc.text(splitDecorator, 144, y + 8.8);
  }

  y += venueBoxH + 4.5;

  // 4. Requirements & Menu Side-by-Side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(106, 27, 27);
  doc.text("REQUIREMENTS & ARRANGEMENTS", A4_LEFT, y);
  doc.text("FOOD MENU", 138, y);
  y += 2;

  const reqStartY = y + 3.2;
  const reqColW = 61;
  const reqCol1X = A4_LEFT;
  const reqCol2X = 72;
  const reqRowH = 5.8;

  const drawReqRow = (label: string, val: string, x: number, rowY: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(94, 79, 74);
    doc.text(label, x, rowY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 25, 23);
    doc.text(val, x + reqColW, rowY, { align: "right" });

    doc.setDrawColor(224, 214, 198);
    doc.setLineWidth(0.18);
    doc.line(x, rowY + 1.2, x + reqColW, rowY + 1.2);
  };

  drawReqRow("Thaal Count", String(event.thaalCount || 0), reqCol1X, reqStartY);
  drawReqRow(
    "Sarkari Sets",
    String(event.sarkariThaalSet || 0),
    reqCol2X,
    reqStartY
  );

  drawReqRow(
    "Tables & Chairs",
    String(event.tablesAndChairs || 0),
    reqCol1X,
    reqStartY + reqRowH
  );
  drawReqRow(
    "Extra Chilamchi",
    String(event.extraChilamchiLota || 0),
    reqCol2X,
    reqStartY + reqRowH
  );

  drawReqRow(
    "AC Start Time",
    event.acStartTime ? formatTimeDisplay(event.acStartTime) : "NA",
    reqCol1X,
    reqStartY + reqRowH * 2
  );
  drawReqRow(
    "Party Time",
    event.partyTime ? formatTimeDisplay(event.partyTime) : "NA",
    reqCol2X,
    reqStartY + reqRowH * 2
  );

  drawReqRow(
    "Gas Count",
    String(event.gasCount || 0),
    reqCol1X,
    reqStartY + reqRowH * 3
  );
  drawReqRow(
    "Decorations",
    event.decorations ? "Yes" : "No",
    reqCol2X,
    reqStartY + reqRowH * 3
  );

  // Checked Requirement Badges below the 4 rows
  let reqBottomY = reqStartY + reqRowH * 3 + 5.5;
  const checkedItems = [
    { label: "Bhai Saab Izzan", active: event.bhaiSaabIzzan },
    { label: "Muraqebeen Izzan", active: event.muraqebeenIzzan },
    { label: "Ben Saab Izzan", active: event.benSaabIzzan },
    { label: "Microphone", active: event.mic },
    { label: "Store Crockery", active: event.crockeryRequired },
    { label: "Thaal for Devri", active: event.thaalForDevri },
    { label: "PAAT", active: event.paat },
    { label: "Masjid Light", active: event.masjidLight },
  ].filter((item) => item.active);

  if (checkedItems.length > 0) {
    let chipX = A4_LEFT;
    let chipY = reqBottomY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);

    for (const item of checkedItems) {
      const w = doc.getTextWidth(item.label) + 7.5;
      if (chipX + w > 134) {
        chipX = A4_LEFT;
        chipY += 5.2;
      }
      doc.setFillColor(232, 243, 236);
      doc.setDrawColor(183, 219, 195);
      doc.roundedRect(chipX, chipY - 3.3, w, 4.5, 1, 1, "FD");

      // Check tick
      doc.setDrawColor(42, 96, 65);
      doc.setLineWidth(0.35);
      doc.line(chipX + 1.5, chipY - 1.1, chipX + 2.3, chipY - 0.3);
      doc.line(chipX + 2.3, chipY - 0.3, chipX + 3.8, chipY - 2.1);

      doc.setTextColor(42, 96, 65);
      doc.text(item.label, chipX + 5, chipY - 0.3);
      chipX += w + 1.8;
    }
    reqBottomY = chipY + 3.5;
  }

  // Menu Box on the right (x = 138..204, w = 66mm)
  const menuW = A4_RIGHT - 138;
  const menuLines = doc
    .splitTextToSize(event.menu || "No menu specified.", menuW - 5)
    .slice(0, 7);
  const menuBoxH = Math.max(reqBottomY - y, menuLines.length * 3.8 + 6);
  doc.setFillColor(250, 247, 242);
  doc.setDrawColor(216, 206, 190);
  doc.setLineWidth(0.22);
  doc.roundedRect(138, y, menuW, menuBoxH, 1.4, 1.4, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(35, 25, 23);
  doc.text(menuLines, 140.5, y + 4.5);

  y = Math.max(reqBottomY, y + menuBoxH) + 5;

  // 5. Lagat Details & Refundable Deposit Box (or Caretaker Verification Checklist)
  if (isChecklist) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(106, 27, 27);
    doc.text("POST-FUNCTION HALL & STORE VERIFICATION", A4_LEFT, y);
    y += 1.8;

    autoTable(doc, {
      startY: y,
      margin: { left: A4_LEFT, right: A4_LEFT },
      theme: "grid",
      head: [["Inspection Point", "Verified", "Caretaker Remarks"]],
      body: [
        ["Hall floor, carpets & wash areas left clean", "[  ] Yes   [  ] No", ""],
        ["AC units, fans, lights & sound switched off", "[  ] Yes   [  ] No", ""],
        ["Decorations cleared without wall/pillar damage", "[  ] Yes   [  ] No", ""],
        ["Store Thaals & vessels returned washed & counted", "[  ] Yes   [  ] No", ""],
        ["Actual Thaals served count recorded", "[  ] Yes   [  ] No", ""],
      ],
      headStyles: {
        fillColor: [106, 27, 27],
        textColor: [250, 247, 242],
        fontSize: 7.8,
        cellPadding: 2,
      },
      styles: {
        fontSize: 7.8,
        cellPadding: 2,
        textColor: [35, 25, 23],
        lineColor: [216, 206, 190],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 90, fontStyle: "bold" },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 68 },
      },
    });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(106, 27, 27);
    doc.text("LAGAT / BOOKING CHARGES DETAILS", A4_LEFT, y);
    y += 1.8;

    const depositBoxW = 38;
    const depositBoxGap = 4;
    const leftAreaW = A4_WIDTH - depositBoxW - depositBoxGap; // 156mm

    const generalRows: string[][] = [];
    const hallRows: string[][] = [];

    if (canPrintAmounts) {
      if ((event.thaalAmount || 0) > 0) {
        const count = event.thaalCount || 0;
        const rate =
          event.thaalRate || (count > 0 ? (event.thaalAmount || 0) / count : 0);
        generalRows.push([
          "Thaal Charges",
          count > 0 ? String(count) : "1",
          rate > 0 ? fmtPdfRs(rate) : "—",
          fmtPdfRs(event.thaalAmount),
        ]);
      }
      if ((event.sarkariAmount || 0) > 0) {
        const count = event.sarkariThaalSet || 0;
        const rate =
          event.sarkariRate ||
          (count > 0 ? (event.sarkariAmount || 0) / count : 0);
        generalRows.push([
          "Sarkari Thaal Sets",
          count > 0 ? String(count) : "1",
          rate > 0 ? fmtPdfRs(rate) : "—",
          fmtPdfRs(event.sarkariAmount),
        ]);
      }
      if ((event.kitchenCharge || 0) > 0) {
        generalRows.push([
          "Kitchen / Gas Charge",
          "1",
          fmtPdfRs(event.kitchenCharge),
          fmtPdfRs(event.kitchenCharge),
        ]);
      }
      if ((event.decorationCharge || 0) > 0) {
        generalRows.push([
          "Decoration Charge",
          "1",
          fmtPdfRs(event.decorationCharge),
          fmtPdfRs(event.decorationCharge),
        ]);
      }
      if ((event.otherCharge || 0) > 0) {
        generalRows.push([
          "Other / Misc Charge",
          "1",
          fmtPdfRs(event.otherCharge),
          fmtPdfRs(event.otherCharge),
        ]);
      }
      if (event.hallCharges) {
        for (const [hallName, amt] of Object.entries(event.hallCharges)) {
          if (amt > 0) {
            hallRows.push([hallName, fmtPdfRs(amt)]);
          }
        }
      }
    }

    const tableTopY = y;
    let tablesBottomY = y;

    if (canPrintAmounts && (generalRows.length > 0 || hallRows.length > 0)) {
      if (generalRows.length > 0 && hallRows.length > 0) {
        // Side-by-side General Items + Hall Charges across 156mm
        const genW = 88;
        const hallW = leftAreaW - genW - 3; // 65mm

        autoTable(doc, {
          startY: tableTopY,
          margin: { left: A4_LEFT, right: 210 - (A4_LEFT + genW) },
          theme: "grid",
          head: [["General Item", "Qty", "Rate", "Amount"]],
          body: generalRows,
          headStyles: {
            fillColor: [106, 27, 27],
            textColor: [250, 247, 242],
            fontSize: 7.4,
            cellPadding: 1.7,
          },
          styles: {
            fontSize: 7.4,
            cellPadding: 1.7,
            textColor: [35, 25, 23],
            lineColor: [216, 206, 190],
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { cellWidth: 35, fontStyle: "bold" },
            1: { cellWidth: 11, halign: "center" },
            2: { cellWidth: 20, halign: "right" },
            3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const leftEnd = (doc as any).lastAutoTable.finalY;

        autoTable(doc, {
          startY: tableTopY,
          margin: {
            left: A4_LEFT + genW + 3,
            right: 210 - (A4_LEFT + genW + 3 + hallW),
          },
          theme: "grid",
          head: [["Hall Charges", "Amount"]],
          body: hallRows,
          headStyles: {
            fillColor: [106, 27, 27],
            textColor: [250, 247, 242],
            fontSize: 7.4,
            cellPadding: 1.7,
          },
          styles: {
            fontSize: 7.4,
            cellPadding: 1.7,
            textColor: [35, 25, 23],
            lineColor: [216, 206, 190],
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { cellWidth: hallW - 22, fontStyle: "bold" },
            1: { cellWidth: 22, halign: "right", fontStyle: "bold" },
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rightEnd = (doc as any).lastAutoTable.finalY;
        tablesBottomY = Math.max(leftEnd, rightEnd);
      } else {
        // Unified single table across leftAreaW (156mm)
        const unifiedRows =
          generalRows.length > 0
            ? generalRows
            : hallRows.map(([h, amt]) => [`Hall: ${h}`, "1", amt, amt]);
        autoTable(doc, {
          startY: tableTopY,
          margin: { left: A4_LEFT, right: 210 - (A4_LEFT + leftAreaW) },
          theme: "grid",
          head: [["Particulars", "Qty", "Rate", "Amount"]],
          body: unifiedRows,
          headStyles: {
            fillColor: [106, 27, 27],
            textColor: [250, 247, 242],
            fontSize: 7.6,
            cellPadding: 1.8,
          },
          styles: {
            fontSize: 7.6,
            cellPadding: 1.8,
            textColor: [35, 25, 23],
            lineColor: [216, 206, 190],
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { cellWidth: 78, fontStyle: "bold" },
            1: { cellWidth: 16, halign: "center" },
            2: { cellWidth: 30, halign: "right" },
            3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tablesBottomY = (doc as any).lastAutoTable.finalY;
      }

      // Grand Total Bar spanning leftAreaW
      doc.setFillColor(251, 246, 235);
      doc.setDrawColor(184, 146, 74);
      doc.setLineWidth(0.28);
      doc.rect(A4_LEFT, tablesBottomY + 0.6, leftAreaW, 7.2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(35, 25, 23);
      doc.text("GRAND TOTAL (Excl. Deposit)", A4_LEFT + 3, tablesBottomY + 5.2);
      doc.setTextColor(106, 27, 27);
      doc.setFontSize(8.8);
      doc.text(
        fmtPdfRs(event.totalAmount || 0),
        A4_LEFT + leftAreaW - 3,
        tablesBottomY + 5.2,
        { align: "right" }
      );
      tablesBottomY += 7.8;

      if (event.paymentMode || event.amountNotes) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.4);
        doc.setTextColor(94, 79, 74);
        const payParts: string[] = [];
        if (event.paymentMode) {
          payParts.push(
            `Payment Mode: ${event.paymentMode}${event.transactionId ? ` (Tx Ref: ${event.transactionId})` : ""}`
          );
        }
        if (event.amountNotes) {
          payParts.push(`Notes: ${event.amountNotes}`);
        }
        doc.text(
          payParts.join("  •  ").slice(0, 120),
          A4_LEFT,
          tablesBottomY + 4.2
        );
        tablesBottomY += 5;
      }
    } else {
      // Blank / Locked Lagat Table
      autoTable(doc, {
        startY: tableTopY,
        margin: { left: A4_LEFT, right: 210 - (A4_LEFT + leftAreaW) },
        theme: "grid",
        head: [["Particulars", "Qty", "Rate", "Amount"]],
        body: [
          ["Thaal Charges", String(event.thaalCount || 0), "", ""],
          ["Sarkari Thaal Sets", String(event.sarkariThaalSet || 0), "", ""],
          ["Hall & Kitchen Charges", "", "", ""],
          [
            "Decoration / Other",
            "",
            "",
            event.decorations ? "Applicable" : "—",
          ],
          [
            "GRAND TOTAL (Excl. Deposit)",
            "",
            "",
            canPrintAmounts ? fmtPdfRs(0) : "—",
          ],
        ],
        headStyles: {
          fillColor: [106, 27, 27],
          textColor: [250, 247, 242],
          fontSize: 7.6,
          cellPadding: 1.7,
        },
        styles: {
          fontSize: 7.6,
          cellPadding: 1.7,
          textColor: [35, 25, 23],
          lineColor: [216, 206, 190],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 78, fontStyle: "bold" },
          1: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tablesBottomY = (doc as any).lastAutoTable.finalY;
    }

    // Framed Refundable Deposit Box on the Right
    const depBoxX = A4_LEFT + leftAreaW + depositBoxGap;
    const depBoxH = Math.max(26, tablesBottomY - tableTopY);
    doc.setFillColor(250, 247, 242);
    doc.setDrawColor(106, 27, 27);
    doc.setLineWidth(0.45);
    doc.roundedRect(depBoxX, tableTopY, depositBoxW, depBoxH, 1.5, 1.5, "FD");

    const depMidY = tableTopY + depBoxH / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(106, 27, 27);
    doc.text("REFUNDABLE", depBoxX + depositBoxW / 2, depMidY - 5.5, {
      align: "center",
    });
    doc.text("DEPOSIT", depBoxX + depositBoxW / 2, depMidY - 2, {
      align: "center",
    });

    doc.setDrawColor(217, 195, 152);
    doc.setLineWidth(0.25);
    doc.line(depBoxX + 4, depMidY, depBoxX + depositBoxW - 4, depMidY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(35, 25, 23);
    const depValueText =
      canPrintAmounts && (event.depositAmount || 0) > 0
        ? fmtPdfRs(event.depositAmount)
        : "—";
    doc.text(depValueText, depBoxX + depositBoxW / 2, depMidY + 5, {
      align: "center",
    });

    if (canPrintAmounts && (event.depositAmount || 0) > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(123, 107, 99);
      doc.text(
        event.depositStatus === "REFUNDED"
          ? "Returned to Booker"
          : "Subject to clearance",
        depBoxX + depositBoxW / 2,
        depMidY + 9,
        { align: "center" }
      );
    }
  }

  // 6. Signatures Pinned Cleanly Above Page 1 Footer (Never overflows 297mm)
  const sigY = 268;
  doc.setDrawColor(160, 145, 125);
  doc.setLineWidth(0.3);
  doc.line(10, sigY, 76, sigY);
  doc.line(134, sigY, 200, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(61, 46, 42);
  doc.text("BOOKER SIGNATURE", 43, sigY + 4.2, { align: "center" });
  doc.text("OFFICE SIGNATURE", 167, sigY + 4.2, { align: "center" });

  // =========================================================================
  // PAGE 2: DO'S & DON'TS GUIDELINES (STRICT SINGLE A4 SHEET: 210mm x 297mm)
  // =========================================================================
  if (includeDosAndDonts) {
    doc.addPage("a4", "portrait");

    let p2y = drawFatimidA4Header(doc, {
      crestDataUrl,
      hasArabicFont,
      documentTitle: "Do's & Don'ts for Hall Bookers",
      subtitle:
        "Important Premises Guidelines — Please Share with Family, Caterer & Decorator",
      compact: true,
    });

    // DO's Table
    autoTable(doc, {
      startY: p2y,
      margin: { left: A4_LEFT, right: A4_LEFT },
      theme: "grid",
      head: [["#", "PLEASE DO (Important Responsibilities)"]],
      body: guidelines.dos.map((item, idx) => [String(idx + 1), item]),
      headStyles: {
        fillColor: [42, 96, 65],
        textColor: [255, 255, 255],
        fontSize: 8.2,
        cellPadding: 1.8,
      },
      styles: {
        fontSize: 7.9,
        cellPadding: 1.75,
        textColor: [35, 25, 23],
        lineColor: [204, 224, 212],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 9, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 189 },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p2y = (doc as any).lastAutoTable.finalY + 4;

    // DONT's Table
    autoTable(doc, {
      startY: p2y,
      margin: { left: A4_LEFT, right: A4_LEFT },
      theme: "grid",
      head: [["#", "PLEASE AVOID (Strictly Not Permitted)"]],
      body: guidelines.donts.map((item, idx) => [String(idx + 1), item]),
      headStyles: {
        fillColor: [153, 27, 27],
        textColor: [255, 255, 255],
        fontSize: 8.2,
        cellPadding: 1.8,
      },
      styles: {
        fontSize: 7.9,
        cellPadding: 1.75,
        textColor: [35, 25, 23],
        lineColor: [236, 206, 206],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 9, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 189 },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p2y = (doc as any).lastAutoTable.finalY + 4;

    if (guidelines.footerNote) {
      const wrappedNote = doc
        .splitTextToSize(guidelines.footerNote, A4_WIDTH - 7)
        .slice(0, 3);
      const noteBoxH = wrappedNote.length * 3.7 + 4.5;
      doc.setFillColor(251, 246, 235);
      doc.setDrawColor(217, 195, 152);
      doc.setLineWidth(0.25);
      doc.roundedRect(A4_LEFT, p2y, A4_WIDTH, noteBoxH, 1.4, 1.4, "FD");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.8);
      doc.setTextColor(92, 61, 16);
      doc.text(wrappedNote, A4_LEFT + 3.5, p2y + 3.8);
      p2y += noteBoxH + 4;
    }

    const ackY = Math.min(268, Math.max(p2y + 10, 260));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(61, 46, 42);
    doc.text(
      `I have read and agreed to follow the above hall & store guidelines for Booking Ref: ${refCode}.`,
      A4_LEFT,
      ackY - 7
    );

    doc.setDrawColor(160, 145, 125);
    doc.setLineWidth(0.3);
    doc.line(10, ackY, 80, ackY);
    doc.line(134, ackY, 200, ackY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.text("BOOKER NAME & SIGNATURE", 45, ackY + 4.2, { align: "center" });
    doc.text("DATE", 167, ackY + 4.2, { align: "center" });
  }

  // Standard Official Anjuman-e-Mohammedi Footers across Page 1 (& Page 2)
  drawFatimidA4Footers(doc, {
    refCode,
    docLabel: "Miqaat Documentation",
  });

  const prefix = isChecklist ? "Checklist" : "Booking";
  doc.save(`${prefix}-${refCode}.pdf`);
}
