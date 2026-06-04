import { Button } from "@chakra-ui/react";
import { type Dispatch, type SetStateAction } from "react";

type FilterButtonProps = {
  name: string;
  id: string;
  active: string;
  setActive: Dispatch<SetStateAction<string>>;
};

export default function FilterButton({ name, id, active, setActive }: FilterButtonProps) {
  return (
    <Button
      id={id}
      borderWidth={2}
      borderColor="black"
      px="1rem"
      borderRadius={100}
      height="30px"
      _hover={active !== id ? { bgColor: "gray.100" } : {}}
      bgColor={active === id ? "black" : "none"}
      color={active === id ? "white" : "black"}
      fontWeight={600}
      onClick={() => {
        setActive(id);
      }}
      textTransform="uppercase"
    >
      {name}
    </Button>
  );
}
