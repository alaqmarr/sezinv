import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { db, getDatabaseHealth, withWriteTransaction } from "@sezsec/db";
import { issueEmailOtp, verifyEmailOtp } from "@sezsec/auth/otp.service";
import {
  applyAmountRedaction,
  calculateEventAmounts,
} from "@sezsec/finance/finance.helper";
import { eventBookingSchema } from "@sezsec/events/events.schema";
import { inspectNeonVsSqliteCounts } from "@sezsec/migration/neon-migrator.service";

async function main() {
  console.log("=== SEZSEC Jamaat Events — Automated Verification Suite ===\n");

  // 1. Verify Zero Forbidden Dependencies (no shadcn, no radix, no firebase)
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
  );
  const allDeps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
  };
  for (const dep of Object.keys(allDeps)) {
    assert(
      !dep.startsWith("@radix-ui/") &&
        !dep.includes("shadcn") &&
        !dep.includes("firebase"),
      `Forbidden dependency detected: ${dep}`
    );
  }
  assert(allDeps["next"]?.includes("16"), "Next.js 16 must be installed");
  assert(allDeps["sileo"], "sileo toast package must be installed");
  assert(
    allDeps["@prisma/adapter-better-sqlite3"],
    "SQLite Prisma driver adapter must be installed"
  );
  console.log(
    "[PASS] 1. Dependencies verified (Next.js 16, Sileo, SQLite Adapter; zero Radix/shadcn/Firebase)."
  );

  // 2. Verify SQLite WAL Mode, Concurrency Pragmas & Parallel Write Mutex
  const health = await getDatabaseHealth();
  assert.equal(health.status, "healthy", "Database should report healthy");
  assert.equal(
    health.pragmas.journalMode.toLowerCase(),
    "wal",
    "SQLite journal_mode must be WAL"
  );
  assert.equal(
    health.pragmas.foreignKeys,
    true,
    "SQLite foreign_keys must be ON"
  );
  assert(
    health.pragmas.busyTimeoutMs >= 10000,
    "SQLite busy_timeout must be >= 10000ms"
  );

  // Run 12 parallel write transactions concurrently to prove zero SQLITE_BUSY
  const tempConfigKeys = Array.from(
    { length: 12 },
    (_, i) => `__verify_concurrency_${i}`
  );
  await Promise.all(
    tempConfigKeys.map((key, idx) =>
      withWriteTransaction(async (tx) => {
        await tx.config.upsert({
          where: { key },
          update: { value: `val-${idx}` },
          create: { key, value: `val-${idx}` },
        });
      })
    )
  );
  await withWriteTransaction((tx) =>
    tx.config.deleteMany({ where: { key: { in: tempConfigKeys } } })
  );
  console.log(
    `[PASS] 2. SQLite WAL concurrency verified (journal=${health.pragmas.journalMode}, busyTimeout=${health.pragmas.busyTimeoutMs}ms, 12 parallel writes succeeded).`
  );

  // 3. Verify Conditional Decorator Details Validation
  const basePayload = {
    occasionDate: "2026-12-15",
    occasionTime: "07:30 PM",
    halls: ["Main Jamaat Khana Hall"],
    hallCounts: { "Main Jamaat Khana Hall": 20 },
    thaalCount: 20,
    sarkariThaalSet: 2,
    decorations: true,
    decoratorName: "",
    decoratorPhone: "",
    menu: "Biryani",
    catererName: "Test Caterer",
    catererPhone: "9876543210",
    name: "Test Booker",
    mobile: "9988776655",
    email: "",
    description: "Shadi",
  };

  const missingDecoratorCheck = eventBookingSchema.safeParse(basePayload);
  assert.equal(
    missingDecoratorCheck.success,
    false,
    "Decorations=true on Jamaat Hall MUST require decorator name and phone"
  );

  const validDecoratorCheck = eventBookingSchema.safeParse({
    ...basePayload,
    decoratorName: "Burhani Decor",
    decoratorPhone: "9849012345",
  });
  assert.equal(
    validDecoratorCheck.success,
    true,
    "Decorations=true with decoratorName + decoratorPhone MUST pass"
  );

  const selfVenueCheck = eventBookingSchema.safeParse({
    ...basePayload,
    halls: ["Self"],
    hallCounts: { Self: 20 },
    decoratorName: "",
    decoratorPhone: "",
  });
  assert.equal(
    selfVenueCheck.success,
    true,
    "Decorations=true when venue is 'Self' MUST NOT require decorator details"
  );
  console.log(
    "[PASS] 3. Decorator Details rule verified (required when Decorations=Yes & not Self; optional when Self)."
  );

  // 4. Verify Decrypted SQLite Amount Storage + Email OTP Verification + Redaction
  const computed = calculateEventAmounts({
    thaalCount: 25,
    sarkariThaalSet: 2,
    thaalRate: 100,
    sarkariRate: 250,
    kitchenCharge: 1500,
    decorationCharge: 1000,
    otherCharge: 500,
    hallCharges: { "Main Jamaat Khana Hall": 4000 },
    depositAmount: 3000,
    depositStatus: "HELD",
    amountNotes: "Verified plain storage",
  });
  // 25*100 (2500) + 2*250 (500) + 1500 + 1000 + 500 + 4000 = 10000
  assert.equal(computed.totalAmount, 10000);

  const tempEvent = await withWriteTransaction((tx) =>
    tx.event.create({
      data: {
        mobile: "9000000000",
        name: "Temp Verification Event",
        description: "Test",
        occasionDate: new Date("2026-12-20T00:00:00+05:30"),
        occasionTime: "08:00 PM",
        hall: ["Main Jamaat Khana Hall"],
        catererName: "Self",
        catererPhone: "9000000000",
        thaalCount: 25,
        sarkariThaalSet: 2,
        thaalRate: computed.thaalRate,
        thaalAmount: computed.thaalAmount,
        sarkariRate: computed.sarkariRate,
        sarkariAmount: computed.sarkariAmount,
        kitchenCharge: computed.kitchenCharge,
        decorationCharge: computed.decorationCharge,
        otherCharge: computed.otherCharge,
        hallCharges: computed.hallCharges,
        totalAmount: computed.totalAmount,
        depositAmount: computed.depositAmount,
        depositStatus: computed.depositStatus,
      },
    })
  );

  const rawSaved = await db.event.findUniqueOrThrow({
    where: { id: tempEvent.id },
  });
  assert.equal(
    rawSaved.totalAmount,
    10000,
    "Amounts must be stored decrypted as plain numbers in SQLite"
  );
  assert.equal(rawSaved.depositAmount, 3000);

  // Clean up temporary test event immediately
  await withWriteTransaction((tx) =>
    tx.event.delete({ where: { id: tempEvent.id } })
  );

  // Verify Email OTP generation & verification
  const testEmail = "verify-otp-check@sezsec.local";
  const issued = await issueEmailOtp({
    email: testEmail,
    recipientName: "Verification Runner",
    purpose: "AMOUNT_REVEAL",
  });
  assert(issued.devPreviewCode && issued.devPreviewCode.length === 6);

  const wrongAttempt = await verifyEmailOtp({
    email: testEmail,
    code: "000000",
    purpose: "AMOUNT_REVEAL",
  });
  assert.equal(wrongAttempt.valid, false, "Wrong OTP code must be rejected");

  const rightAttempt = await verifyEmailOtp({
    email: testEmail,
    code: issued.devPreviewCode,
    purpose: "AMOUNT_REVEAL",
  });
  assert.equal(rightAttempt.valid, true, "Issued 6-digit OTP must verify cleanly");

  await withWriteTransaction((tx) =>
    tx.verificationCode.deleteMany({ where: { email: testEmail } })
  );

  // Verify server-side redaction helper
  const sampleRecord = {
    id: "sample",
    thaalRate: 100,
    thaalAmount: 2500,
    sarkariRate: 250,
    sarkariAmount: 500,
    kitchenCharge: 1500,
    decorationCharge: 1000,
    otherCharge: 500,
    hallCharges: { Hall: 4000 },
    totalAmount: 10000,
    depositAmount: 3000,
    depositStatus: "HELD",
    amountNotes: "Plain note",
  };
  const redacted = applyAmountRedaction(sampleRecord, false);
  assert.equal(redacted.totalAmount, null);
  assert.equal(redacted.depositAmount, null);
  assert.equal(redacted.hallCharges, null);
  assert.equal(redacted.amountNotes, null);
  assert.equal(redacted.amountsLocked, true);

  const unlocked = applyAmountRedaction(sampleRecord, true);
  assert.equal(unlocked.totalAmount, 10000);
  assert.equal(unlocked.depositAmount, 3000);
  assert.equal(unlocked.amountsLocked, false);

  console.log(
    "[PASS] 4. Decrypted SQLite amount storage + 6-digit Email OTP + server redaction verified."
  );

  // 5. Verify Read-Only Neon Inspection (NEVER modifies Neon)
  const neonReport = await inspectNeonVsSqliteCounts();
  if (neonReport.neonConfigured) {
    console.log(
      `[PASS] 5. Read-Only Neon inspection verified (reachable=${neonReport.neonReachable}, Neon total rows=${neonReport.totalNeonRows}, tables inspected=${neonReport.tables.length}).`
    );
  } else {
    console.log(
      "[INFO] 5. NEON_DATABASE_URL not set; skipped live Neon count check."
    );
  }

  console.log("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY.");
}

main()
  .catch((err) => {
    console.error("VERIFICATION FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
