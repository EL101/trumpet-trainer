import { createListCollection } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import Dropdown from "../Dropdown";

type MeasuresSelectProps = {
  setMeasures: Dispatch<SetStateAction<number>>;
};

const lengthSelect = createListCollection({
  items: [
    { label: "1 measure", value: "1" },
    { label: "2 measures", value: "2" },
    { label: "3 measures", value: "3" },
    { label: "4 measures", value: "4" },
  ],
});

export default function MeasuresSelect({ setMeasures }: MeasuresSelectProps) {
  return (
    <Dropdown
      collection={lengthSelect}
      label="LENGTH"
      defaultVal="2"
      onValueChange={(e) => setMeasures(parseInt(e.value[0]))}
    />
  );
}
