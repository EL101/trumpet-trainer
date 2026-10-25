import { useContext } from "react";
import { EtudesContext } from "./EtudesContext";

export const useEtudes = () => useContext(EtudesContext);
