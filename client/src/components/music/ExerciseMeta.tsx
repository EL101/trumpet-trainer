import { Text, type TextProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { formatExerciseMeta, type ExerciseMetaParts } from "@/lib/format";

type ExerciseMetaProps = ExerciseMetaParts & TextProps & { extra?: ReactNode[] };

/** Muted one-line exercise details: "G major · ♩ = 96 · 8 bars · 6 min". */
export function ExerciseMeta({
  keyLabel,
  tempo,
  bars,
  minutes,
  extra = [],
  ...rest
}: ExerciseMetaProps) {
  const parts: ReactNode[] = [...formatExerciseMeta({ keyLabel, tempo, bars, minutes }), ...extra];
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
