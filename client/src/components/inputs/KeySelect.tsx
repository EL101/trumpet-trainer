import { createListCollection } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import Dropdown from "../Dropdown";
import { PRACTICAL_MAJOR, PRACTICAL_MINOR } from "@/utils/generateMusic";
import type { Key } from "@/schema";

type KeySelectProps = {
  setKey: Dispatch<SetStateAction<Key>>;
};

const keySelect = createListCollection({
  items: [
    ...PRACTICAL_MAJOR.map((k) => ({ label: `${k} major`, value: `${k} major` })),
    ...PRACTICAL_MINOR.map((k) => ({ label: `${k} minor`, value: `${k} minor` })),
  ],
});

export default function KeySelect({ setKey }: KeySelectProps) {
  return (
    <Dropdown
      collection={keySelect}
      label="KEY"
      defaultVal="C major"
      onValueChange={(e) => setKey(e.value[0] as Key)}
    />
  );
}
