// src/app/admin/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "/api/event-photos";
const EXAMPLE_LOCAL_PATH = "/mnt/data/3b9d88d7-3ddd-44b0-b3e7-dad4e4e185b4.png";

export default function AdminPage() {
  const router = useRouter();

  // main form state
  const [eventName, setEventName] = useState("");
  const [files, setFiles] = useState([]);
  const [singleFile, setSingleFile] = useState(null);

  // galleries
  const [gallery, setGallery] = useState({}); // { eventName: [items...] }
  const [selectedEvent, setSelectedEvent] = useState(""); // which folder is open
  const [heroGallery, setHeroGallery] = useState([]); // home slider images

  // UI state
  const [useExisting, setUseExisting] = useState(true);
  const [status, setStatus] = useState("");

  // hero card state (kept minimal)
  const [heroFiles, setHeroFiles] = useState([]);
  const [heroPreview, setHeroPreview] = useState(EXAMPLE_LOCAL_PATH);
  const [heroUploading, setHeroUploading] = useState(false);

  // -----------------------
  // Helpers
  // -----------------------
  function getImgUrl(img) {
    if (!img) return "";
    if (typeof img === "string") return img;
    return img.original || img.optimized || img.thumb || "";
  }

  function getHeroUrlSet(heroArr) {
    return new Set((heroArr || []).map(getImgUrl).filter(Boolean));
  }

  // Allowed extensions (lowercase) and simple MIME check
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".tiff"];
  function isValidImageFile(file) {
    if (!file) return false;
    // basic MIME check
    if (file.type && !file.type.startsWith("image/")) return false;
    // extension check (filename may be missing in some environments)
    const name = (file.name || "").toLowerCase();
    return allowedExts.some(ext => name.endsWith(ext));
  }

  // Keys that represent the home slider in various API shapes
  const HERO_KEYS = new Set(["home_slider", "home-slider", "homeSlider"]);

  // -----------------------
  // Auth check (client)
  // -----------------------
  useEffect(() => {
    const logged = localStorage.getItem("isAdmin");
    if (!logged) router.push("/admin-login");
  }, [router]);

  // -----------------------
  // Load gallery + slider
  // -----------------------
  async function loadGallery() {
    try {
      const res = await fetch(API);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load gallery");

      const galleryFromBody = body.gallery ?? body;
      const sliderFromBody = body.slider ?? body.home_slider ?? body.homeSlider ?? [];

      const finalGallery = body.gallery ?? (galleryFromBody.gallery ? galleryFromBody.gallery : (typeof galleryFromBody === "object" ? galleryFromBody : {}));
      setGallery(finalGallery || {});
      setHeroGallery(Array.isArray(sliderFromBody) ? sliderFromBody : []);

      const keys = Object.keys(finalGallery || {});
      const firstNonHero = keys.find(k => !HERO_KEYS.has(k)) ?? "";
      setSelectedEvent((prev) => prev || firstNonHero);
    } catch (err) {
      console.error(err);
      setGallery({});
      setHeroGallery([]);
      setSelectedEvent("");
      setStatus("Error loading gallery");
    }
  }

  useEffect(() => {
    loadGallery();
  }, []);

  // computed helpers for UI
  const heroUrlSet = getHeroUrlSet(heroGallery);

  // Expose only non-hero keys as events (so hero images are not listed as an event/folder)
  const events = Object.keys(gallery).filter(k => !HERO_KEYS.has(k)).sort((a, b) => a.localeCompare(b));

  const safeCount = (ev) => {
    const list = gallery[ev] || [];
    return list.filter((img) => !heroUrlSet.has(getImgUrl(img))).length;
  };

  // -----------------------
  // Create folder
  // -----------------------
  async function createFolder() {
    const name = (eventName || "").trim();
    if (!name) return alert("Enter a new event name to create a folder.");
    setStatus("Creating folder...");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createEvent: true, eventName: name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create folder");

      if (body.gallery) {
        setGallery(body.gallery || {});
      } else {
        await loadGallery();
      }
      setSelectedEvent(name);
      setEventName("");
      setStatus("Folder created");
    } catch (err) {
      console.warn("createFolder fallback: ", err);
      try {
        const res2 = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: EXAMPLE_LOCAL_PATH, eventName: name, hero: false }),
        });
        const body2 = await res2.json();
        if (!res2.ok) throw new Error(body2.error || "Fallback folder creation failed");

        if (body2.gallery) {
          setGallery(body2.gallery || {});
        } else {
          await loadGallery();
        }
        setSelectedEvent(name);
        setEventName("");
        setStatus("Folder created (via example upload)");
      } catch (err2) {
        setStatus("Error creating folder: " + (err2.message || String(err)));
      }
    }
  }

  // -----------------------
  // Upload images to an event (creates event on server if missing)
  // -----------------------
  async function handleFilesUpload(e) {
    e?.preventDefault?.();
    const target = useExisting ? selectedEvent : eventName;
    if (!target) return alert("Please choose or enter an event name.");
    // validate files again before upload
    const toUpload = singleFile ? [singleFile] : files;
    if (!toUpload || toUpload.length === 0) return alert("Pick one or more images to upload.");

    const valid = toUpload.filter(isValidImageFile);
    const invalidCount = toUpload.length - valid.length;
    if (invalidCount > 0) {
      setStatus(`Rejected ${invalidCount} file(s). Allowed: ${allowedExts.join(", ")}`);
    }
    if (valid.length === 0) return alert("No valid image files to upload. Allowed types: " + allowedExts.join(", "));

    setStatus("Uploading to event...");
    try {
      const fd = new FormData();
      fd.append("eventName", target);
      fd.append("hero", "0");
      for (const f of valid) fd.append("file", f);

      const res = await fetch(API, { method: "POST", body: fd });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error || "Upload failed");

      if (body.gallery) {
        setGallery(body.gallery || {});
      } else {
        await loadGallery();
      }

      setHeroGallery(body.slider || body.home_slider || []);
      setSelectedEvent(target);

      setFiles([]);
      setSingleFile(null);
      setEventName("");
      setStatus("Uploaded successfully");
    } catch (err) {
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  // -----------------------
  // Rename event (new)
  // -----------------------
  async function renameEvent() {
    if (!selectedEvent) return alert("Select an event to rename.");
    const current = selectedEvent;
    const suggested = current.replace(/_/g, " ");
    const newNameRaw = prompt(`Rename event "${suggested}" to:`, suggested);
    if (!newNameRaw) return; // cancelled or empty
    const newName = newNameRaw.trim();
    if (!newName) return alert("Please provide a non-empty name.");

    // normalize server-side key (keep same format as other keys if desired)
    // we'll send raw newName and let server decide; locally we'll use sanitized key
    const newKey = newName.replace(/\s+/g, "_");

    setStatus("Renaming event...");
    try {
      // attempt server-side rename (server should support renameEvent)
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renameEvent: true, oldName: current, newName: newKey }),
      });
      const body = await res.json();

      if (!res.ok) {
        // server returned error — fall back to local rename with user notice
        throw new Error(body.error || "Server refused rename");
      }

      if (body.gallery) {
        setGallery(body.gallery || {});
        setSelectedEvent(newKey);
        setStatus("Renamed (server confirmed)");
        return;
      }

      // if server succeeded but didn't return updated gallery, reload
      await loadGallery();
      setSelectedEvent(newKey);
      setStatus("Renamed (server processed)");
    } catch (err) {
      // fallback: rename locally in state so UI reflects change even if server doesn't support rename
      setGallery(prev => {
        const copy = { ...prev };
        if (!copy[current]) {
          setStatus("Rename failed: current event not found locally");
          return prev;
        }
        // if newKey already exists, ask before overwriting
        if (copy[newKey]) {
          if (!confirm(`An event named "${newName}" already exists. Overwrite it locally?`)) {
            setStatus("Rename cancelled (duplicate)");
            return prev;
          }
        }
        copy[newKey] = copy[current];
        delete copy[current];
        return copy;
      });
      setSelectedEvent(newKey);
      setStatus("Renamed locally (server may not support rename)");
      console.warn("renameEvent: server rename failed or unsupported — renamed locally", err);
    }
  }

  // -----------------------
  // delete entire event (folder)
  // -----------------------
  async function handleDeleteEvent(ev) {
    if (!ev) return alert("Select an event to delete.");
    // prevent deleting hero slider via this flow
    if (HERO_KEYS.has(ev)) {
      return alert("Cannot delete the home slider here. Remove hero images from the Hero Upload section.");
    }
    if (!confirm(`Delete entire event '${ev}' and all its photos? This is irreversible.`)) return;
    setStatus("Deleting event...");
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: ev, deleteEvent: true, hero: false }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");

      if (body.gallery) {
        setGallery(body.gallery || {});
      } else {
        await loadGallery();
      }
      setHeroGallery(body.slider || body.home_slider || []);
      setSelectedEvent((prev) => (prev === ev ? (Object.keys(body.gallery || {}).find(k => !HERO_KEYS.has(k)) ?? "") : prev));
      setStatus(`Deleted ${ev}`);
    } catch (err) {
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  // -----------------------
  // delete single image (event or hero)
  // -----------------------
  async function deleteImageFromServer(event, url, opts = { hero: false }) {
    if (!url) return;
    if (!confirm("Remove this image?")) return;

    // don't allow deleting a hero url via the gallery flow
    const heroSet = getHeroUrlSet(heroGallery);
    if (!opts.hero && heroSet.has(url)) {
      return alert("This image is part of the home slider and cannot be removed from the event gallery. Remove it from the Hero Uploads section instead.");
    }

    setStatus("Removing...");
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: opts.hero ? "home_slider" : event, url, hero: !!opts.hero }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");

      if (body.gallery) {
        setGallery(body.gallery || {});
      } else {
        await loadGallery();
      }
      setHeroGallery(body.slider || body.home_slider || []);
      setStatus("Removed");
    } catch (err) {
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  // -----------------------
  // hero upload
  // -----------------------
  async function handleHeroUpload() {
    if (!heroFiles || heroFiles.length === 0) return alert("Select hero images first.");

    // validate hero files
    const validHero = heroFiles.filter(isValidImageFile);
    const invalidHeroCount = heroFiles.length - validHero.length;
    if (invalidHeroCount > 0) {
      setStatus(`Rejected ${invalidHeroCount} hero file(s). Allowed: ${allowedExts.join(", ")}`);
    }
    if (validHero.length === 0) return alert("No valid hero image files to upload. Allowed types: " + allowedExts.join(", "));

    setHeroUploading(true);
    setStatus("Uploading hero images...");
    try {
      const fd = new FormData();
      fd.append("hero", "1");
      for (const f of validHero) fd.append("file", f);

      const res = await fetch(API, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Hero upload failed");

      if (body.gallery) {
        setGallery(body.gallery || {});
      } else {
        await loadGallery();
      }
      setHeroGallery(body.slider || body.home_slider || []);
      setHeroFiles([]);
      setHeroPreview(EXAMPLE_LOCAL_PATH);
      setStatus("Hero uploaded");
    } catch (err) {
      setStatus("Error: " + (err.message || String(err)));
    } finally {
      setHeroUploading(false);
    }
  }

  function onHeroFilesChange(e) {
    const list = Array.from(e.target.files || []);
    // filter allowed
    const valid = list.filter(isValidImageFile);
    const rejected = list.length - valid.length;
    if (rejected > 0) setStatus(`Rejected ${rejected} hero file(s). Allowed: ${allowedExts.join(", ")}`);
    setHeroFiles(valid);
    if (valid.length > 0) setHeroPreview(URL.createObjectURL(valid[0]));
  }

  // Update singleFile with validation
  function onSingleFileChange(e) {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setSingleFile(null);
      return;
    }
    if (!isValidImageFile(f)) {
      setSingleFile(null);
      setStatus("Invalid file selected. Allowed types: " + allowedExts.join(", "));
      return;
    }
    setSingleFile(f);
  }

  // Update files (multiple) with validation
  function onMultipleFilesChange(e) {
    const list = Array.from(e.target.files || []);
    const valid = list.filter(isValidImageFile);
    const rejected = list.length - valid.length;
    if (rejected > 0) setStatus(`Rejected ${rejected} file(s). Allowed: ${allowedExts.join(", ")}`);
    setFiles(valid);
  }

  function handleLogout() {
    localStorage.removeItem("isAdmin");
    router.push("/admin-login");
  }

  function handleResetForm() {
    setFiles([]);
    setSingleFile(null);
    setStatus("");
  }

  // -----------------------
  // Render
  // -----------------------
  return (
    <main className="min-h-screen p-4 sm:p-8" style={{ background: "var(--background)" }}>
      <div className="max-w-7xl mx-auto bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl p-6 sm:p-8 md:p-12 shadow-xl">

        {/* header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-serif text-blue-900">Event Photos — Admin</h1>
          <div className="flex gap-2">
            <button onClick={handleLogout} className="px-3 py-2 bg-red-700 text-white rounded">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* left - form + hero card */}
          <div className="lg:col-span-2 space-y-6">

            {/* upload form */}
            <div>
              <p className="text-sm text-slate-700 mb-3">Choose or create an event and upload photos. Uploaded images create an event folder which you can open from the right.</p>

              <form onSubmit={handleFilesUpload} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={useExisting} onChange={() => setUseExisting(true)} />
                    <span>Use Existing</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={!useExisting} onChange={() => setUseExisting(false)} />
                    <span>Create New</span>
                  </label>
                </div>

                {useExisting ? (
                  <div>
                    <label className="block text-sm mb-1">Existing Event</label>
                    <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="w-full p-2 rounded border">
                      <option value="">-- Select Event --</option>
                      {events.map(ev => <option key={ev} value={ev}>{ev} ({safeCount(ev)})</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm mb-1">New Event Name</label>
                    <input value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full p-2 rounded border" placeholder="e.g. PIC_2025" />
                  </div>
                )}

                <div>
                  <label className="block text-sm mb-1 ">Single Image (optional)</label>
                  <input type="file" accept="image/*" className="border-2 border-red-900" onChange={onSingleFileChange} />
                </div>

                <div className="text-center font-bold text-red-600">OR</div>

                <div>
                  <label className="block text-sm mb-1">Select Multiple Images</label>
                  <input type="file" accept="image/*" className="border-2 border-red-800 rounded" multiple onChange={onMultipleFilesChange} />
                  <p className="text-xs mt-1">{files.length} file(s) selected</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                  <button type="button" onClick={handleFilesUpload} className="px-4 py-2 bg-blue-900 text-white rounded">Upload Event Photos</button>

                  {/* RENAME OPTION (replaces Create Folder / Upload Example Local) */}
                  <button type="button" onClick={renameEvent} className="px-4 py-2 border rounded">Rename Event</button>

                  <button type="button" onClick={handleResetForm} className="px-4 py-2 bg-white/50 rounded">Reset</button>
                </div>
              </form>

              <div className="mt-2 text-sm text-red-600">{status}</div>
            </div>

          </div>

          {/* right - folders list (events) */}
          <aside className="bg-white/10 p-4 rounded">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Events (folders)</h3>
              <button
  onClick={() => {
    if (!selectedEvent) return alert("Select an event to delete");
    handleDeleteEvent(selectedEvent);
  }}
  className="hidden md:inline-block text-m text-red-700 px-2 py-1 border rounded"
>
  Delete event
</button>

            </div>

            {/* mobile helper text */}
            <div className="block md:hidden text-sm text-slate-500 mb-2">Tap a folder to open</div>

            <div className="space-y-2 max-h-[60vh] overflow-auto ">
              {events.length === 0 && <div className="text-sm text-slate-500">No events yet</div>}

              {events.map(ev => (
                <div key={ev} className={`p-2 rounded cursor-pointer  border ${selectedEvent === ev ? "bg-indigo-600/20" : "hover:bg-white/5"}`}>
                  <div className="flex items-center justify-between">
                    <div onClick={() => setSelectedEvent(ev)} className="text-left">
                      <div className="font-medium">{ev.replace(/_/g, " ")}</div>
                      <div className="text-xs text-slate-400">{safeCount(ev)} photos</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <button onClick={() => setSelectedEvent(ev)} className="text-xs mt-1 px-2 py-1 bg-black/50 text-white rounded">Open</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* gallery section: only shows when an event is selected */}
        <section className="mt-8">
          <h3 className="text-lg font-semibold">Gallery {selectedEvent ? `— ${selectedEvent.replace(/_/g, " ")}` : ""}</h3>
          {!selectedEvent && <p className="text-sm text-slate-600">Select a folder on the right to view its photos.</p>}

          {selectedEvent && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {((gallery[selectedEvent] || []).filter(img => !heroUrlSet.has(getImgUrl(img)))).map((img, i) => {
                const url = getImgUrl(img);
                return (
                  <div key={i} className="border rounded overflow-hidden">
                    <img src={img.optimized || img.original || img.thumb} alt={`img-${i}`} className="w-full h-40 object-cover" />
                    <div className="p-2 flex items-center justify-between text-xs">
                      <a href={img.optimized || img.original} target="_blank" rel="noreferrer" className="underline">Open</a>
                      <button onClick={() => deleteImageFromServer(selectedEvent, url)} className="text-red-600 underline">Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ------------------------- HERO UPLOAD CARD ------------------------- */}

      <div className="mt-8 max-w-7xl h-full mx-auto bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h3 className="hero text-2xl font-semibold text-center mb-8">Hero Section  {`->`} Upload</h3>
        <p className="text-sm mb-3 text-slate-700">
          Images uploaded here appear <strong>ONLY on the home page hero carousel</strong>,
          and <span className="text-red-500 font-bold">will NOT appear in event galleries</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-6">

          {/* LEFT SIDE — Upload */}
          <div className="w-full sm:w-60">
            <div className="w-full h-40 bg-gray-200 border rounded overflow-hidden">
              <img src={heroPreview} className="w-full h-full object-cover" />
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-3 border text-red-900 border-red-900 rounded-md"
              onChange={onHeroFilesChange} />

            <p className="text-s mt-1">{heroFiles.length} selected</p>

            <div className="flex flex-col gap-5 mt-4">
              <button
                onClick={handleHeroUpload}
                disabled={heroUploading}
                className="px-3 py-2 bg-blue-900 text-white rounded "
              >
                {heroUploading ? "Uploading..." : "Upload to Home Carousel"}
              </button>

              <button
                onClick={() => uploadExampleLocal({ hero: true })}
                className="px-3 py-2 border rounded"
              >
                Upload Example Local
              </button>

              <button
                onClick={() => {
                  setHeroFiles([]);
                  setHeroPreview(EXAMPLE_LOCAL_PATH);
                }}
                className="px-3 py-2 bg-black/50 text-white rounded"
              >
                Reset
              </button>
            </div>
          </div>

          {/* RIGHT — Current Hero Images */}
          <div className="flex-1">
            <h4 className="text-m font-bold underline mb-2 text-red-900 text-center">Current Hero Images</h4>

            <div className="grid grid-cols-3 gap-2 ml-0">
              {heroGallery.length === 0 && (
                <div className="col-span-3 text-slate-400 text-m">No hero images yet</div>
              )}

              {heroGallery.map((h, i) => (
                <div key={i} className="border rounded overflow-hidden bg-white/10">
                  <img
                    src={h.optimized || h.original || h.thumb}
                    className="w-full h-24 object-cover"
                  />
                  <div className="p-2 flex justify-between items-center">
                    <a
                      href={h.optimized || h.original}
                      target="_blank"
                      className="text-s underline"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                    <button
                      className="text-m text-red-700 underline"
                      onClick={() =>
                        deleteImageFromServer(
                          "home_slider",
                          getImgUrl(h),
                          { hero: true }
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
