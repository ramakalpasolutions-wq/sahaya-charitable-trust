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
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)] min-h-screen">
        <div className="">
  
        <Header />
        <main>{children}</main>
        <Footer />
        </div>
      </body>
    </html>
  );
}
