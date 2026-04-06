import { redirect } from "next/navigation";

export default function DeployRedirect() {
  redirect("https://dashboard.floom.dev/sign-up");
}
