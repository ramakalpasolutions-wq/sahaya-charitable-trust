// src/app/gallery/page.js
"use client";

import { useEffect, useState, useRef } from "react";

/**
 * GalleryPage with:
 * - per-event Open/Collapse (desktop + mobile)
 * - slide-down animation (maxHeight transition)
 * - emoji folder icons (📁 closed / 📂 open)
 * - search bar to filter events
 * - hover highlight for desktop
 * - badge showing number of photos on folder card
 */

export default function GalleryPage() {
  const [gallery, setGallery] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openEvents, setOpenEvents] = useState([]); // array of event keys that are open
  const [lightbox, setLightbox] = useState({ open: false, src: "", alt: "" });
  const [query, setQuery] = useState("");
  const containerRefs = useRef({}); // store refs to measure content heights if needed

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/event-photos");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "Failed to load gallery");
        setGallery(body.gallery || {});
      } catch (err) {
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const events = Object.keys(gallery).sort((a, b) => a.localeCompare(b));

  function toggleEvent(ev) {
    setOpenEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]));
  }

  function isOpen(ev) {
    return openEvents.includes(ev);
  }

  function openLightbox(src, alt = "") {
    setLightbox({ open: true, src, alt });
    if (typeof window !== "undefined") document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    setLightbox({ open: false, src: "", alt: "" });
    if (typeof window !== "undefined") document.body.style.overflow = "";
  }

  // search filter (case-insensitive)
  const filteredEvents = events.filter((ev) => ev.replace(/_/g, " ").toLowerCase().includes(query.trim().toLowerCase()));

  // helper to provide a safe preview src
  function previewSrc(items) {
    if (!items || items.length === 0) return null;
    return items[0].thumb || items[0].optimized || items[0].original || null;
  }

  return (
    <main className="min-h-screen p-4 sm:p-8" style={{ background: "var(--background)" }}>
      <div className="max-w-6xl mx-auto ">

        <h1 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">Sahaya — Event Gallery</h1>

        {/* Search + summary */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex-1">
            <label htmlFor="gallery-search" className="sr-only">Search events</label>
            <input
              id="gallery-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events (e.g.Name,2025)..."
              className="w-full px-3 py-2 rounded border focus:ring-2 focus:ring-indigo-300 outline-none bg-white/60"
            />
          </div>

          <div className="mt-2 sm:mt-0 sm:ml-4 flex items-center gap-3 ">
            <div className="text-sm text-slate-600">
              {loading ? "Loading…" : `${filteredEvents.length} event${filteredEvents.length !== 1 ? "s" : ""}`}
            </div>
            <button
              onClick={() => {
                // collapse all
                setOpenEvents([]);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="px-3 py-2 text-sm rounded border bg-white/5 hover:bg-white/10 hover:cursor-pointer"
            >
              Collapse all
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {!loading && filteredEvents.length === 0 && (
          <div className="text-sm text-slate-600 text-center py-8">No events match your search.</div>
        )}

        {/* Events list */}
        <div className="space-y-6  p-5 rounded ">
          {filteredEvents.map((ev) => {
            const items = gallery[ev] || [];
            const label = ev.replace(/_/g, " ");
            const rep = previewSrc(items);
            const open = isOpen(ev);

            // prepare a ref to measure content (optional; we use maxHeight trick)
            if (!containerRefs.current[ev]) containerRefs.current[ev] = { contentRef: null };

            return (
              <section
                key={ev}
                className="p-4 rounded-xl bg-white/5 backdrop-blur-sm transition-transform hover:-translate-y-1 hover:shadow-lg bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100"
              >
                {/* header row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl" aria-hidden>
                      {open ? "📂" : "📁"}
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold">{label}</h2>
                      <div className="text-xs text-slate-400">{items.length} photos</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* photo count badge */}
                    <div className="hidden sm:inline-flex items-center justify-center px-2 py-1 rounded-full bg-blue-900 text-white text-xs font-semibold">
                      {items.length}
                    </div>

                    <button
                      onClick={() => toggleEvent(ev)}
                      className={`px-4 py-2 text-sm rounded border ${open ? "bg-white/10" : "bg-white/5"} hover:bg-white/20 hover:cursor-pointer`}
                      aria-expanded={open}
                      aria-controls={`event-${ev}`}
                    >
                      {open ? "Collapse" : "Open"}
                    </button>
                  </div>
                </div>

                {/* folder-card view (collapsed): preview + small badge + open button */}
                {!open && (
                  <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="flex items-center gap-4 md:col-span-1">
                      {rep ? (
                        <img src={rep} alt={`${label} preview`} className="w-32 h-24 object-cover rounded border opacity-50" />
                      ) : (
                        <div className="w-32 h-24 flex items-center justify-center rounded border bg-black/10 text-sm text-slate-600">No preview</div>
                      )}

                      <div className="flex-1">
                        <div className="font-medium">{label}</div>
                        <div className="text-sm text-slate-500 mt-1">{items.length} photos</div>

                        <div className="mt-3">
                          <button
                            onClick={() => toggleEvent(ev)}
                            className="px-3 py-2 bg-blue-900 text-white text-sm rounded hover:cursor-pointer"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* show a small row of up to 4 thumbnails as quick peek 
                    <div className="hidden md:flex md:col-span-2 gap-2 items-center">
                      {items.slice(0, 4).map((img, i) => {
                        const src = img.optimized || img.thumb || img.original;
                        return (
                          <img key={i} src={src} alt={`${label} peek ${i + 1}`} className="w-20 h-14 object-cover rounded border" loading="lazy" />
                        );
                      })}
                    </div>*/}
                  </div>
                )}
                  

                {/* thumbnails grid (open) with slide animation */}
                <div
                  id={`event-${ev}`}
                  aria-hidden={!open}
                  className="overflow-hidden transition-all duration-300 ease-in-out mt-9"
                  style={{ maxHeight: open ? "1200px" : "0px" }}
                >
                  <div ref={(el) => (containerRefs.current[ev].contentRef = el)} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-15">
                    {items.map((img, i) => {
                      const src = img.optimized || img.thumb || img.original;
                      const alt = img.alt || `${label} photo ${i + 1}`;
                      return (
                        <button
                          key={i}
                          onClick={() => openLightbox(src, alt)}
                          className="block rounded overflow-hidden border bg-black/5 p-0"
                          aria-label={`Open ${alt}`}
                        >
                          <img src={src} alt={alt} className="w-full h-36 md:h-full object-cover" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox.open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={closeLightbox}
        >
          <div className="max-w-screen-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <button onClick={closeLightbox} className="px-3 py-1 text-white bg-black/40 rounded">Close</button>
            </div>
            <img src={lightbox.src} alt={lightbox.alt} className="w-full h-auto rounded" />
          </div>
        </div>
      )}
    </main>
  );
}
