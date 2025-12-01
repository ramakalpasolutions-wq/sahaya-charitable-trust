"use client";

import { useEffect, useState, useRef } from "react";

const API = "/api/event-photos";
const HERO_KEYS = new Set(["home_slider", "home-slider", "homeSlider"]);

export default function GalleryPage() {
  // app state
  const [gallery, setGallery] = useState({}); // { eventName: [items...] } (hero items removed)
  const [heroGallery, setHeroGallery] = useState([]); // slider items array
  const [events, setEvents] = useState([]); // non-hero event keys
  const [selectedEvent, setSelectedEvent] = useState(""); // currently selected folder key (for UI)
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  // search query
  const [query, setQuery] = useState("");

  // viewer modal (folder opens in popup)
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState([]); // array of embed urls (for youtube) or image srcs/objects
  const [viewerIsYoutube, setViewerIsYoutube] = useState(false);

  // hero carousel controls
  const [heroIndex, setHeroIndex] = useState(0);
  const heroTimer = useRef(null);

  // refs
  const viewerPanelRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytIframeRef = useRef(null);

  useEffect(() => {
    loadGallery();
    // cleanup on unmount
    return () => {
      if (heroTimer.current) clearInterval(heroTimer.current);
      document.body.style.overflow = "";
      removeFullscreenListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // start auto-advance only when heroGallery has >1 item
    if (heroTimer.current) clearInterval(heroTimer.current);
    if (heroGallery && heroGallery.length > 1) {
      heroTimer.current = setInterval(() => {
        setHeroIndex((i) => (i + 1) % heroGallery.length);
      }, 4500);
    }
    return () => {
      if (heroTimer.current) clearInterval(heroTimer.current);
    };
  }, [heroGallery]);

  // LOCK page scroll while lightbox open (centralized)
  useEffect(() => {
    if (lightboxSrc) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [lightboxSrc]);

  // -----------------------
  // Helpers
  // -----------------------
  function getImgUrl(img) {
    if (!img) return "";
    if (typeof img === "string") return img;
    return img.original || img.optimized || img.thumb || img.url || "";
  }

  function safeSrc(img) {
    const s = getImgUrl(img);
    return s && s.trim() !== "" ? s : null;
  }

  function getHeroUrlSet(heroArr) {
    return new Set((heroArr || []).map(getImgUrl).filter(Boolean));
  }

  function isYoutubeFolder(ev) {
    const items = gallery[ev];
    return Array.isArray(items) && items.length > 0 && items[0]?.youtube === true;
  }

  function parseYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtube.com")) {
        return u.searchParams.get("v");
      } else if (u.hostname.includes("youtu.be")) {
        return u.pathname.replace("/", "");
      }
      return null;
    } catch (e) {
      const m = (url || "").match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : null;
    }
  }

  function youTubeEmbedSrc(url) {
    const id = parseYouTubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  function youtubeThumbUrl(url) {
    const id = parseYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }

  // preview first useful image (skip youtube items and skip hero images)
  function previewSrc(items, heroSet) {
    if (!items || items.length === 0) return null;
    for (const it of items) {
      if (!it) continue;
      // skip if this item is in hero set
      const u = getImgUrl(it);
      if (u && heroSet.has(u)) continue;
      if (typeof it === "string") return it;
      if (it.youtube === true) continue;
      const src = it.thumb || it.optimized || it.original || it.url || null;
      if (src && String(src).trim()) return src;
    }
    return null;
  }

  // -----------------------
  // load gallery from API
  // -----------------------
  async function loadGallery() {
    setLoading(true);
    setError(null);
    setStatus("Loading gallery...");
    try {
      const res = await fetch(API);
      const text = await res.text().catch(() => "");
      let body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error("Invalid JSON from server");
      }
      if (!res.ok) throw new Error(body?.error || `Server error (${res.status})`);

      const galleryFromBody = body.gallery ?? body ?? {};
      const sliderFromBody = body.slider ?? body.home_slider ?? body.homeSlider ?? [];

      // normalize and sanitize: remove empty arrays and invalid items
      const finalGallery = galleryFromBody.gallery ?? galleryFromBody;
      const cleaned = {};
      for (const [k, v] of Object.entries(finalGallery || {})) {
        if (!Array.isArray(v) || v.length === 0) continue;
        const filtered = v.filter((item) => {
          if (!item) return false;
          if (typeof item === "string") return item.trim() !== "";
          if (typeof item === "object") {
            if (item.youtube === true) return !!(item.url && String(item.url).trim());
            return !!(item.original || item.optimized || item.thumb || item.url);
          }
          return false;
        });
        if (filtered.length > 0) cleaned[k] = filtered;
      }

      // Set heroGallery first (raw slider array from server)
      const heroArr = Array.isArray(sliderFromBody) ? sliderFromBody : [];
      setHeroGallery(heroArr);

      // Build hero URL set for filtering
      const heroSet = getHeroUrlSet(heroArr);

      // Remove any items from cleaned that are present in heroSet
      const galleryWithoutHeroItems = {};
      for (const [k, items] of Object.entries(cleaned)) {
        // Filter out items whose image URL matches a hero URL
        const filteredForHero = items.filter((it) => {
          const u = getImgUrl(it);
          // keep youtube items (they won't match hero image URLs usually), but still skip if URL matches heroSet
          if (u && heroSet.has(u)) return false;
          return true;
        });
        if (filteredForHero.length > 0) galleryWithoutHeroItems[k] = filteredForHero;
      }

      setGallery(galleryWithoutHeroItems || {});

      // compute events array (exclude hero keys and only those remaining after filtering)
      const evs = Object.keys(galleryWithoutHeroItems || {}).filter((k) => !HERO_KEYS.has(k)).sort((a, b) =>
        String(a).localeCompare(b)
      );
      setEvents(evs);
      setSelectedEvent(evs[0] || "");
      setStatus("");
    } catch (err) {
      console.error("Gallery load error:", err);
      setError(err.message || String(err));
      setGallery({});
      setHeroGallery([]);
      setEvents([]);
      setSelectedEvent("");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  const heroUrlSet = getHeroUrlSet(heroGallery);

  // -----------------------
  // Fullscreen helpers for YouTube viewer
  // -----------------------
  function requestElementFullscreen(el) {
    if (!el) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) req.call(el);
  }
  function exitFullscreen() {
    const ex = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (ex) ex.call(document);
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
      // nothing special to do for now
    }
  }

  function addFullscreenListeners() {
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onGlobalKeyDownWhileYt);
  }

  function removeFullscreenListeners() {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    document.removeEventListener("mozfullscreenchange", onFullscreenChange);
    document.removeEventListener("keydown", onGlobalKeyDownWhileYt);
  }

  function onGlobalKeyDownWhileYt(e) {
    if (e.key === "Escape") {
      if (viewerOpen && !lightboxSrc) {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
          exitFullscreen();
          return;
        }
        closeEventViewer();
      }
    }
  }

  // -----------------------
  // Folder viewer
  // -----------------------
  function openEventViewer(ev, startIndex = null) {
    const items = gallery[ev] || [];
    const isYT = items.length > 0 && items[0]?.youtube === true;
    setSelectedEvent(ev);

    if (isYT) {
      const embeds = items
        .map((it) => {
          if (!it) return null;
          const url = typeof it === "string" ? it : it.url || "";
          if (!url) return null;
          return youTubeEmbedSrc(url) || null;
        })
        .filter(Boolean);
      setViewerIsYoutube(true);
      setViewerImages(embeds);
      setViewerOpen(true);

      setTimeout(() => {
        if (startIndex != null) {
          const el = document.getElementById(`viewer-item-${startIndex}`);
          if (el && viewerPanelRef.current) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        addFullscreenListeners();
      }, 50);

      return;
    }

    const imgItems = items.filter((it) => it && it.youtube !== true);
    setViewerIsYoutube(false);
    setViewerImages(imgItems);
    setViewerOpen(true);

    if (startIndex != null) {
      setTimeout(() => {
        const el = document.getElementById(`viewer-item-${startIndex}`);
        if (el && viewerPanelRef.current) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          openLightbox(startIndex);
        }
      }, 50);
    }
  }

  function closeEventViewer() {
    setViewerOpen(false);
    setViewerImages([]);
    setViewerIsYoutube(false);
    removeFullscreenListeners();
  }

  // open a single image in lightbox
  function openLightbox(srcOrIndex) {
    if (typeof srcOrIndex === "number") {
      const idx = srcOrIndex;
      const item = viewerImages[idx];
      if (!item) return;
      const src = typeof item === "string" ? item : (item.optimized || item.thumb || item.original || item.url || "");
      setLightboxIndex(idx);
      setLightboxSrc(src);
      return;
    }
    const src = srcOrIndex;
    setLightboxIndex(null);
    setLightboxSrc(src);
  }

  function closeLightbox() {
    setLightboxSrc(null);
    setLightboxIndex(null);
  }

  function lightboxPrev() {
    if (!viewerImages || viewerImages.length === 0) return;
    let idx = lightboxIndex;
    if (idx == null) {
      idx = viewerImages.findIndex((it) => {
        const s = typeof it === "string" ? it : (it.optimized || it.thumb || it.original || it.url || "");
        return s === lightboxSrc;
      });
      if (idx === -1) return;
    }
    const newIndex = (idx - 1 + viewerImages.length) % viewerImages.length;
    const item = viewerImages[newIndex];
    const src = typeof item === "string" ? item : (item.optimized || item.thumb || item.original || item.url || "");
    setLightboxIndex(newIndex);
    setLightboxSrc(src);

    setTimeout(() => {
      const el = document.getElementById(`viewer-item-${newIndex}`);
      if (el && viewerPanelRef.current) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function lightboxNext() {
    if (!viewerImages || viewerImages.length === 0) return;
    let idx = lightboxIndex;
    if (idx == null) {
      idx = viewerImages.findIndex((it) => {
        const s = typeof it === "string" ? it : (it.optimized || it.thumb || it.original || it.url || "");
        return s === lightboxSrc;
      });
      if (idx === -1) return;
    }
    const newIndex = (idx + 1) % viewerImages.length;
    const item = viewerImages[newIndex];
    const src = typeof item === "string" ? item : (item.optimized || item.thumb || item.original || item.url || "");
    setLightboxIndex(newIndex);
    setLightboxSrc(src);

    setTimeout(() => {
      const el = document.getElementById(`viewer-item-${newIndex}`);
      if (el && viewerPanelRef.current) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  // -----------------------
  // keyboard navigation
  // -----------------------
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (lightboxSrc) closeLightbox();
        else if (viewerOpen) closeEventViewer();
        return;
      }
      if (e.key === "ArrowLeft") {
        if (lightboxSrc) lightboxPrev();
      } else if (e.key === "ArrowRight") {
        if (lightboxSrc) lightboxNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, viewerImages, lightboxSrc, lightboxIndex]);

  // -----------------------
  // derived filtered events by search query (separate photos/youtube)
  // -----------------------
  const filtered = events.filter((ev) =>
    ev.replace(/_/g, " ").toLowerCase().includes(query.trim().toLowerCase())
  );

  const photoEvents = filtered.filter((ev) => !isYoutubeFolder(ev));
  const youtubeEvents = filtered.filter((ev) => isYoutubeFolder(ev));

  // -----------------------
  // Render
  // -----------------------
  return (
    <div className="min-h-screen p-6 md:p-10  text-black" >
      <div className="max-w-7xl mx-auto">
        {/* HERO carousel */}
        <section className="mb-8">
          <div className="relative rounded-lg overflow-hidden bg-black/40">
            {heroGallery && heroGallery.length > 0 ? (
              <>
                <div className="w-full aspect-[16/2] md:aspect-[16/2] relative">
                 
                  <div className="absolute inset-0 bg-white/100 flex items-center justify-center pointer-events-none">
                    <h1 className="text-2xl md:text-4xl font-extrabold text-white/90">Gallery</h1>
                  </div>
                </div>

              

                <div className="absolute right-4 bottom-4 flex gap-2">
                  {heroGallery.map((h, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHeroIndex(idx)}
                      className={`w-2 h-2 rounded-full ${heroIndex === idx ? "bg-white" : "bg-white/20"}`}
                      aria-label={`Go to hero ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-48 md:h-15 flex items-center justify-center bg-white rounded ">
                <h2 className="text-xl ">Gallery</h2>
              </div>
            )}
          </div>
        </section>

        {/* SEARCH */}
        <section className="mb-6 flex items-center justify-between gap-4">
          <div className="flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search folders..."
              className="w-full px-3 py-2 rounded border bg-white/60 focus:ring-2 focus:ring-indigo-300 outline-none"
            />
          </div>

          <div className="text-sm text-white/70">
            {loading ? "Loading…" : `${filtered.length} folder${filtered.length !== 1 ? "s" : ""}`}
          </div>
        </section>

        {/* gallery header */}
        <section id="gallery-section" className="mb-6">
          <h2 className="text-xl md:text-2xl font-semibold mb-3">
            {selectedEvent ? selectedEvent.replace(/_/g, " ") : "Select an event (or open a folder)"}
          </h2>

          {!selectedEvent && <p className="text-sm text-black/70">Open a folder using the Open button on each card to view photos or YouTube links in a popup.</p>}
        </section>

        {/* Photo Folders Grid */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Photo Folders</h3>

          {loading ? (
            <div className="text-sm text-black/70">Loading...</div>
          ) : photoEvents.length === 0 ? (
            <div className="text-sm text-black/70">No photo folders found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {photoEvents.map((ev) => {
                const items = gallery[ev] || [];
                const first = items[0];
                const thumb = previewSrc(items, heroUrlSet); // ensures we skip hero items when picking thumb
                return (
                  <div
                    key={ev}
                    onClick={() => openEventViewer(ev)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openEventViewer(ev);
                    }}
                    role="button"
                    tabIndex={0}
                    className="border rounded-lg bg-white/5 overflow-hidden flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <div className="w-full h-44 bg-gray-800 flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={`${ev}-thumb`} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="text-sm text-white/70">No preview</div>
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="mb-2 font-medium text-lg">{ev.replace(/_/g, " ")}</div>
                        <div className="text-sm text-black/100">{items.length} item{items.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* YouTube Folders Grid */}
        <section className="mb-16">
          <h3 className="text-lg font-semibold mb-3">YouTube Folders</h3>

          {loading ? (
            <div className="text-sm text-white/70">Loading...</div>
          ) : youtubeEvents.length === 0 ? (
            <div className="text-sm text-white/70">No YouTube folders found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {youtubeEvents.map((ev) => {
                const items = gallery[ev] || [];
                const first = items[0];
                const thumb = youtubeThumbUrl(first?.url || "");
                return (
                  <div
                    key={ev}
                    onClick={() => openEventViewer(ev)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openEventViewer(ev);
                    }}
                    role="button"
                    tabIndex={0}
                    className="border rounded-lg bg-white/5 overflow-hidden flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <div className="w-full h-44 bg-gray-800 flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={`${ev}-thumb`} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="text-sm text-white/70">No thumbnail</div>
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="mb-2 font-medium text-lg">{ev.replace(/_/g, " ")}</div>
                        <div className="text-sm text-white/60">{items.length} video{items.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* FOLDER VIEWER POPUP */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-6"
          onClick={closeEventViewer}
        >
          <div
            className="w-full max-w-[1700px] mx-auto rounded-lg relative shadow-xl bg-transparent"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "28px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            role="dialog"
            aria-modal="true"
            ref={viewerPanelRef}
          >
            <button
              onClick={closeEventViewer}
              className="absolute top-4 right-4 px-3 py-1 text-white bg-black/40 rounded"
            >
              Close ✕
            </button>

            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-cyan-700">{selectedEvent?.replace(/_/g, " ")}</h2>

            {viewerIsYoutube ? (
              <div>
                <div className="flex items-center justify-end mb-4 gap-2">
                  <button
                    onClick={() => {
                      if (ytContainerRef.current) requestElementFullscreen(ytContainerRef.current);
                    }}
                    className="px-3 py-1 bg-black/60 rounded text-white/90"
                    aria-label="Open video fullscreen"
                  >
                    Fullscreen
                  </button>
                  <button
                    onClick={() => {
                      exitFullscreen();
                    }}
                    className="px-3 py-1 bg-black/60 rounded text-white/90"
                    aria-label="Exit fullscreen"
                  >
                    Exit Fullscreen
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {viewerImages.map((embedUrl, idx) => (
                    <div
                      key={idx}
                      id={`viewer-item-${idx}`}
                      ref={idx === 0 ? ytContainerRef : null}
                      className="w-full aspect-video rounded overflow-hidden border bg-black"
                      style={{ position: "relative" }}
                    >
                      <iframe
                        ref={idx === 0 ? ytIframeRef : null}
                        title={`yt-${selectedEvent}-${idx}`}
                        src={embedUrl + "?autoplay=0&rel=0&modestbranding=1"}
                        frameBorder="0"
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        className="w-full h-full rounded"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {viewerImages.map((img, i) => {
                  const src = typeof img === "string" ? img : (img.optimized || img.thumb || img.original || img.url || "");
                  return (
                    <button
                      key={i}
                      id={`viewer-item-${i}`}
                      onClick={() => openLightbox(i)}
                      className="w-full h-full mb-2 rounded overflow-hidden border-2 border-transparent hover:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
                    >
                      <img src={src} className="w-full h-64 object-cover" alt={`img-${i}`} loading="lazy" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
        >
          <div className="max-w-5xl w-full rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-3 bg-black/60">
              <div>
                <button onClick={lightboxPrev} className="px-3 py-1 text-white bg-black/40 rounded mr-2">Prev</button>
                <button onClick={lightboxNext} className="px-3 py-1 text-white bg-black/40 rounded">Next</button>
              </div>
              <button onClick={closeLightbox} className="px-3 py-1 text-white bg-black/40 rounded">Close</button>
            </div>

            <img src={lightboxSrc} alt="Preview" className="w-full h-auto max-h-[90vh] object-contain bg-black" />
            <div className="flex justify-center gap-2 p-3 bg-black/60 text-xs text-white/70">
              {typeof lightboxIndex === "number" ? `${lightboxIndex + 1} / ${viewerImages.length}` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}