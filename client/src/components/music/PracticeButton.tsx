import { Play } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout";
import { Button, type ButtonProps } from "@/components/primitives";
import { originFor, PRACTICE_PATH, type PracticeState } from "@/lib/practice";
import type { MusicInfo } from "@/schema";

type PracticeButtonProps = Omit<ButtonProps, "asChild" | "children"> & {
  /** The exercise to practise; the button is disabled without one. */
  exercise: MusicInfo | null;
};

/**
 * "Practice with feedback": opens the player on `exercise`. The player's back links
 * return to this page, named as the nav names it, and hand the exercise back as
 * `practiced` in the router state (read it with `readPracticed`).
 */
export function PracticeButton({ exercise, ...rest }: PracticeButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const label = (
    <>
      <Play />
      Practice with feedback
    </>
  );

  if (!exercise) {
    return (
      <Button variant="primary" disabled {...rest}>
        {label}
      </Button>
    );
  }

  const state: PracticeState = { exercise, from: originFor(location.pathname, NAV_ITEMS) };
  // The browser's Back button skips the player's back link, so mark this page's own
  // history entry too: coming back either way finds the exercise in `practiced`.
  const markHere = () => {
    const current = typeof location.state === "object" ? location.state : null;
    navigate(location, { replace: true, state: { ...current, practiced: exercise } });
  };

  return (
    <Button asChild variant="primary" {...rest}>
      <Link to={PRACTICE_PATH} state={state} onClick={markHere}>
        {label}
      </Link>
    </Button>
  );
}
