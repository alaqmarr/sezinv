"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIST, formatTimeDisplay, getMisriDate } from "@sezsec/shared";
import type { EventAllocationSummary, PortalEvent } from "@sezsec/events";
import {
  A4_LEFT,
  A4_RIGHT,
  A4_WIDTH,
  drawFatimidA4Footers,
  drawFatimidA4Header,
  loadImageAsDataUrl,
  registerArabicFont,
} from "./pdf-branding.helper";

export async function downloadStoreManifestPdf(
  event: PortalEvent,
  allocations: EventAllocationSummary[]
): Promise<void> {
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

  let y = drawFatimidA4Header(doc, {
    crestDataUrl,
    hasArabicFont,
    documentTitle: "Store Vessels & Crockery Issue / Return Slip",
    subtitle: "Jamaat Vessel Store & Inventory Documentation",
  });

  // Event Info Bar
  const misri = getMisriDate(event.occasionDate);
  doc.setFillColor(251, 246, 235);
  doc.setDrawColor(217, 195, 152);
  doc.setLineWidth(0.25);
  doc.roundedRect(A4_LEFT, y, A4_WIDTH, 15.5, 1.4, 1.4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 25, 23);
  doc.text(`Booker: ${event.name} (${event.mobile})`, A4_LEFT + 3.5, y + 4.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(74, 59, 54);
  doc.text(
    `Occasion: ${event.description}  •  Hall: ${event.halls.join(", ") || "Self"}`,
    A4_LEFT + 3.5,
    y + 9.2
  );
  doc.text(
    `Caterer: ${event.catererName || "Self"}  •  Expected Thaals: ${event.thaalCount}`,
    A4_LEFT + 3.5,
    y + 13.3
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(106, 27, 27);
  doc.text(
    `${formatIST(event.occasionDate, "dd MMM yyyy")} • ${formatTimeDisplay(event.occasionTime)}`,
    A4_RIGHT - 3.5,
    y + 4.8,
    { align: "right" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.text(misri.formattedEn, A4_RIGHT - 3.5, y + 9.2, { align: "right" });
  if (hasArabicFont) {
    doc.setFont("KanzMarjaan", "normal");
    doc.setFontSize(10);
    doc.text(misri.formattedAr, A4_RIGHT - 3.5, y + 13.6, { align: "right" });
  }

  y += 19;

  // Summary Stats Strip
  const sorted = [...allocations].sort((a, b) =>
    a.itemName.localeCompare(b.itemName)
  );
  const totalItems = sorted.length;
  const totalIssued = sorted.reduce((s, a) => s + a.issuedQty, 0);
  const totalReturned = sorted.reduce(
    (s, a) => s + a.returnedQty + a.recoveredQty,
    0
  );
  const totalMissing = sorted.reduce(
    (s, a) => s + Math.max(0, a.lostQty - a.recoveredQty),
    0
  );
  const totalPending = sorted.reduce(
    (s, a) => s + Math.max(0, a.issuedQty - a.returnedQty - a.lostQty),
    0
  );
  const isSettled = totalIssued > 0 && totalPending === 0 && totalMissing === 0;

  doc.setFillColor(250, 247, 242);
  doc.setDrawColor(216, 206, 190);
  doc.roundedRect(A4_LEFT, y, A4_WIDTH, 15, 1.4, 1.4, "FD");

  const cols = [
    { label: "TOTAL ITEMS", value: String(totalItems), x: 31 },
    { label: "GIVEN OUT", value: String(totalIssued), x: 80 },
    { label: "RETURNED", value: String(totalReturned), x: 130 },
    {
      label: "STATUS",
      value: isSettled ? "SETTLED" : totalIssued === 0 ? "NOT ISSUED" : "PENDING",
      x: 179,
      settled: isSettled,
    },
  ];
  for (const c of cols) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(123, 107, 99);
    doc.text(c.label, c.x, y + 5.2, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    if (c.label === "STATUS") {
      doc.setTextColor(
        c.settled ? 42 : 146,
        c.settled ? 96 : 87,
        c.settled ? 65 : 8
      );
    } else {
      doc.setTextColor(35, 25, 23);
    }
    doc.text(c.value, c.x, y + 11.5, { align: "center" });
  }

  y += 19;

  autoTable(doc, {
    startY: y,
    margin: { left: A4_LEFT, right: A4_LEFT, bottom: 24 },
    theme: "grid",
    head: [
      [
        "#",
        "Item Name",
        "Category",
        "Given Out",
        "Returned",
        "Missing",
        "Status / Variance",
      ],
    ],
    body:
      sorted.length > 0
        ? sorted.map((a, idx) => {
            const effectiveReturned = a.returnedQty + a.recoveredQty;
            const missing = Math.max(0, a.lostQty - a.recoveredQty);
            const pending = Math.max(
              0,
              a.issuedQty - effectiveReturned - missing
            );
            const statusText =
              pending > 0
                ? `Pending (-${pending})`
                : missing > 0
                  ? `Missing (${missing})`
                  : "Settled";
            return [
              String(idx + 1),
              a.itemName,
              a.category,
              `${a.issuedQty} ${a.unit}`,
              `${effectiveReturned} ${a.unit}`,
              missing > 0 ? `${missing} ${a.unit}` : "—",
              statusText,
            ];
          })
        : [["—", "No store items issued yet", "—", "0", "0", "—", "—"]],
    headStyles: {
      fillColor: [106, 27, 27],
      textColor: [250, 247, 242],
      fontSize: 8,
      cellPadding: 2.2,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.1,
      textColor: [35, 25, 23],
      lineColor: [216, 206, 190],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 64, fontStyle: "bold" },
      2: { cellWidth: 34 },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 26, halign: "center", fontStyle: "bold" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = (doc as any).lastAutoTable.finalY + 14;
  let sigY = 266;
  if (afterTableY > 260) {
    doc.addPage("a4", "portrait");
    sigY = 50;
  } else {
    sigY = Math.max(afterTableY, 260);
  }

  doc.setDrawColor(160, 145, 125);
  doc.setLineWidth(0.3);
  doc.line(10, sigY, 76, sigY);
  doc.line(134, sigY, 200, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(61, 46, 42);
  doc.text("STORE DISPATCHER SIGNATURE", 43, sigY + 4.2, { align: "center" });
  doc.text("RECEIVER SIGNATURE", 167, sigY + 4.2, { align: "center" });

  drawFatimidA4Footers(doc, {
    refCode,
    docLabel: "Inventory Documentation",
  });

  doc.save(`Store-Slip-${refCode}.pdf`);
}
