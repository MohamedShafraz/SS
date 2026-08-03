import { redirect } from "next/navigation";

export default function OfflinePaymentRedirect() {
  redirect("/activate");
}
