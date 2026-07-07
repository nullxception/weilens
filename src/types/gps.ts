import z from "zod";

export const NominatimResultSchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  display_name: z.string(),
  name: z.string().optional(),
});

export const NominatimSearchSchema = z.array(NominatimResultSchema);

export type NominatimResult = z.infer<typeof NominatimResultSchema>;
