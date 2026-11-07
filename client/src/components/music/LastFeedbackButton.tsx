import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/primitives";
import { useLatestScore } from "@/hooks/useLatestScore";
import type { MusicInfo } from "@/schema";
import { ScoreCard } from "./ScoreCard";

type LastFeedbackButtonProps = Omit<ButtonProps, "asChild" | "children" | "onClick"> & {
  exercise: MusicInfo | null;
};

/**
 * "Last feedback": opens the score card on the newest scored run of `exercise`. Renders
 * nothing until it's loaded, or if the exercise has never been scored.
 */
export function LastFeedbackButton({ exercise, ...rest }: LastFeedbackButtonProps) {
  const { score } = useLatestScore(exercise?.generationNum ? exercise.exerciseId : null);
  const [open, setOpen] = useState(false);
  if (!exercise || !score) return null;
  return (
    <>
      <Button {...rest} onClick={() => setOpen(true)}>
        <ClipboardList />
        Last feedback
      </Button>
      <ScoreCard
        open={open}
        onOpenChange={setOpen}
        exercise={exercise}
        score={score}
        tempo={score.tempo}
        playedAt={score.createdAt}
        actions={<Button onClick={() => setOpen(false)}>Close</Button>}
      />
    </>
  );
}
