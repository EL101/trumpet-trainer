import { createListCollection } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import Dropdown from "../Dropdown";

type TimeSigSelectProps = {
  setTimeSig: Dispatch<SetStateAction<string>>;
};

const timeSigSelect = createListCollection({
  items: [
    { label: "4/4", value: "4/4" },
    { label: "3/4", value: "3/4" },
    { label: "2/4", value: "2/4" },
    { label: "2/2", value: "2/2" },
    { label: "6/8", value: "6/8" },
    { label: "3/8", value: "3/8" },
    { label: "9/8", value: "9/8" },
    { label: "12/8", value: "12/8" },
  ],
});

export default function TimeSigSelect({ setTimeSig }: TimeSigSelectProps) {
  return (
    <Dropdown
      collection={timeSigSelect}
      label="TIME SIGNATURE"
      defaultVal="4/4"
      onValueChange={(e) => setTimeSig(e.value[0])}
    />
  );
}
