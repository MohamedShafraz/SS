import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>MSPOS</title>
        <meta
          name="description"
          content="Modern point of sale platform for retail, service, medical, and specialty businesses"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
