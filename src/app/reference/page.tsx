import { redirect } from "next/navigation";

// A bare /reference URL should land somewhere useful, not 404.
export default function ReferenceIndex() {
  redirect("/reference/templates");
}
