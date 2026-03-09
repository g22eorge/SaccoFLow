import { z } from "zod";

export const createMemberSchema = z.object({
  saccoId: z.string().min(1),
  memberNumber: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateMemberSchema = createMemberSchema.partial().omit({
  saccoId: true,
});
