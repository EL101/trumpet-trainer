import { createListCollection } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import Dropdown from "../Dropdown";
import type { Range } from "@/schema";

type RangeSelectProps = {
  setRange: Dispatch<SetStateAction<Range>>;
};

const rangeSelect = createListCollection({
  items: [
    { label: "Low (F#3 - C5)", value: "LOW" },
    { label: "Med (C4 - C6)", value: "MED" },
    { label: "High (C5 - G6)", value: "HIGH" },
    { label: "Any (F#3 - G6)", value: "ANY" },
  ],
});

export default function RangeSelect({ setRange }: RangeSelectProps) {
  return (
    <Dropdown
      collection={rangeSelect}
      label="RANGE"
      defaultVal="MED"
      onValueChange={(e) => setRange(e.value[0] as Range)}
    />
  );
}
