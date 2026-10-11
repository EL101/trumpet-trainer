import { Text, type TextProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { formatExerciseMeta, type ExerciseMetaParts } from "@/lib/format";
import { PitchText } from "./PitchText";

type ExerciseMetaProps = ExerciseMetaParts & TextProps & { extra?: ReactNode[] };

/** Muted one-line exercise details: "G major · ♩ = 96 · 8 bars · 6 min". */
export function ExerciseMeta({
  keyLabel,
  timeSig,
  tempo,
  bars,
  minutes,
  extra = [],
  ...rest
}: ExerciseMetaProps) {
  const parts: ReactNode[] = [
    keyLabel && <PitchText>{keyLabel}</PitchText>,
    ...formatExerciseMeta({ timeSig, tempo, bars, minutes }),
    ...extra,
  ].filter(Boolean);
  return (
    <Text fontSize="12px" color="fg.muted" {...rest}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {p}
        </span>
      ))}
    </Text>
  );
}
