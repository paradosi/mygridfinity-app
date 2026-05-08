import { z } from "zod";

export const STYLE_PLATE_VALUES = [
  "thin",
  "weighted",
  "skeletonized",
  "screw_together",
  "screw_together_minimal",
] as const;

export type StylePlate = (typeof STYLE_PLATE_VALUES)[number];

// Library numeric mapping per gridfinity-rebuilt-baseplate.scad@910e22d
// style_plate = 3; // [0:thin, 1:weighted, 2:skeletonized, 3:screw_together, 4:screw_together_minimal]
const STYLE_PLATE_TO_INT: Record<StylePlate, number> = {
  thin: 0,
  weighted: 1,
  skeletonized: 2,
  screw_together: 3,
  screw_together_minimal: 4,
};

export function stylePlateToInt(value: StylePlate): number {
  return STYLE_PLATE_TO_INT[value];
}

export const BaseplateParamsSchema = z
  .object({
    gridx: z.number().int().min(1).max(20),
    gridy: z.number().int().min(1).max(20),
    style_plate: z.enum(STYLE_PLATE_VALUES),
    enable_magnet: z.boolean(),
    chamfer_holes: z.boolean(),
    crush_ribs: z.boolean(),
  })
  .strict();

export type BaseplateParams = z.infer<typeof BaseplateParamsSchema>;

export const MODEL_TYPE_BASEPLATE = "baseplate" as const;
