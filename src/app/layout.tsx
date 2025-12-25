import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Approval + Payment Portal",
  description: "Production-grade client approval and payment portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
