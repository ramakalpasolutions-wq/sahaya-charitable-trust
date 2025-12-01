// app/api/event-photos/route.js
/**
 * Cloudinary-enabled event-photos API for Next.js (Node server runtime).
 *
 * Notes:
 * - Primary storage: Cloudinary (recommended for serverless).
 * - Fallback local saves (only used if Cloudinary upload fails) are written to OS tmp dir,
 *   NOT to the project's /public folder (which is read-only on many serverless hosts).
 *
 * Setup:
 * 1. Install: npm i cloudinary
 * 2. Ensure env vars are set:
 *    - CLOUDINARY_CLOUD_NAME
 *    - CLOUDINARY_API_KEY
 *    - CLOUDINARY_API_SECRET
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; 
export const preferredRegion = "auto";

import fs from "fs/promises";
import path from "path";
import os from "os";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const GALLERY_FILE = path.join(DATA_DIR, "gallery.json");

// Note: we keep PUBLIC_DIR constants only for backwards compatibility when reading gallery items
// but we DON'T try to create or write into PUBLIC_DIR in serverless environments.
const PUBLIC_DIR = path.join(ROOT, "public"); // used only for path construction if needed

// Cloudinary config from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// writable tmp dir (OS-level, safe on serverless)
const TMP_DIR = path.join(os.tmpdir(), "sahaya_event_photos_tmp");

// Flag: whether public dir appears writable (best-effort). We will NOT attempt to create public/uploads automatically.
let PUBLIC_IS_WRITABLE = false;

async function ensureFiles() {
  // Always ensure data dir exists (we need gallery.json)
  await fs.mkdir(DATA_DIR, { recursive: true });

  // ensure tmp dir exists (writable on serverless)
  await fs.mkdir(TMP_DIR, { recursive: true });

  // detect whether PUBLIC_DIR is writable by trying to create a tiny dir inside it.
  // We catch errors and simply set PUBLIC_IS_WRITABLE accordingly.
  try {
    const testDir = path.join(PUBLIC_DIR, ".write_test");
    await fs.mkdir(testDir, { recursive: true });
    // cleanup
    await fs.rmdir(testDir).catch(() => {});
    PUBLIC_IS_WRITABLE = true;
  } catch (e) {
    PUBLIC_IS_WRITABLE = false;
    // don't throw — continue with tmp/cloudinary-only behavior
  }

  // ensure gallery file exists (in the data dir)
  try {
    await fs.access(GALLERY_FILE);
  } catch {
    await fs.writeFile(GALLERY_FILE, JSON.stringify({ gallery: {}, slider: [] }, null, 2), "utf8");
  }
}

async function readGallery() {
  await ensureFiles();
  const raw = await fs.readFile(GALLERY_FILE, "utf8");
  const obj = raw ? JSON.parse(raw) : {};
  const gallery = obj.gallery || (Object.keys(obj).length > 0 && !Array.isArray(obj) ? obj : {});
  const slider = obj.slider || obj.home_slider || obj.homeSlider || [];
  return { gallery, slider };
}

async function writeGallery(data) {
  await ensureFiles();
  const out = {
    gallery: data.gallery || {},
    slider: data.slider || data.home_slider || [],
    home_slider: data.slider || data.home_slider || [],
  };
  await fs.writeFile(GALLERY_FILE, JSON.stringify(out, null, 2), "utf8");
}

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

// Upload: write file into tmp then upload to Cloudinary from tmp path
async function uploadFileToCloudinary(folder, file, filename) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ensure tmp dir
  await fs.mkdir(TMP_DIR, { recursive: true });
  const tmpPath = path.join(TMP_DIR, filename);
  await fs.writeFile(tmpPath, buffer);

  try {
    const uploadOptions = {
      folder,              // cloudinary folder, e.g. "events/my_event" or "slider"
      use_filename: true,
      unique_filename: false,
      resource_type: "image",
      overwrite: false,
    };
    const res = await cloudinary.uploader.upload(tmpPath, uploadOptions);
    return res;
  } finally {
    // best-effort cleanup
    try { await fs.unlink(tmpPath).catch(() => {}); } catch (e) {}
  }
}

/**
 * Fallback: if Cloudinary upload fails, save into TMP_DIR (never attempt to write to /public by default).
 * Returns a string that may be a file:// path so it's discoverable for debugging - client should prefer Cloudinary URLs.
 */
