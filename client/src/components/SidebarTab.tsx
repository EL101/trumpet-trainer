import { Box } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";

export default function SidebarTab({ to, name }: { to: string; name: string }) {
  return (
    <NavLink to={to} end>
      {({ isActive }) => (
        <Box
          p="0.4rem 0.8rem"
          borderRadius="sm"
          bg={isActive ? "black" : "transparent"}
          fontWeight={isActive ? "bold" : "normal"}
          color={isActive ? "white" : "black"}
          _hover={!isActive ? { bg: "gray.200" } : {}}
          fontSize="lg"
          cursor="pointer"
        >
          {name}
        </Box>
      )}
    </NavLink>
  );
}
