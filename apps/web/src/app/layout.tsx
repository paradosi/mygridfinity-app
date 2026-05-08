import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mygridfinity.app",
  description: "Parametric Gridfinity baseplate and bin generator.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
