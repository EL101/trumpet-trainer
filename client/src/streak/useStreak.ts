import { useContext } from "react";
import { StreakContext } from "./StreakContext";

export const useStreak = () => useContext(StreakContext);
