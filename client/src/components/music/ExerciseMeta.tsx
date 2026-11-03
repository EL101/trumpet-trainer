import { Text, type TextProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { formatExerciseMeta, type ExerciseMetaParts } from "@/lib/format";
import { pulseOf } from "@/lib/meter";
import { PitchText } from "./PitchText";
import { TempoMark } from "./TempoMark";

type ExerciseMetaProps = ExerciseMetaParts &
  TextProps & {
    /** Beats per minute, in the beat the time signature counts in (quarters without one). */
    tempo?: number;
    extra?: ReactNode[];
  };

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
    ...formatExerciseMeta({ timeSig }),
    tempo != null && <TempoMark pulse={pulseOf(timeSig ?? "4/4")} bpm={tempo} />,
    ...formatExerciseMeta({ bars, minutes }),
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
