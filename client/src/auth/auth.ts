import { auth } from "../firebase.ts";

export const signOut = async () => {
  await auth.signOut();
};
