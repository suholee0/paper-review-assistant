import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Review Tool",
  description: "A local web app for reading academic papers with AI assistance",
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
