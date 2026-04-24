import { z } from "zod";

// ── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z
    .string({ required_error: "email is required" })
    .max(254, "Email too long")
    .email("Invalid email format"),

  password: z
    .string({ required_error: "password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),

  role: z.enum(["INVESTOR", "STARTUP"], {
    required_error: "role is required",
    invalid_type_error: "role must be INVESTOR or STARTUP",
  }),

  // Optional fields — coerce undefined/null to undefined so they're truly optional
  name: z.string().max(200, "Name too long").optional(),
  dateOfBirth: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Contracts ────────────────────────────────────────────────────────────────

const milestoneItemSchema = z.object({
  title: z
    .string({ required_error: "Milestone title is required" })
    .min(1, "Milestone title cannot be empty")
    .max(1000, "Milestone title must be at most 1000 characters")
    .trim(),

  // Accept number or numeric string — the route already does Number(m.amountUSD)
  amountUSD: z.coerce
    .number({ invalid_type_error: "amountUSD must be a number" })
    .positive("amountUSD must be positive")
    .max(999_999_999, "amountUSD exceeds maximum"),

  cancelAfter: z
    .string({ required_error: "cancelAfter is required" })
    .min(1, "cancelAfter cannot be empty")
    .refine((val) => !isNaN(new Date(val).getTime()), { message: "cancelAfter must be a valid date" })
    .refine((val) => new Date(val) > new Date(), { message: "Deadline must be in the future" }),
});

// Attestation milestone — amountUSD is optional (repurposed as "tracked value")
const attestationMilestoneItemSchema = z.object({
  title: z
    .string({ required_error: "Milestone title is required" })
    .min(1, "Milestone title cannot be empty")
    .max(1000, "Milestone title must be at most 1000 characters")
    .trim(),

  amountUSD: z.coerce
    .number()
    .nonnegative("amountUSD must be non-negative")
    .max(999_999_999)
    .optional()
    .default(0),

  cancelAfter: z
    .string({ required_error: "cancelAfter is required" })
    .min(1, "cancelAfter cannot be empty")
    .refine((val) => !isNaN(new Date(val).getTime()), { message: "cancelAfter must be a valid date" })
    .refine((val) => new Date(val) > new Date(), { message: "Deadline must be in the future" }),

  scheduleType: z.enum(["ONE_OFF", "MONTHLY", "QUARTERLY", "ANNUAL"]).optional().default("ONE_OFF"),
});

export const createContractSchema = z
  .object({
    // Single-milestone shorthand
    milestone: z.string().max(200, "Milestone title too long").trim().optional(),
    amountUSD: z.coerce.number().positive().max(999_999_999).optional(),
    cancelAfter: z.string().optional(),

    // Multi-milestone array (max 10 milestones per contract)
    milestones: z
      .array(milestoneItemSchema)
      .min(1, "At least one milestone is required")
      .max(10, "A contract can have at most 10 milestones")
      .optional(),

    receiverWalletAddress: z.string().max(100).optional(),

    // Enterprise Attestation Mode
    mode: z.enum(["ESCROW", "ATTESTATION"]).optional().default("ESCROW"),
    auditorEmail: z.string().email("Invalid auditor email").max(254).optional(),

    // Feature 10: Confidential Attestation
    isConfidential: z.boolean().optional().default(false),
    confidentialPassphrase: z.string().min(8, "Passphrase must be at least 8 characters").max(200).optional(),

    attestationMilestones: z
      .array(attestationMilestoneItemSchema)
      .min(1, "At least one milestone is required")
      .max(20, "A contract can have at most 20 attestation milestones")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.mode === "ATTESTATION") {
        return data.attestationMilestones && data.attestationMilestones.length > 0;
      }
      return data.milestone || (data.milestones && data.milestones.length > 0);
    },
    { message: "milestone or milestones array is required" }
  );

export type CreateContractInput = z.infer<typeof createContractSchema>;
