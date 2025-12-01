// src/app/api/event-photos/route.js
/**
 * Cloudinary-backed event-photos API (Vercel-safe).
 * - Stores gallery metadata in Cloudinary as a raw file (gallery.json)
 * - Uploads images directly from request buffers (no local files)
 *
 * Env required:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import stream from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// THE public_id where gallery.json will be stored in Cloudinary (folder + id)
const GALLERY_PUBLIC_ID = "metadata/versatileservicestrust_gallery"; // folder: metadata, public_id: versatileservicestrust_gallery
const GALLERY_RESOURCE_TYPE = "raw";

// Helper: upload a Buffer to Cloudinary (works for images and raw files)
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
    const passthrough = new stream.PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });
}

// Read gallery.json from Cloudinary (returns { gallery: {}, slider: [] })
async function readGalleryFromCloudinary() {
  try {
    // Check if resource exists
    const resource = await cloudinary.api.resource(GALLERY_PUBLIC_ID, { resource_type: GALLERY_RESOURCE_TYPE });
    if (!resource || !resource.secure_url) {
      // fallback default
      return { gallery: {}, slider: [] };
    }
    // Fetch the raw file content via secure URL
    const res = await fetch(resource.secure_url);
    if (!res.ok) return { gallery: {}, slider: [] };
    const jsonText = await res.text();
    let parsed = {};
    try {
      parsed = JSON.parse(jsonText || "{}");
    } catch (e) {
      parsed = {};
    }
    const gallery = parsed.gallery || (Object.keys(parsed).length > 0 && !Array.isArray(parsed) ? parsed : {});
    const slider = parsed.slider || parsed.home_slider || parsed.homeSlider || [];
    return { gallery, slider };
  } catch (e) {
    // resource not found or other error -> return default
    return { gallery: {}, slider: [] };
  }
}

// Write gallery object to Cloudinary (overwrites raw file)
async function writeGalleryToCloudinary(data) {
  const out = {
    gallery: data.gallery || {},
    slider: data.slider || data.home_slider || [],
    home_slider: data.slider || data.home_slider || [],
  };
  const buffer = Buffer.from(JSON.stringify(out, null, 2), "utf8");
  const options = {
    public_id: GALLERY_PUBLIC_ID,
    resource_type: GALLERY_RESOURCE_TYPE,
    overwrite: true,
    folder: "", // public_id already contains folder
  };
  // uploadBufferToCloudinary will stream and replace the raw file
  const resp = await uploadBufferToCloudinary(buffer, options);
  return resp;
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

// Upload image file buffer (File object from formData) directly to Cloudinary images
async function uploadImageFromFile(file, folder, filename) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const options = {
    folder,
    use_filename: true,
    unique_filename: false,
    resource_type: "image",
    overwrite: false,
    public_id: filename.replace(/\.[^/.]+$/, ""), // remove extension from public_id to keep deterministic
  };
  const res = await uploadBufferToCloudinary(buffer, options);
  return res;
}

// Try to destroy Cloudinary public_id
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
    const { gallery, slider } = await readGalleryFromCloudinary();
    return NextResponse.json({ gallery, slider, home_slider: slider });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ---------------- POST ----------------
// Supports JSON commands and multipart/form-data for uploads
export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const { gallery, slider } = await readGalleryFromCloudinary();

    // JSON commands
    if (contentType.includes("application/json")) {
      const body = await req.json();

      if (body.createEvent) {
        const name = sanitizeName(body.eventName || "");
        if (!name) return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
        gallery[name] = gallery[name] || [];
        await writeGalleryToCloudinary({ gallery, slider });
        return NextResponse.json({ ok: true, gallery, slider });
      }

      if (body.addYoutube && body.url) {
        const en = sanitizeName(body.eventName || "youtube");
        gallery[en] = gallery[en] || [];
        const item = { youtube: true, url: body.url };
        if (!gallery[en].some(i => i.youtube === true && i.url === body.url)) gallery[en].push(item);
        await writeGalleryToCloudinary({ gallery, slider });
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
        await writeGalleryToCloudinary({ gallery, slider });
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

      // cloud folder target
      const cloudFolder = hero ? "slider" : `events/${eventName}`;

      for (const f of files) {
        const fname = `${Date.now()}-${(f.name || "upload").replace(/\s+/g, "_")}`;
        let uploadRes;
        try {
          uploadRes = await uploadImageFromFile(f, cloudFolder, fname);
        } catch (e) {
          console.warn("Cloudinary upload failed for file:", e);
          // if upload fails, skip this file and continue (no local fallback)
          continue;
        }
        const obj = makeImageObjFromCloudinary(uploadRes);
        if (hero) {
          if (!slider.find(i => i.original === obj.original)) slider.push(obj);
        } else {
          gallery[eventName].push(obj);
        }
      }

      await writeGalleryToCloudinary({ gallery, slider });
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
    const { gallery, slider } = await readGalleryFromCloudinary();

    const { deleteEvent, eventName, url, hero } = body;

    if (deleteEvent && eventName) {
      const en = sanitizeName(eventName);
      const list = gallery[en] || [];
      for (const item of list) {
        try {
          const public_id = item.public_id || null;
          if (public_id) {
            // public_id may include folder prefix if returned by Cloudinary
            await tryDeleteCloudinaryPublicId(public_id);
          }
        } catch (e) {
          console.warn("Failed to delete file for event:", e);
        }
      }
      delete gallery[en];
      await writeGalleryToCloudinary({ gallery, slider });
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
            }
          }
        }
        await writeGalleryToCloudinary({ gallery, slider: newSlider });
        return NextResponse.json({ ok: true, gallery, slider: newSlider });
      }

      // youtube link removal
      for (const en of Object.keys(gallery)) {
        const arr = gallery[en];
        const idxY = arr.findIndex(i => i && i.youtube === true && i.url === url);
        if (idxY >= 0) {
          arr.splice(idxY, 1);
          await writeGalleryToCloudinary({ gallery, slider });
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
            }
          } catch (e) {
            console.warn("Failed to delete cloudinary object:", e);
          }
          break;
        }
      }

      await writeGalleryToCloudinary({ gallery, slider });
      if (!removed) return NextResponse.json({ error: "Image not found" }, { status: 404 });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
  } catch (err) {
    console.error("DELETE /api/event-photos error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
