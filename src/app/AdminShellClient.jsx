// src/app/AdminShellClient.jsx
"use client";

import React from "react";
import PropTypes from "prop-types";
import { usePathname } from "next/navigation";

/**
 * AdminShellClient (responsive)
 *
 * - On lg+ (desktop) this component simply renders `children` unchanged.
 * - On smaller screens it renders a compact two-column shell:
 *   a narrow left scrollable sidebar and a large right gradient content area.
 *
 * Props:
 *  - left: optional React node to render in the left sidebar on mobile
 *  - right: optional React node to render in the right content area on mobile
 *  - children: the full desktop admin UI (rendered unchanged on lg+)
 */
export default function AdminShellClient({ left = null, right = null, children }) {
  const pathname = usePathname() || "";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  // If not on an admin route, render children unchanged
  if (!isAdminRoute) return <>{children}</>;

  return (
    <>
      {/* MOBILE / SMALL SCREENS (visible < lg) */}
      <div
        className="block lg:hidden min-h-screen bg-[var(--background)] flex justify-center items-start py-4"
        aria-hidden={false}
      >
        <div className="w-full max-w-screen-md flex gap-4 px-3">
          {/* Narrow left sidebar */}
          <aside
            className="flex-none w-16 sm:w-20 md:w-28 h-[90vh] overflow-y-auto rounded-xl bg-white/10 p-2 shadow-inner"
            aria-label="Admin controls"
          >
            <div className="space-y-4">
              {/* Render provided left slot if present — don't duplicate children by default */}
              {left}
            </div>
          </aside>

          {/* Right content: large gradient panel */}
          <main
            className="flex-1 min-h-[90vh] rounded-2xl p-4 shadow-xl bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100"
            role="main"
            aria-label="Admin content"
          >
            {/* Prefer explicit right prop, otherwise render children (desktop UI as fallback) */}
            {right ?? children}
          </main>
        </div>
      </div>

      {/* DESKTOP / LARGE SCREENS: render original children unchanged */}
      <div className="hidden lg:block">{children}</div>
    </>
  );
}

AdminShellClient.propTypes = {
  left: PropTypes.node,
  right: PropTypes.node,
  children: PropTypes.node.isRequired,
};
