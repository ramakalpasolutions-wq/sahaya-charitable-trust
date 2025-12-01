// app/api/event-photos/route.js
/**
 * Cloudinary-only event-photos API for Next.js (Node server runtime).
 *
 * Behavior:
 * - ALWAYS uploads to Cloudinary (no local /public writes).
 * - Stores objects in data/gallery.json with { original, optimized, thumb, public_id }.
 * - Deletes use Cloudinary public_id.
 *
 * Setup:
 * 1. npm i cloudinary
 * 2. Set env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const GALLERY_FILE = path.join(DATA_DIR, "gallery.json");

// cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(GALLERY_FILE);
  } catch {
    await fs.writeFile(GALLERY_FILE, JSON.stringify({ gallery: {}, slider: [] }, null, 2), "utf8");
  }
}

async function readGallery() {
  await ensureDataFile();
  const raw = await fs.readFile(GALLERY_FILE, "utf8");
  const obj = raw ? JSON.parse(raw) : {};
  const gallery = obj.gallery || (Object.keys(obj).length > 0 && !Array.isArray(obj) ? obj : {});
  const slider = obj.slider || obj.home_slider || obj.homeSlider || [];
  return { gallery, slider };
}

async function writeGallery(data) {
  await ensureDataFile();
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

// Upload using a data URI (no temp files). `file` is the File object from formData.
async function uploadFileToCloudinary(folder, file, filename) {
  // read file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // determine mime type (fallback)
  const mime = (file.type && String(file.type).trim()) || "image/png";

  // build data URI
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${base64}`;

  // upload
  const uploadOptions = {
    folder,
    use_filename: true,
    unique_filename: false,
    resource_type: "image",
    overwrite: false,
    public_id: filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, ""), // prefer filename as public_id (without ext)
  };

  const res = await cloudinary.uploader.upload(dataUri, uploadOptions);
  return res;
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
// Supports JSON commands and multipart uploads (field "file").
export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const { gallery, slider } = await readGallery();

    // JSON commands (createEvent, addYoutube, renameEvent)
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

    // multipart form uploads -> Cloudinary only
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

        // upload to cloudinary; if this fails we surface an error
        let uploadRes;
        try {
          uploadRes = await uploadFileToCloudinary(cloudFolder, f, fname);
        } catch (e) {
          console.error("Cloudinary upload error:", e);
          return NextResponse.json({ error: "Cloudinary upload failed", details: String(e) }, { status: 500 });
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
// Accepts JSON body: { deleteEvent: true, eventName } OR { url, eventName?, hero? }
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
            await cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type: "image" });
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
              await cloudinary.uploader.destroy(it.public_id, { invalidate: true, resource_type: "image" });
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
              await cloudinary.uploader.destroy(removedObj.public_id, { invalidate: true, resource_type: "image" });
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