async function saveUploadedFileLocalFallback(file, filename) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.mkdir(TMP_DIR, { recursive: true });
  const tmpPath = path.join(TMP_DIR, filename);
  await fs.writeFile(tmpPath, buffer);
  // Return a file:// url (client won't be able to display it, but it is useful for dev/debug)
  return `file://${tmpPath}`;
}

/**
 * Delete local file if it's in tmp (file://... or path under TMP_DIR). We won't try to delete files under project/public
 * in production because that directory is often read-only.
 */
async function tryDeleteLocalFileFromRel(rel) {
  if (!rel) return;
  try {
    let candidate = String(rel);
    if (candidate.startsWith("file://")) candidate = candidate.replace(/^file:\/\//, "");
    // If candidate is absolute and under TMP_DIR, attempt deletion
    if (path.resolve(candidate).startsWith(path.resolve(TMP_DIR))) {
      if ((await fs.stat(candidate).catch(() => false))) {
        await fs.unlink(candidate).catch(() => {});
      }
      return;
    }

    // If PUBLIC is writable and rel looks like a public path, attempt deletion there
    if (PUBLIC_IS_WRITABLE) {
      const relNoSlash = String(rel).replace(/^\//, "");
      const p = path.join(PUBLIC_DIR, relNoSlash);
      if ((await fs.stat(p).catch(() => false))) {
        await fs.unlink(p).catch(() => {});
      }
      return;
    }

    // otherwise do not attempt deletion (likely read-only or external URL)
    console.warn("Not deleting local file — not under tmp and public not writable:", rel);
  } catch (e) {
    console.warn("Failed to delete local file:", e);
  }
}

async function tryDeleteCloudinaryPublicId(public_id) {
  if (!public_id) return;
  try {
    const resp = await cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type: "image" });
    return resp;
  } catch (e) {
    console.warn("cloudinary destroy error:", e);
  }
}

// ---------------- GET ----------------
export async function GET() {
  try {
    const { gallery, slider } = await readGallery();
    return NextResponse.json({ gallery, slider, home_slider: slider });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ---------------- POST ----------------
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

    // multipart form uploads -> upload to Cloudinary
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
        const fname = `${Date.now()}-${(f.name || "upload").replace(/\s+/g, "_")}`;
        let uploadRes;
        try {
          uploadRes = await uploadFileToCloudinary(cloudFolder, f, fname);
        } catch (e) {
          console.warn("Cloudinary upload failed, saving to tmp as fallback:", e);
          const relLocal = await saveUploadedFileLocalFallback(f, fname);
          const objLocal = makeImageObj(relLocal);
          if (hero) {
            if (!slider.find(i => i.original === objLocal.original)) slider.push(objLocal);
          } else {
            gallery[eventName].push(objLocal);
          }
          continue;
        }

        const obj = makeImageObjFromCloudinary(uploadRes);
        if (hero) {
          if (!slider.find(i => i.original === obj.original)) slider.push(obj);
        } else {
          gallery[eventName].push(obj);
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

// ---------------- DELETE ----------------
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
            await tryDeleteCloudinaryPublicId(public_id);
          } else {
            const fileRel = String(item.original || item.optimized || item.thumb || "");
            if (!fileRel) continue;
            await tryDeleteLocalFileFromRel(fileRel);
          }
        } catch (e) {
          console.warn("Failed to delete file for event:", e);
        }
      }
      delete gallery[en];
      await writeGallery({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    if (url) {
      const targetHero = Boolean(hero);

      if (targetHero) {
        const newSlider = slider.filter(i => i.original !== url && i.optimized !== url && i.thumb !== url && i.public_id !== url);
        for (const it of slider) {
          if (it.original === url || it.optimized === url || it.thumb === url || it.public_id === url) {
            if (it.public_id) {
              await tryDeleteCloudinaryPublicId(it.public_id);
            } else {
              await tryDeleteLocalFileFromRel(it.original || it.optimized || it.thumb);
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
              await tryDeleteCloudinaryPublicId(removedObj.public_id);
            } else {
              await tryDeleteLocalFileFromRel(removedObj.original || removedObj.optimized || removedObj.thumb);
            }
          } catch (e) {
            console.warn("Failed to unlink gallery file:", e);
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