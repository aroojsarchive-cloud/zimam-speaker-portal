import { redirect } from "next/navigation";

// Merged into the Speakers page.
export default function Moved() {
  redirect("/admin");
}
