import { redirect } from "next/navigation";

export default function OfflineRegisterRedirect() {
  redirect("/login");
}
