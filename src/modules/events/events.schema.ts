import { z } from "zod";
import { isSelfEventVenue } from "@sezsec/shared";

export const eventBookingSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter the booker's full name."),
    mobile: z
      .string()
      .trim()
      .min(8, "Please enter a valid mobile number."),
    email: z
      .string()
      .trim()
      .email("Please enter a valid email address.")
      .or(z.literal(""))
      .optional(),
    occasionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose the event date."),
    occasionTime: z.string().trim().min(1, "Please enter the event start time."),
    description: z
      .string()
      .trim()
      .min(2, "Please enter the occasion name (e.g. Walima, Darees, Majlis)."),
    halls: z.array(z.string().trim()).min(1, "Please select at least one hall or Self."),
    hallCounts: z.record(z.string(), z.number().int().min(0)).optional(),

    catererName: z.string().trim().optional().default("Self"),
    catererPhone: z.string().trim().optional().default(""),
    catererId: z.string().nullable().optional(),

    decorations: z.boolean().default(false),
    decoratorName: z.string().trim().optional().default(""),
    decoratorPhone: z.string().trim().optional().default(""),
    decoratorId: z.string().nullable().optional(),

    thaalCount: z.number().int().min(0).default(0),
    totalThaalsDone: z.number().int().min(0).nullable().optional(),
    sarkariThaalSet: z.number().int().min(0).default(0),
    bhaiSaabIzzan: z.boolean().default(false),
    muraqebeenIzzan: z.boolean().default(false),
    benSaabIzzan: z.boolean().default(false),
    extraChilamchiLota: z.number().int().min(0).default(0),
    tablesAndChairs: z.number().int().min(0).default(0),
    mic: z.boolean().default(false),
    crockeryRequired: z.boolean().default(false),
    thaalForDevri: z.boolean().default(false),
    paat: z.boolean().default(false),
    masjidLight: z.boolean().default(false),
    crockeryStatus: z
      .enum(["PENDING", "NOT_REQUIRED", "COMPLETED"])
      .optional(),

    acStartTime: z.string().trim().optional().default(""),
    partyTime: z.string().trim().optional().default(""),
    gasCount: z.number().int().min(0).nullable().optional(),
    menu: z.string().trim().optional().default(""),

    eventType: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
    status: z.enum(["BOOKED", "CANCELLED", "COMPLETED"]).default("BOOKED"),
    razaGranted: z.boolean().default(false),

    // Optional financial charges saved directly in decrypted form on Event
    thaalRate: z.number().int().min(0).optional(),
    thaalAmount: z.number().int().min(0).optional(),
    sarkariRate: z.number().int().min(0).optional(),
    sarkariAmount: z.number().int().min(0).optional(),
    kitchenCharge: z.number().int().min(0).optional(),
    decorationCharge: z.number().int().min(0).optional(),
    otherCharge: z.number().int().min(0).optional(),
    hallCharges: z.record(z.string(), z.number().int().min(0)).optional(),
    depositAmount: z.number().int().min(0).optional(),
    depositStatus: z.enum(["NONE", "HELD", "REFUNDED"]).optional(),
    paymentMode: z.string().trim().optional(),
    transactionId: z.string().trim().optional(),
    amountNotes: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    const isSelf = isSelfEventVenue(val.halls);
    if (val.decorations && !isSelf) {
      if (!val.decoratorName || val.decoratorName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decoratorName"],
          message:
            "Decorator name is required when Decorations is selected for a hall booking.",
        });
      }
      if (!val.decoratorPhone || val.decoratorPhone.trim().length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decoratorPhone"],
          message:
            "Decorator mobile number is required when Decorations is selected for a hall booking.",
        });
      }
    }
  });

export type EventBookingInput = z.infer<typeof eventBookingSchema>;
