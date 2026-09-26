import { redirect } from "next/navigation";

/** Likes became follows: the old "who likes you" page now lives at /followers. */
export default function LikesPage() {
  redirect("/followers");
}
