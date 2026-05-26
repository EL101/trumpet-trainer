import { Button } from "@chakra-ui/react";

export default function SaveButton({ disabled, ...props }) {
  const handleSaveClick = () => {};

  return (
    <Button
      bgColor="gray.300"
      color="black"
      fontWeight="600"
      width="8rem"
      disabled={disabled}
      _hover={{ bgColor:"gray.400" }}
      transition='backgrounds'
      onClick={handleSaveClick}
      {...props}
    >
      Save to Library
    </Button>
  );
}
