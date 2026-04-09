import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Review Tool",
  description: "Read papers with an AI research mate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
