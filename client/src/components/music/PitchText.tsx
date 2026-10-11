import { chakra } from "@chakra-ui/react";
import { formatPitch } from "@/lib/format";

/**
 * Text with its accidentals set as ♭ and ♯ ("Bb major" → "B♭ major"). Lora draws both
 * on a full em with wide side bearings, so they're pulled in to sit against their letter.
 */
export function PitchText({ children }: { children: string }) {
  // One span, so a flex parent sees a single item and keeps the space after "B♭".
  return (
    <span>
      {formatPitch(children)
        .split(/([♭♯])/)
        .map((part, i) => {
          if (part === "♭") {
            return (
              <chakra.span key={i} ms="-0.3em" me="-0.2em">
                ♭
              </chakra.span>
            );
          }
          if (part === "♯") {
            return (
              <chakra.span key={i} mx="-0.12em">
                ♯
              </chakra.span>
            );
          }
          return part;
        })}
    </span>
  );
}
