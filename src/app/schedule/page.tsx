import { redirect } from "next/navigation";

// The schedule and home pages merged; / is the schedule now.
export default function SchedulePage() {
  redirect("/");
}
