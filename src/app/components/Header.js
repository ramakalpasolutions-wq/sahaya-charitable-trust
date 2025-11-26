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
      <div className="hidden md:flex items-center justify-between p-6 bg-[#00defc3f] shadow sticky top-0 z-40">
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
      <div className="md:hidden fixed top-4 left-1/2 transform -translate-x-1/2 w-[98%] z-50">
        <div className="bg-[#00defc3f] backdrop-blur rounded-xl p-2 shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/turst-logo.webp" alt="Logo" className="w-12 h-12 rounded-md object-cover ml-1" />

            <Link
              href="/"
              className="text-base font-serif font-bold bg-gradient-to-r from-indigo-600 to-green-500 bg-clip-text text-transparent whitespace-nowrap"
            >
              Sahaya Charitable Trust
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="menu"
            className="p-2 rounded-md ring-1 ring-slate-200 hover:bg-slate-150"
          >
            <svg className="w-6 h-6 " fill="none" stroke="currentColor">
              {open ? (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown */}
        <div className={`mt-2 overflow-hidden rounded-xl bg-black/10 backdrop-blur shadow transition-all ${open ? "max-h-72" : "max-h-0"}`}>
          <nav className="px-3 py-3">
            <ul className="flex flex-col gap-2 text-sm text-white ">
              <Link href="/" className="block px-2 py-2 rounded hover:bg-slate-100">Home</Link>
              <Link href="/about" className="block px-2 py-2 rounded hover:bg-slate-100">About</Link>
              <Link href="/programs" className="block px-2 py-2 rounded hover:bg-slate-100">Programs</Link>
              <Link href="/gallery" className="block px-2 py-2 rounded hover:bg-slate-100">Gallery</Link>
              <Link href="/contact" className="block px-2 py-2 rounded hover:bg-slate-100">Contact</Link>
            </ul>

            <div className="mt-3 flex gap-2">
              <Link href="/donate" className="flex-1 text-center px-3 py-2 bg-green-500 text-white rounded">Donate</Link>
             
            </div>
          </nav>
        </div>
      </div>

      <div className="md:hidden h-20" />
    </header>
  );
}
