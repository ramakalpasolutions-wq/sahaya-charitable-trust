// app/api/event-photos/route.js
/**
 * Cloudinary-enabled event-photos API for Next.js (Node server runtime).
 *
 * Setup:
 * 1. Install: npm i cloudinary
 * 2. Ensure env vars are set:
 *    - CLOUDINARY_CLOUD_NAME
 *    - CLOUDINARY_API_KEY
 *    - CLOUDINARY_API_SECRET
 *
 * Behavior:
 * - Uploads go to Cloudinary (folder: events/<eventName> or slider/)
 * - gallery.json stores objects: { original: <secure_url>, optimized: <secure_url>, thumb: <secure_url>, public_id: <cloudinary id> }
 * - Delete attempts cloudinary.uploader.destroy(public_id) when available; otherwise tries to unlink local /public file.
 *
 * Note: keeps backward compatibility with existing client code which expects { gallery, slider } response shapes.
 */

import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const GALLERY_FILE = path.join(DATA_DIR, "gallery.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const EVENTS_DIR = path.join(UPLOADS_DIR, "events");
const SLIDER_DIR = path.join(UPLOADS_DIR, "slider");

// Cloudinary config from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(EVENTS_DIR, { recursive: true });
  await fs.mkdir(SLIDER_DIR, { recursive: true });
  // ensure gallery file exists
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
  // uploadResult returned by cloudinary.uploader.upload
  // store original/optimized/thumb all pointing to secure_url by default; keep public_id
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
  // preserve previous local-file shape if a local path is used
  const p = String(rel || "");
  const normalized = p.startsWith("/") ? p : `/${p}`;
  return { original: normalized, optimized: normalized, thumb: normalized };
}

// Save file to local temp then upload to Cloudinary
async function uploadFileToCloudinary(folder, file, filename) {
  // file is a File from request.formData() (Server File API)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // create a temp file path (in project) to stream to cloudinary
  const tmpDir = path.join(ROOT, "tmp_uploads");
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, filename);
  await fs.writeFile(tmpPath, buffer);

  try {
    const uploadOptions = {
      folder, // cloudinary folder
      use_filename: true,
      unique_filename: false, // keep provided filename (helps with public_id derivation)
      resource_type: "image",
      overwrite: false,
    };
    const res = await cloudinary.uploader.upload(tmpPath, uploadOptions);
    return res; // includes secure_url and public_id
  } finally {
    // cleanup local temp file (best-effort)
    try {
      await fs.unlink(tmpPath).catch(() => {});
    } catch (e) {}
  }
}

// Fallback: if user still uploads local filesystem paths (example path),
// we support saving them locally (existing behavior). This function writes buffer to folder.
async function saveUploadedFileLocal(folderDir, file, filename) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const dest = path.join(folderDir, filename);
  await fs.writeFile(dest, buffer);
  const rel = dest.startsWith(PUBLIC_DIR) ? dest.slice(PUBLIC_DIR.length).replace(/\\/g, "/") : `/uploads/${path.basename(folderDir)}/${filename}`;
  return rel.startsWith("/") ? rel : `/${rel}`;
}

async function tryDeleteLocalFileFromRel(rel) {
  if (!rel) return;
  try {
    const relNoSlash = String(rel).replace(/^\//, "");
    const p = path.join(PUBLIC_DIR, relNoSlash);
    if ((await fs.stat(p).catch(() => false))) {
      await fs.unlink(p).catch(() => {});
    }
  } catch (e) {
    console.warn("Failed to delete local file:", e);
  }
}

async function tryDeleteCloudinaryPublicId(public_id) {
  if (!public_id) return;
  try {
    // for images use resource_type: 'image'
    const resp = await cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type: "image" });
    // resp like { result: "ok" } or { result: "not found" }
    return resp;
  } catch (e) {
    console.warn("cloudinary destroy error:", e);
    // don't throw — continue
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
// Supports:
// - JSON commands: { createEvent, eventName } , { addYoutube, eventName, url }, { renameEvent, oldName, newName }
// - multipart/form-data uploads: form fields: eventName, hero (1 or "true"), files in "file"
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

      const files = form.getAll("file"); // array of File objects
      if (!files || files.length === 0) return NextResponse.json({ error: "No file" }, { status: 400 });

      if (!hero) gallery[eventName] = gallery[eventName] || [];

      // target cloudinary folder
      const cloudFolder = hero ? "slider" : `events/${eventName}`;

      for (const f of files) {
        // build filename
        const fname = `${Date.now()}-${(f.name || "upload").replace(/\s+/g, "_")}`;
        // upload to cloudinary
        let uploadRes;
        try {
          uploadRes = await uploadFileToCloudinary(cloudFolder, f, fname);
        } catch (e) {
          console.warn("Cloudinary upload failed, falling back to local save:", e);
          // fallback: save locally under public/uploads
          const targetDir = hero ? SLIDER_DIR : path.join(EVENTS_DIR, eventName);
          await fs.mkdir(targetDir, { recursive: true });
          const relLocal = await saveUploadedFileLocal(targetDir, f, fname);
          const objLocal = makeImageObj(relLocal);
          if (hero) {
            if (!slider.find(i => i.original === objLocal.original)) slider.push(objLocal);
          } else {
            gallery[eventName].push(objLocal);
          }
          continue;
        }

        // make image object for client (store cloudinary url + public_id)
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
// Accepts JSON body: { deleteEvent: true, eventName } OR { url, eventName?, hero? }
// If an item has public_id we try to destroy it in cloudinary, otherwise try unlink local file.
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
          // try Cloudinary deletion first if public_id present
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
        // remove from slider array
        const newSlider = slider.filter(i => i.original !== url && i.optimized !== url && i.thumb !== url && i.public_id !== url);
        // attempt unlink/destruction for matches
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

      // youtube link removal (objects with youtube:true and url)
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