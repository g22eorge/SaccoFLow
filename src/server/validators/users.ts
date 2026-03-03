import { z } from "zod";

export const createUserSchema = z.object({
  saccoId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(2).optional(),
  role: z.enum([
    "SUPER_ADMIN",
    "SACCO_ADMIN",
    "TREASURER",
    "LOAN_OFFICER",
    "AUDITOR",
    "MEMBER",
  ]),
  password: z.string().min(8).optional(),
});
