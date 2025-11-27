// src/app/layout.js
import "./globals.css";

import Header from "./components/Header";
import Footer from "./components/Footer";

export const metadata = {
  title: "Sahaya Charitable Trust",
  description: "Serving humanity with compassion.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />

        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png" />
      </head>



      <body className="antialiased bg-[var(--background)] text-[var(--foreground)] min-h-screen">
        <div>
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}