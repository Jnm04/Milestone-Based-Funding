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
    .max(200, "Milestone title must be at most 200 characters")
    .trim(),

  // Accept number or numeric string — the route already does Number(m.amountUSD)
  amountUSD: z.coerce
    .number({ invalid_type_error: "amountUSD must be a number" })
    .positive("amountUSD must be positive")
    .max(999_999_999, "amountUSD exceeds maximum"),

  cancelAfter: z
    .string({ required_error: "cancelAfter is required" })
    .min(1, "cancelAfter cannot be empty"),
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
  })
  .refine(
    (data) => data.milestone || (data.milestones && data.milestones.length > 0),
    { message: "milestone or milestones array is required" }
  );

export type CreateContractInput = z.infer<typeof createContractSchema>;
