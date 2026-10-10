import { Stat } from "@/components/primitives";
import { scoreColorToken } from "@/lib/intonation";
import type { ComponentProps } from "react";

type ScoreFigureProps = Omit<ComponentProps<typeof Stat>, "value" | "valueColor" | "label"> & {
  score: number;
  label?: string;
};

/** A 0–100 score coloured by band (green ≥ 90, olive ≥ 75, …). */
export function ScoreFigure({ score, label = "score", size = "sm", ...rest }: ScoreFigureProps) {
  // Colour by the number shown, so a displayed 90 is always in the 90+ band.
  const shown = Math.round(score);
  return (
    <Stat value={shown} label={label} size={size} valueColor={scoreColorToken(shown)} {...rest} />
  );
}
