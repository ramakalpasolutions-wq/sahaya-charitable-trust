// src/app/components/Header.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="w-full z-40">
      {/* Desktop */}
      {/* Desktop */}
<div className="hidden   lg:flex items-center justify-between p-6 bg-[#00defc3f] shadow sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <img src="/turst-logo.webp" alt="Logo" className="w-20 h-20 ml-3 rounded-md object-cover" />

          <Link
            href="/"
            className="inline-block text-xl font-serif font-bold bg-gradient-to-r from-indigo-600 to-green-500 bg-clip-text text-transparent whitespace-nowrap"
          >
            Sahaya Charitable Trust
          </Link>
        </div>

        <nav className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-6 text-[15px] font-bold text-black">
            {["Home", "About", "Programs", "Gallery", "Contact"].map((item) => (
              <Link
                key={item}
                href={`/${item === "Home" ? "" : item.toLowerCase()}`}
                className="relative inline-block after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-[var(--link)] after:transition-all hover:after:w-full hover:text-[var(--link-hover)]"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/donate" className="bg-blue-900 text-white px-4 py-2 rounded-md hover:bg-blue-800 transition">
              Donate
            </Link>

           
          </div>
        </nav>
      </div>

        {/* Mobile */}
   {/* Mobile + Tablet Header (0px → 1024px) */}
<div className="lg:hidden fixed top-4 left-1/2 -translate-x-1/2 w-[98%] z-50">
  <div className="bg-gradient-to-r from-[#4ee6ff] to-[#83f3ff] backdrop-blur-xl rounded-xl px-3 py-2 shadow flex items-center justify-between">
    
    {/* Logo + Title */}
    <div className="flex items-center gap-3">
      <img
        src="/turst-logo.webp"
        alt="Logo"
        className="w-10 h-10 rounded-md object-cover"
      />

      <Link
        href="/"
        className="text-base sm:text-lg font-serif font-bold bg-gradient-to-r from-indigo-600 to-green-500 bg-clip-text text-transparent"
      >
        Sahaya Charitable Trust
      </Link>
    </div>

    {/* Hamburger Button */}
    <button
      onClick={() => setOpen(!open)}
      className="p-2 rounded-lg ring-1 ring-white/60 hover:bg-white/20 transition"
    >
      <svg
        width="25"
        height="25"
        stroke="black"
        strokeWidth="2"
        className="pointer-events-none"
      >
        {open ? (
          <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
        ) : (
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        )}
      </svg>
    </button>

  </div>

  {/* Dropdown */}
  <div
    className={`mt-2 overflow-hidden rounded-xl bg-black/10 backdrop-blur shadow transition-all ${
      open ? "max-h-72" : "max-h-0"
    }`}
  >
    <nav className="px-3 py-3">
      <ul className="flex flex-col gap-2 text-sm text-white">
        <Link href="/" className="px-2 py-2 rounded hover:bg-slate-100">Home</Link>
        <Link href="/about" className="px-2 py-2 rounded hover:bg-slate-100">About</Link>
        <Link href="/programs" className="px-2 py-2 rounded hover:bg-slate-100">Programs</Link>
        <Link href="/gallery" className="px-2 py-2 rounded hover:bg-slate-100">Gallery</Link>
        <Link href="/contact" className="px-2 py-2 rounded hover:bg-slate-100">Contact</Link>
      </ul>

      <div className="mt-3 flex gap-2">
        <Link href="/donate" className="flex-1 text-center px-3 py-2 bg-green-500 text-white rounded">
          Donate
        </Link>
      </div>
    </nav>
  </div>
</div>

{/* Spacing to push content down */}
<div className="lg:hidden h-20" />

      </header>
    );
  }