// src/app/gallery/page.js
"use client";

import { useEffect, useState } from "react";

export default function GalleryPage() {
  const [gallery, setGallery] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // popup gallery viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventImages, setEventImages] = useState([]);

  // lightbox
  const [lightbox, setLightbox] = useState({ open: false, src: "", alt: "" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/event-photos");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "Failed to load gallery");

        // REMOVE HOME SLIDER FOLDER FROM GALLERY
        const g = body.gallery || {};
        delete g.home_slider;

        setGallery(g);
      } catch (err) {
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ESC closes viewer/lightbox
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        if (lightbox.open) {
          closeLightbox();
        } else if (viewerOpen) {
          closeEventViewer();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox.open, viewerOpen]);

  const events = Object.keys(gallery).sort((a, b) => a.localeCompare(b));

  // search filter
  const filteredEvents = events.filter((ev) =>
    ev.replace(/_/g, " ").toLowerCase().includes(query.trim().toLowerCase())
  );

  // preview first image
  function previewSrc(items) {
    if (!items || items.length === 0) return null;
    return items[0].thumb || items[0].optimized || items[0].original || null;
  }

  // open event viewer
  function openEventViewer(ev) {
    setSelectedEvent(ev);
    setEventImages(gallery[ev] || []);
    setViewerOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeEventViewer() {
    setViewerOpen(false);
    setSelectedEvent(null);
    setEventImages([]);
    if (!lightbox.open) document.body.style.overflow = "";
  }

  // lightbox
  function openLightbox(src, alt = "") {
    setLightbox({ open: true, src, alt });
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    setLightbox({ open: false, src: "", alt: "" });
    if (!viewerOpen) document.body.style.overflow = "";
  }

  return (
    <main className="min-h-screen p-4 sm:p-8" style={{ background: "var(--background)" }}>
      <div className="max-w-6xl mx-auto ">

        <h1 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6 text-blue-900">
          Sahaya — Event Gallery
        </h1>

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full px-3 py-2 rounded border bg-white/60 focus:ring-2 focus:ring-indigo-300 outline-none"
            />
          </div>

          <div className="text-sm text-slate-600">
            {loading ? "Loading…" : `${filteredEvents.length} event${filteredEvents.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {!loading && filteredEvents.length === 0 && (
          <div className="text-sm text-slate-600 text-center py-8">No events match your search.</div>
        )}

        {/* EVENT LIST */}
        <div className="space-y-6 p-5 rounded">
          {filteredEvents.map((ev) => {
            const items = gallery[ev] || [];
            const label = ev.replace(/_/g, " ");
            const rep = previewSrc(items);

            return (
              <section
                key={ev}
                className="p-4 rounded-xl bg-white/5 backdrop-blur-sm transition-transform hover:-translate-y-1 hover:shadow-lg bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">📁</div>
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold">{label}</h2>
                      <div className="text-xs text-slate-400">{items.length} photos</div>
                    </div>
                  </div>

                  <button
                    onClick={() => openEventViewer(ev)}
                    className="px-4 py-2 text-sm rounded border bg-blue-900 text-white hover:bg-blue-800 hover:cursor-pointer cursor-blue"
                  >
                    Open
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  {rep ? (
                    <img src={rep} className="w-32 h-24 object-cover rounded border" alt={`${label} preview`} />
                  ) : (
                    <div className="w-32 h-24 flex items-center justify-center rounded border bg-black/10 text-sm text-slate-600">
                      No Preview
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* POPUP EVENT VIEWER */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={closeEventViewer}
        >
          <div
            className="bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 max-w-9xl w-full max-h-[90vh] overflow-auto rounded-lg p-9 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeEventViewer}
              className="absolute top-3 right-3 px-3 py-1 text-white bg-black/40 rounded"
            >
              Close ✕
            </button>

            <h2 className="text-4xl font-bold mb-4">{selectedEvent?.replace(/_/g, " ")}</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
              {eventImages.map((img, i) => {
                const src = img.optimized || img.thumb || img.original;

                return (
                  <button
                    key={i}
                    onClick={() => openLightbox(src)}
                    className="border rounded overflow-hidden"
                  >
                    <img src={src} className="w-full h-40 object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox.open && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={closeLightbox}
        >
          <div className="max-w-screen-lg w-full max-h-[90vh] overflow-auto">
            <button
              onClick={closeLightbox}
              className="px-3 py-1 text-white bg-black/40 rounded mb-3"
            >
              Close
            </button>

            {/* FIT IMAGE — NO ZOOM */}
            <img
              src={lightbox.src}
              style={{
                objectFit: "contain",
                maxHeight: "85vh",
                width: "100%",
              }}
              className="rounded"
            />
          </div>
        </div>
      )}
    </main>
  );
}