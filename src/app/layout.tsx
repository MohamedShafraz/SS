import { Toaster } from "react-hot-toast";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Sports Shop POS System</title>
        <meta name="description" content="Modern Point of Sale System for Sports Shop" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
