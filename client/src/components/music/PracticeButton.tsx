import { Play } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/primitives";
import { practicePath, type PracticeState } from "@/lib/practice";
import type { MusicInfo } from "@/schema";

type PracticeButtonProps = Omit<ButtonProps, "asChild" | "children"> & {
  /**
   * The exercise to practise. The button is disabled without one, and until history
   * has numbered it: the player loads exercises from history by id.
   */
  exercise: MusicInfo | null;
  /** What the player's back links call this page ("Back to Generate"). */
  originLabel: string;
  /** The button's text, after its Play icon. */
  label?: ReactNode;
};

/**
 * "Practice with feedback": opens the player on `exercise`, at an address that names
 * it, so it opens in a new tab too. The player's back links return to this page and
 * hand the exercise back as `practiced` in the router state (read it with
 * `readPracticed`).
 */
export function PracticeButton({
  exercise,
  originLabel,
  label: text = "Practice with feedback",
  ...rest
}: PracticeButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const label = (
    <>
      <Play />
      {text}
    </>
  );

  if (!exercise?.generationNum) {
    return (
      <Button variant="primary" disabled {...rest}>
        {label}
      </Button>
    );
  }

  const state: PracticeState = { exercise, from: { to: location.pathname, label: originLabel } };
  // The browser's Back button skips the player's back link, so mark this page's own
  // history entry too: coming back either way finds the exercise in `practiced`.
  const markHere = () => {
    const current = typeof location.state === "object" ? location.state : null;
    navigate(location, { replace: true, state: { ...current, practiced: exercise } });
  };

  return (
    <Button asChild variant="primary" {...rest}>
      <Link
        to={practicePath(exercise.exerciseId, location.pathname)}
        state={state}
        onClick={markHere}
      >
        {label}
      </Link>
    </Button>
  );
}
