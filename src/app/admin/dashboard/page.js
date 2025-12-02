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

  // hero card state
  const [heroFiles, setHeroFiles] = useState([]);
  const [heroPreview, setHeroPreview] = useState(EXAMPLE_LOCAL_PATH);
  const [heroUploading, setHeroUploading] = useState(false);

  // YouTube input (NEW) — accepts single or multiple URLs (newline or comma separated)
  const [youtubeUrls, setYoutubeUrls] = useState("");

  // -----------------------
  // Helpers
  // -----------------------
  function getImgUrl(img) {
    if (!img) return "";
    if (typeof img === "string") return img;
    return img.original || img.optimized || img.thumb || "";
  }

  function safeSrc(img) {
    const s = getImgUrl(img);
    return s && s.trim() !== "" ? s : null;
  }

  function getHeroUrlSet(heroArr) {
    return new Set((heroArr || []).map(getImgUrl).filter(Boolean));
  }

  const allowedExts = [];
  function isValidImageFile(file) {
    if (!file) return false;
    if (file.type && !file.type.startsWith("image/")) return false;
    const name = (file.name || "").toLowerCase();
    if (allowedExts.length === 0) return true;
    return allowedExts.some(ext => name.endsWith(ext));
  }

  const HERO_KEYS = new Set(["home_slider", "home-slider", "homeSlider"]);

  // -----------------------
  // Auth check (client)
  // -----------------------
  useEffect(() => {
    const logged = localStorage.getItem("isAdmin");
    if (!logged) router.push("/admin-login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------
  // Load gallery + slider
  // -----------------------
  async function loadGallery() {
    try {
      const res = await fetch(API);
      const text = await res.text().catch(() => "");
      let body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error("loadGallery: invalid JSON:", parseErr, text);
        setGallery({});
        setHeroGallery([]);
        setSelectedEvent("");
        setStatus("Error loading gallery: invalid server response");
        return;
      }

      if (!res.ok) {
        const errMsg = body?.error || `Failed to load gallery (status ${res.status})`;
        throw new Error(errMsg);
      }

      const galleryFromBody = body.gallery ?? body;
      const sliderFromBody = body.slider ?? body.home_slider ?? body.homeSlider ?? [];

      const finalGallery =
        body.gallery ??
        (galleryFromBody.gallery ? galleryFromBody.gallery : typeof galleryFromBody === "object" ? galleryFromBody : {});

      setGallery(finalGallery || {});
      setHeroGallery(Array.isArray(sliderFromBody) ? sliderFromBody : []);
      setSelectedEvent("");
      setStatus("");
    } catch (err) {
      console.error("loadGallery error:", err);
      setGallery({});
      setHeroGallery([]);
      setSelectedEvent("");
      setStatus("Error loading gallery: " + (err.message || String(err)));
    }
  }

  useEffect(() => {
    loadGallery();
  }, []);

  // computed helpers for UI
  const heroUrlSet = getHeroUrlSet(heroGallery);
  const events = Object.keys(gallery).filter(k => !HERO_KEYS.has(k)).sort((a, b) => a.localeCompare(b));
  const safeCount = (ev) => {
    const list = gallery[ev] || [];
    return list.filter((img) => !heroUrlSet.has(getImgUrl(img))).length;
  };

  // -----------------------
  // Cloudinary direct upload helper
  // -----------------------
  async function uploadToCloudinary(file, folder) {
    const sigRes = await fetch(`/api/upload-signature?folder=${encodeURIComponent(folder)}`);
    if (!sigRes.ok) throw new Error("Failed to get upload signature");
    const { timestamp, signature, apiKey, cloudName } = await sigRes.json();

    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", apiKey);
    fd.append("timestamp", timestamp);
    fd.append("signature", signature);
    fd.append("folder", folder);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: fd,
    });

    const json = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(json.error?.message || "Cloudinary upload failed");
    }
    return json;
  }

  // -----------------------
  // Upload images to an event (direct to Cloudinary)
  // -----------------------
  async function handleFilesUpload(e) {
    e?.preventDefault?.();
    const targetRaw = useExisting ? selectedEvent : eventName;
    const target = String(targetRaw || "").trim();
    if (!target) return alert("Please choose or enter an event name.");
    const toUpload = singleFile ? [singleFile] : files;
    if (!toUpload || toUpload.length === 0) return alert("Pick one or more images to upload.");

    const valid = toUpload.filter(isValidImageFile);
    const invalidCount = toUpload.length - valid.length;
    if (invalidCount > 0) {
      setStatus(`Rejected ${invalidCount} file(s). Allowed: ${allowedExts.join(", ") || "images"}`);
    }
    if (valid.length === 0) return alert("No valid image files to upload. Allowed types: " + (allowedExts.join(", ") || "images"));

    setStatus("Uploading to Cloudinary...");
    try {
      const uploadedItems = [];
      let i = 1;
      for (const f of valid) {
        setStatus(`Uploading ${i}/${valid.length}...`);
        const uploadRes = await uploadToCloudinary(f, `events/${target}`);
        uploadedItems.push({
          url: uploadRes.secure_url,
          public_id: uploadRes.public_id,
        });
        i++;
      }

      const metaRes = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploaded: uploadedItems, eventName: target }),
      });

      const metaBody = await metaRes.json();
      if (!metaRes.ok) throw new Error(metaBody.error || "Failed to save metadata");

      // update UI
      if (metaBody.gallery) setGallery(metaBody.gallery);
      if (metaBody.slider) setHeroGallery(metaBody.slider);
      // fallback to reload if server didn't return updated structure
      if (!metaBody.gallery && !metaBody.slider) await loadGallery();

      setSelectedEvent(target);
      setFiles([]);
      setSingleFile(null);
      setEventName("");
      setStatus("Uploaded successfully");
    } catch (err) {
      console.error("handleFilesUpload error:", err);
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  // -----------------------
  // Rename event
  // -----------------------
  async function renameEvent() {
    if (!selectedEvent) return alert("Select an event to rename.");
    const current = selectedEvent;
    const suggested = current.replace(/_/g, " ");
    const newNameRaw = prompt(`Rename event "${suggested}" to:`, suggested);
    if (!newNameRaw) return;
    const newName = newNameRaw.trim();
    if (!newName) return alert("Please provide a non-empty name.");
    const newKey = newName.replace(/\s+/g, "_");

    setStatus("Renaming event...");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renameEvent: true, oldName: current, newName: newKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Server refused rename");
      setGallery(body.gallery || (await loadGallery()) || {});
      setSelectedEvent(newKey);
      setStatus("Renamed (server confirmed)");
    } catch (err) {
      setGallery(prev => {
        const copy = { ...prev };
        if (!copy[current]) {
          setStatus("Rename failed: current event not found locally");
          return prev;
        }
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
    if (HERO_KEYS.has(ev)) {
      return alert("Cannot delete the home slider here. Remove hero images from the Hero Uploads section.");
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
      setGallery(body.gallery || (await loadGallery()) || {});
      setHeroGallery(body.slider || body.home_slider || []);
      setSelectedEvent("");
      setStatus(`Deleted ${ev}`);
    } catch (err) {
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  // -----------------------
  // delete single image (event or hero) or a youtube link (url)
  // -----------------------
  async function deleteImageFromServer(event, url, opts = { hero: false }) {
    let targetUrl = (typeof url === "string" && url.trim()) ? url : null;

    if (!targetUrl && event && gallery[event] && Array.isArray(gallery[event])) {
      for (const it of gallery[event]) {
        const u = getImgUrl(it);
        if (u) {
          targetUrl = u;
          break;
        }
        if (it && it.url) {
          targetUrl = it.url;
          break;
        }
      }
    }

    if (!targetUrl && (opts.hero || event === "home_slider" || event === "homeSlider" || event === "home-slider")) {
      for (const it of heroGallery || []) {
        const u = getImgUrl(it);
        if (u) {
          targetUrl = u;
          break;
        }
        if (it && it.url) {
          targetUrl = it.url;
          break;
        }
      }
    }

    if (!targetUrl) {
      console.warn("deleteImageFromServer: no URL found. event:", event);
      return alert("No image URL provided to delete. (See console for details.)");
    }

    if (!confirm("Remove this image / link?")) return;

    setStatus("Removing...");
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: opts.hero ? "home_slider" : event, url: targetUrl, hero: !!opts.hero }),
      });

      const text = await res.text().catch(() => "");
      let body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error("deleteImageFromServer: invalid JSON response from DELETE", text);
        throw new Error("Invalid server response");
      }

      if (!res.ok) throw new Error(body?.error || `Delete failed (status ${res.status})`);

      setGallery(body.gallery || (await loadGallery()) || {});
      setHeroGallery(body.slider || body.home_slider || []);
      setStatus("Removed");
    } catch (err) {
      console.error("deleteImageFromServer error:", err);
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  // -----------------------
  // hero upload (direct to Cloudinary)
  // -----------------------
  async function handleHeroUpload() {
    if (!heroFiles || heroFiles.length === 0) return alert("Select hero images first.");
    const validHero = heroFiles.filter(isValidImageFile);
    const invalidHeroCount = heroFiles.length - validHero.length;
    if (invalidHeroCount > 0) {
      setStatus(`Rejected ${invalidHeroCount} hero file(s). Allowed: ${allowedExts.join(", ") || "images"}`);
    }
    if (validHero.length === 0) return alert("No valid hero image files to upload.");
    setHeroUploading(true);
    setStatus("Uploading hero images...");
    try {
      const uploaded = [];
      let i = 1;
      for (const f of validHero) {
        setStatus(`Uploading hero ${i}/${validHero.length}...`);
        const uploadRes = await uploadToCloudinary(f, `slider`);
        uploaded.push({ url: uploadRes.secure_url, public_id: uploadRes.public_id });
        i++;
      }

      // send batch metadata to API (we'll use uploaded array shape and hero:true)
      const metaRes = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploaded, hero: true, eventName: "home_slider" }),
      });

      // defensive parse
      let metaBody = {};
      try {
        metaBody = await metaRes.json();
      } catch (e) {
        // if server returned non-json, reload
        console.warn("handleHeroUpload: non-JSON response, reloading gallery", e);
        await loadGallery();
        setHeroFiles([]);
        setHeroPreview(EXAMPLE_LOCAL_PATH);
        setStatus("Hero uploaded (server returned non-JSON)");
        return;
      }

      if (!metaRes.ok) throw new Error(metaBody.error || "Hero metadata save failed");

      // Prefer server returned slider and gallery; fallback to reloading
      if (metaBody.slider || metaBody.home_slider) {
        setHeroGallery(metaBody.slider || metaBody.home_slider || []);
      } else {
        // if server returned gallery only, update that and reload slider
        setGallery(metaBody.gallery || gallery);
        // refresh whole gallery to be safe
        await loadGallery();
      }

      setHeroFiles([]);
      setHeroPreview(EXAMPLE_LOCAL_PATH);
      setStatus("Hero uploaded");
    } catch (err) {
      console.error("handleHeroUpload error:", err);
      setStatus("Error: " + (err.message || String(err)));
    } finally {
      setHeroUploading(false);
    }
  }

  function onHeroFilesChange(e) {
    const list = Array.from(e.target.files || []);
    const valid = list.filter(isValidImageFile);
    const rejected = list.length - valid.length;
    if (rejected > 0) setStatus(`Rejected ${rejected} hero file(s). Allowed: ${allowedExts.join(", ") || "images"}`);
    setHeroFiles(valid);
    if (valid.length > 0) setHeroPreview(URL.createObjectURL(valid[0]));
  }

  function onSingleFileChange(e) {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setSingleFile(null);
      return;
    }
    if (!isValidImageFile(f)) {
      setSingleFile(null);
      setStatus("Invalid file selected. Allowed types: " + (allowedExts.join(", ") || "images"));
      return;
    }
    setSingleFile(f);
  }

  function onMultipleFilesChange(e) {
    const list = Array.from(e.target.files || []);
    const valid = list.filter(isValidImageFile);
    const rejected = list.length - valid.length;
    if (rejected > 0) setStatus(`Rejected ${rejected} file(s). Allowed: ${allowedExts.join(", ") || "images"}`);
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
  // Add YouTube folder/link (supports multiple URLs now)
  // -----------------------
  async function addYoutubeFolder() {
    const nameRaw = (eventName || selectedEvent || "youtube").trim();
    if (!nameRaw) return alert("Provide a folder name (event name) or select an event.");
    const en = nameRaw;

    const rawInput = (youtubeUrls || "").trim();
    let urls = [];
    if (rawInput) {
      urls = rawInput
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    if (urls.length === 0) {
      const single = (prompt("Paste the YouTube URL to add as an embedded item:") || "").trim();
      if (!single) return alert("No URL provided.");
      urls = [single];
    }

    setStatus(`Adding ${urls.length} YouTube link${urls.length !== 1 ? "s" : ""} to "${en}"...`);

    const failures = [];
    let lastBody = null;

    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      try {
        const payload = { addYoutube: true, eventName: en, url: u };
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const text = await res.text().catch(() => "");
        let body;
        try {
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          throw new Error("Invalid server response: " + (text ? text.slice(0, 200) : "empty"));
        }

        if (!res.ok) {
          throw new Error(body?.error || `Failed to add URL (status ${res.status})`);
        }

        lastBody = body;
        setStatus(`Added ${i + 1}/${urls.length}`);
      } catch (err) {
        console.error("addYoutubeFolder (per-url) error for", u, err);
        failures.push({ url: u, message: err.message || String(err) });
      }
    }

    try {
      if (lastBody) {
        const newGallery = lastBody.gallery ?? lastBody ?? {};
        setGallery(newGallery);
        setHeroGallery(lastBody.slider ?? lastBody.home_slider ?? heroGallery);
      } else {
        await loadGallery();
      }
    } catch (e) {
      console.warn("addYoutubeFolder: failed to update gallery after posts:", e);
    }

    if (failures.length === 0) {
      setStatus("YouTube link(s) added");
      setEventName("");
      setYoutubeUrls("");
    } else {
      setStatus(`Added ${urls.length - failures.length}/${urls.length} — ${failures.length} failed`);
      alert(
        `Some URLs failed to add:\n\n${failures
          .map(f => `${f.url} → ${f.message}`)
          .join("\n")}\n\nCheck console/network for details.`
      );
    }
  }

  // -----------------------
  // YouTube helpers
  // -----------------------
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
      const m = url.match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : null;
    }
  }

  function youtubeThumbUrl(url) {
    const id = parseYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }

  function isYoutubeFolder(ev) {
    const items = gallery[ev];
    return Array.isArray(items) && items.length > 0 && items[0]?.youtube === true;
  }

  function youTubeEmbedSrc(url) {
    const id = parseYouTubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  const youtubeFolders = Object.entries(gallery)
    .filter(([k, items]) => Array.isArray(items) && items.length > 0 && items[0]?.youtube === true);

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
                  <input type="file" accept="image/*" className="border-2 border-blue-900" onChange={onSingleFileChange} />
                </div>

                <div className="text-center font-bold text-red-600">OR</div>

                <div>
                  <label className="block text-sm mb-1">Select Multiple Images</label>
                  <input type="file" accept="image/*" className="border-2 border-blue-800 rounded" multiple onChange={onMultipleFilesChange} />
                  <p className="text-xs mt-1">{files.length} file(s) selected</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                  <button type="button" onClick={handleFilesUpload} className="px-4 py-2 bg-blue-900 text-white rounded">Upload Event Photos</button>

                  {/* RENAME OPTION */}
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
            <>
              {isYoutubeFolder(selectedEvent) ? (
                // ---- YouTube folder view (embedded players) ----
                <div className="mt-4 space-y-4">
                  <div className="text-sm text-slate-600 mb-2">This folder contains YouTube link(s). Videos open here (gallery view).</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(gallery[selectedEvent] || []).map((item, i) => {
                      const url = item?.url || "";
                      const embed = youTubeEmbedSrc(url);
                      const title = item?.title || `Video ${i + 1}`;
                      return (
                        <div key={i} className="border rounded overflow-hidden bg-black/5 p-2">
                          <div className="font-medium mb-2">{title}</div>
                          {embed ? (
                            <div className="relative" style={{ paddingTop: "56.25%" }}>
                              <iframe
                                src={embed}
                                title={title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full border-0"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-sm text-slate-600">Invalid YouTube URL</div>
                          )}

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <a href={url} target="_blank" rel="noreferrer" className="underline">Open on YouTube</a>
                            <button
                              onClick={() => deleteImageFromServer(selectedEvent, url)}
                              className="text-red-600 underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // ---- Regular image grid (original behavior) ----
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {((gallery[selectedEvent] || []).filter(img => !heroUrlSet.has(getImgUrl(img)))).map((img, i) => {
                    const src = safeSrc(img);
                    const url = getImgUrl(img);
                    return (
                      <div key={i} className="border rounded overflow-hidden">
                        {src ? (
                          <img src={src} alt={`img-${i}`} className="w-full h-40 object-cover" />
                        ) : (
                          <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-sm text-slate-600">No preview</div>
                        )}
                        <div className="p-2 flex items-center justify-between text-xs">
                          {src ? (
                            <a href={src} target="_blank" rel="noreferrer" className="underline">Open</a>
                          ) : (
                            <a href={url || "#"} target="_blank" rel="noreferrer" className="underline">Open</a>
                          )}
                          <button onClick={() => deleteImageFromServer(selectedEvent, url)} className="text-red-600 underline">Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
              {heroPreview ? (
                <img src={heroPreview} className="w-full h-full object-cover" alt="hero preview" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-600">No preview</div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-3 border text-red-900 border-red-900 rounded-md hover:cursor-pointer"
              onChange={onHeroFilesChange} />

            <p className="text-s mt-1">{heroFiles.length} selected</p>

            <div className="flex flex-row gap-5 mt-4">
              <button
                onClick={handleHeroUpload}
                disabled={heroUploading}
                className="px-3 py-2 bg-blue-900 text-white rounded hover:cursor-pointer"
              >
                {heroUploading ? "Uploading..." : "Upload to Home Carousel"}
              </button>

              <button
                onClick={() => {
                  setHeroFiles([]);
                  setHeroPreview(EXAMPLE_LOCAL_PATH);
                }}
                className="px-3 py-2 bg-black/50 text-white rounded hover:cursor-pointer"
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

              {heroGallery.map((h, i) => {
                const src = safeSrc(h);
                const url = getImgUrl(h);
                return (
                  <div key={i} className="border rounded overflow-hidden bg-white/10">
                    {src ? (
                      <img src={src} className="w-full h-24 object-cover" alt={`hero-${i}`} />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-sm text-slate-600">No preview</div>
                    )}
                    <div className="p-2 flex justify-between items-center">
                      {src ? (
                        <a href={src} target="_blank" className="text-s underline" rel="noreferrer">Open</a>
                      ) : (
                        <a href={url || "#"} target="_blank" className="text-s underline" rel="noreferrer">Open</a>
                      )}
                      <button
                        className="text-m text-red-700 underline hover:cursor-pointer"
                        onClick={() =>
                          deleteImageFromServer(
                            "home_slider",
                            url,
                            { hero: true }
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* YouTube card (unchanged) */}
      <div className="mt-8 max-w-7xl h-full mx-auto bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="mt-8 p-4 border rounded bg-white/5">
          <h3 className="text-xl font-semibold mb-2">YouTube Thumbnails (Dashboard)</h3>
          <p className="text-sm mb-3">Create or manage YouTube links used on the home page. Use <strong>Add YouTube</strong> to attach a YouTube link to a folder (creates folder if needed). You can paste multiple URLs (newline or comma separated) into the box below.</p>

          <div className="flex gap-2 mb-4">
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Folder name (or select an event)" className="flex-1 p-2 border rounded" />
            <button onClick={addYoutubeFolder} className="px-3 py-2 bg-blue-900 text-white rounded">Add YouTube</button>
            <button onClick={() => { setEventName(""); setStatus(""); setYoutubeUrls(""); }} className="px-3 py-2 border rounded">Clear</button>
          </div>

          <label className="block text-xs text-slate-500 mb-1">Paste one or more YouTube URLs (newline or comma separated):</label>
          <textarea
            value={youtubeUrls}
            onChange={(e) => setYoutubeUrls(e.target.value)}
            placeholder="https://youtu.be/abc..., https://www.youtube.com/watch?v=xyz..."
            className="w-full p-2 border rounded resize-y mb-4 min-h-[80px]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {youtubeFolders.length === 0 && <div className="text-sm text-slate-500 col-span-3">No YouTube links yet</div>}

            {youtubeFolders.map(([folder, items]) => {
              const url = items?.[0]?.url || "";
              const thumb = youtubeThumbUrl(url);
              return (
                <div key={folder} className="p-3 border rounded bg-white/10">
                  <div className="font-medium mb-1">{folder.replace(/_/g, " ")}</div>
                  <div className="h-40 mb-2">
                    {thumb ? (
                      <img src={thumb} alt={`yt-${folder}`} className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-sm text-slate-600">No thumbnail</div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-between items-center">
                    <a href={url} target="_blank" rel="noreferrer" className="px-3 py-1 bg-blue-900 text-white rounded text-sm">Open Link</a>
                    <button onClick={() => deleteImageFromServer(folder, url)} className="px-3 py-1 border rounded text-red-600 text-sm">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
