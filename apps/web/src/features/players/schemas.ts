import { z } from "zod";

export const playerFormSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(120, "Max 120 characters"),
  slug: z.string().trim().max(120, "Slug too long").or(z.literal("")),
  avatarUrl: z.union([z.literal(""), z.string().trim().url("Avatar must be a valid URL")]),
  isActive: z.boolean()
});

export type PlayerFormValues = z.infer<typeof playerFormSchema>;
