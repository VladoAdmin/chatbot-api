import { z } from "zod";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export const ExtractedContextSchema = z.object({
  sektor: z.string().nullable(),
  región: z.string().nullable(),
  veľkosť_firmy: z.enum(["mikro", "malá", "stredná", "veľká"]).nullable(),
  typ_projektu: z.string().nullable(),
  kontext_kompletný: z.boolean(),
});

export type ExtractedContext = z.infer<typeof ExtractedContextSchema>;

export const EMPTY_CONTEXT: ExtractedContext = {
  sektor: null,
  región: null,
  veľkosť_firmy: null,
  typ_projektu: null,
  kontext_kompletný: false,
};
