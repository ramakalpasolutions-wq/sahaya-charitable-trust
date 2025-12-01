// src/app/api/event-photos/route.js
/**
 * Serverless-friendly event-photos API using Cloudinary for storage + metadata (raw).
 *
 * - Image uploads -> Cloudinary (folder: events/<eventName> or slider)
 * - Metadata (gallery.json) -> stored as Cloudinary raw with public_id = "sahaya_gallery_raw"
 * - No writes under /var/task or project files (safe for Vercel/Lambda)
 *
 * Requirements:
 *  - npm i cloudinary
 *  - Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

const CLOUD_GALLERY_PUBLIC_ID = "sahaya_gallery_raw"; // cloudinary raw id for gallery JSON
const CACHE_TTL_MS = 3000; // short cache for reads

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// in-memory cache
let _cachedGallery = null;
let _cachedAt = 0;

function sanitizeName(n = "") {
  return String(n).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "_");
}

function makeImageObjFromCloudinary(uploadResult) {
  const secure = uploadResult.secure_url || uploadResult.url || "";
  const public_id = uploadResult.public_id || "";
  return {
    original: secure,
    optimized: secure,
    thumb: secure,
    public_id,
  };
}

function makeImageObj(rel) {
  const p = String(rel || "");
  const normalized = p.startsWith("/") ? p : `/${p}`;
  return { original: normalized, optimized: normalized, thumb: normalized };
}

// helper: upload buffer to cloudinary using upload_stream
async function uploadBufferToCloudinary(folder, buffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      use_filename: true,
      unique_filename: false,
      resource_type: "image",
      overwrite: false,
    };
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    const readable = Readable.from(buffer);
    readable.pipe(stream);
  });
}

// ----------------- Cloudinary raw gallery helpers -----------------

async function ensureGalleryExistsInCloudinary() {
  // only if cloudinary configured
  if (!cloudinary.config().cloud_name || !cloudinary.config().api_key || !cloudinary.config().api_secret) return;
  try {
    // check resource
    await cloudinary.api.resource(CLOUD_GALLERY_PUBLIC_ID, { resource_type: "raw" });
    return;
  } catch (err) {
    // if not found, upload initial empty JSON as raw
    const msg = String(err?.message || err).toLowerCase();
    const notFound = msg.includes("not found") || (err && err.http_code === 404);
    if (notFound) {
      const init = Buffer.from(JSON.stringify({ gallery: {}, slider: [] }, null, 2), "utf8");
      await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ public_id: CLOUD_GALLERY_PUBLIC_ID, resource_type: "raw", overwrite: true }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        stream.end(init);
      }).catch(e => {
        console.warn("Failed to create initial gallery raw:", e);
      });
    } else {
      // other error — log and continue, readGallery will fallback
      console.warn("ensureGalleryExistsInCloudinary warning:", err && (err.message || err));
    }
  }
}

async function readGallery() {
  // cache short-circuit
  if (_cachedGallery && Date.now() - _cachedAt < CACHE_TTL_MS) return _cachedGallery;

  // attempt to read from Cloudinary raw if configured
  const cfgPresent = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (cfgPresent) {
    try {
      await ensureGalleryExistsInCloudinary();
      const meta = await cloudinary.api.resource(CLOUD_GALLERY_PUBLIC_ID, { resource_type: "raw" });
      const url = meta.secure_url || meta.url;
      if (url) {
        // use global fetch (Next.js runtime provides fetch); fallback to throwing if not present
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch gallery.json from Cloudinary");
        const text = await response.text();
        const obj = text ? JSON.parse(text) : {};
        const gallery = obj.gallery || (Object.keys(obj).length > 0 && !Array.isArray(obj) ? obj : {});
        const slider = obj.slider || obj.home_slider || obj.homeSlider || [];
        const out = { gallery, slider };
        _cachedGallery = out;
        _cachedAt = Date.now();
        return out;
      }
    } catch (e) {
      console.warn("readGallery: Cloudinary read failed, falling back to empty in-memory gallery. error:", e && (e.message || e));
    }
  }

  // fallback: in-memory empty
  const fallback = { gallery: {}, slider: [] };
  _cachedGallery = fallback;
  _cachedAt = Date.now();
  return fallback;
}

async function writeGallery(data) {
  const out = {
    gallery: data.gallery || {},
    slider: data.slider || data.home_slider || [],
    home_slider: data.slider || data.home_slider || [],
  };
  // update cache immediately
  _cachedGallery = { gallery: out.gallery, slider: out.slider };
  _cachedAt = Date.now();

  // attempt to persist to Cloudinary raw if configured
  const cfgPresent = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (!cfgPresent) return;

  try {
    const jsonBuf = Buffer.from(JSON.stringify({ gallery: out.gallery, slider: out.slider, home_slider: out.slider }, null, 2), "utf8");
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ public_id: CLOUD_GALLERY_PUBLIC_ID, resource_type: "raw", overwrite: true }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      stream.end(jsonBuf);
    });
  } catch (e) {
    console.warn("writeGallery: failed to write to Cloudinary raw — cache updated only. error:", e && (e.message || e));
  }
}

// ----------------- API Handlers -----------------

// GET
export async function GET() {
  try {
    const { gallery, slider } = await readGallery();
    return NextResponse.json({ gallery, slider, home_slider: slider });
  } catch (err) {
    console.error("GET /api/event-photos error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST - handles JSON commands and multipart uploads
export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const { gallery, slider } = await readGallery();

    // JSON commands
    if (contentType.includes("application/json")) {
      const body = await req.json();

      if (body.createEvent) {
        const name = sanitizeName(body.eventName || "");
        if (!name) return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
        gallery[name] = gallery[name] || [];
        await writeGallery({ gallery, slider });
        return NextResponse.json({ ok: true, gallery, slider });
      }

      if (body.addYoutube && body.url) {
        const en = sanitizeName(body.eventName || "youtube");
        gallery[en] = gallery[en] || [];
        const item = { youtube: true, url: body.url };
        if (!gallery[en].some(i => i.youtube === true && i.url === body.url)) gallery[en].push(item);
        await writeGallery({ gallery, slider });
        return NextResponse.json({ ok: true, gallery, slider });
      }

      if (body.renameEvent || (body.oldName && body.newName)) {
        const oldName = sanitizeName(body.oldName || body.oldname || "");
        const newName = sanitizeName(body.newName || body.newname || "");
        if (!oldName || !newName) return NextResponse.json({ error: "Missing names" }, { status: 400 });
        gallery[newName] = gallery[newName] || [];
        if (gallery[oldName]) {
          gallery[newName] = gallery[newName].concat(gallery[oldName]);
          delete gallery[oldName];
        }
        await writeGallery({ gallery, slider });
        return NextResponse.json({ ok: true, gallery, slider });
      }

      return NextResponse.json({ error: "Unsupported JSON command" }, { status: 400 });
    }

    // multipart/form-data -> upload to Cloudinary
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const hero = (form.get("hero") === "1" || form.get("hero") === "true");
      const rawEvent = String(form.get("eventName") || form.get("eventname") || form.get("event") || "");
      const eventName = hero ? "home_slider" : sanitizeName(rawEvent || "default_event");

      const files = form.getAll("file");
      if (!files || files.length === 0) return NextResponse.json({ error: "No file" }, { status: 400 });

      if (!hero) gallery[eventName] = gallery[eventName] || [];

      const cloudFolder = hero ? "slider" : `events/${eventName}`;

      for (const f of files) {
        // f is a File object (Server File API). Read as arrayBuffer and upload directly.
        const arrayBuffer = await f.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fname = `${Date.now()}-${(f.name || "upload").replace(/\s+/g, "_")}`;

        try {
          const uploadRes = await uploadBufferToCloudinary(cloudFolder, buffer, fname);
          const obj = makeImageObjFromCloudinary(uploadRes);
          if (hero) {
            if (!slider.find(i => i.original === obj.original)) slider.push(obj);
          } else {
            gallery[eventName].push(obj);
          }
        } catch (e) {
          console.error("Cloudinary upload failed for file:", fname, e && (e.message || e));
          // If upload fails, we still continue — client will be informed by returned state.
          // We do not persist files locally (serverless-safe). Consider retrying from client or uploading directly to Cloudinary.
        }
      }

      await writeGallery({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/event-photos error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req) {
  try {
    const body = await req.json();
    const { gallery, slider } = await readGallery();

    const { deleteEvent, eventName, url, hero } = body;

    if (deleteEvent && eventName) {
      const en = sanitizeName(eventName);
      const list = gallery[en] || [];
      for (const item of list) {
        try {
          const public_id = item.public_id || null;
          if (public_id) {
            await cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type: "image" }).catch(() => {});
          } else {
            // nothing to delete (no local files in serverless)
          }
        } catch (e) {
          console.warn("Failed to delete file for event:", e && (e.message || e));
        }
      }
      delete gallery[en];
      await writeGallery({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    if (url) {
      const targetHero = Boolean(hero);

      if (targetHero) {
        // remove from slider array
        const newSlider = slider.filter(i => i.original !== url && i.optimized !== url && i.thumb !== url && i.public_id !== url);
        // attempt destroy for matches
        for (const it of slider) {
          if (it.original === url || it.optimized === url || it.thumb === url || it.public_id === url) {
            if (it.public_id) {
              await cloudinary.uploader.destroy(it.public_id, { invalidate: true, resource_type: "image" }).catch(() => {});
            }
          }
        }
        await writeGallery({ gallery, slider: newSlider });
        return NextResponse.json({ ok: true, gallery, slider: newSlider });
      }

      // youtube link removal
      for (const en of Object.keys(gallery)) {
        const arr = gallery[en];
        const idxY = arr.findIndex(i => i && i.youtube === true && i.url === url);
        if (idxY >= 0) {
          arr.splice(idxY, 1);
          await writeGallery({ gallery, slider });
          return NextResponse.json({ ok: true, gallery, slider });
        }
      }

      // normal image removal
      let removed = false;
      for (const en of Object.keys(gallery)) {
        const arr = gallery[en];
        const idx = arr.findIndex(i => i.original === url || i.optimized === url || i.thumb === url || i.public_id === url);
        if (idx >= 0) {
          const [removedObj] = arr.splice(idx, 1);
          removed = true;
          try {
            if (removedObj.public_id) {
              await cloudinary.uploader.destroy(removedObj.public_id, { invalidate: true, resource_type: "image" }).catch(() => {});
            }
          } catch (e) {
            console.warn("Failed to destroy cloudinary file:", e && (e.message || e));
          }
          break;
        }
      }

      await writeGallery({ gallery, slider });
      if (!removed) return NextResponse.json({ error: "Image not found" }, { status: 404 });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
  } catch (err) {
    console.error("DELETE /api/event-photos error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}