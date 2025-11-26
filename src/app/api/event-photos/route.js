import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import fs from "fs/promises";
import path from "path";

// ----------------------
// Cloudinary Config
// ----------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------------
// Local JSON Storage
// ----------------------
const DATA_DIR = path.join(process.cwd(), "data");
const GALLERY_FILE = path.join(DATA_DIR, "gallery.json");

// Example file path (DO NOT CHANGE — per your requirement)
const SEED_EXAMPLE = "/mnt/data/caaf9965-4a8f-47cf-b417-aa7208ce3578.png";

// Key for HERO slider
const SLIDER_KEY = "home_slider";

// ----------------------
// File Initialization
// ----------------------
async function ensureGalleryFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(GALLERY_FILE);
  } catch {
    const seed = {
      Example_Event: [
        {
          original: SEED_EXAMPLE,
          optimized: SEED_EXAMPLE,
          thumb: SEED_EXAMPLE,
        },
      ],
      [SLIDER_KEY]: [] // HERO SLIDER bucket
    };
    await fs.writeFile(GALLERY_FILE, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readGalleryRaw() {
  await ensureGalleryFile();
  const raw = await fs.readFile(GALLERY_FILE, "utf8");
  return JSON.parse(raw || "{}");
}

function sanitizeGallery(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    out[k] = Array.isArray(v) ? v : (v ? [v] : []);
  }
  return out;
}

async function readGallery() {
  return sanitizeGallery(await readGalleryRaw());
}

async function writeGallery(data) {
  await ensureGalleryFile();
  return fs.writeFile(GALLERY_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ----------------------
// Helpers
// ----------------------
function sanitizeName(name = "") {
  // keep alphanum, dash, underscore and spaces; convert spaces to underscore
  return String(name || "")
    .replace(/[^a-zA-Z0-9\-_\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

// ----------------------
// Cloudinary Upload Helper
// ----------------------
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function uploadThreeVariants(buffer, filename, bucketName) {
  const safeName = (bucketName || "default").replace(/\s+/g, "_");
  const base = `sahaya_events/${safeName}`;

  const original = await uploadBufferToCloudinary(buffer, {
    folder: `${base}/original`,
    resource_type: "image",
    public_id: path.parse(filename).name,
    overwrite: true,
  });

  const optimized = await uploadBufferToCloudinary(buffer, {
    folder: `${base}/optimized`,
    resource_type: "image",
    transformation: [
      { width: 1200, crop: "limit" },
      { quality: "auto" },
      { fetch_format: "auto" }
    ],
    public_id: path.parse(filename).name + "_opt",
    overwrite: true,
  });

  const thumb = await uploadBufferToCloudinary(buffer, {
    folder: `${base}/thumbs`,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "thumb", gravity: "auto" },
      { quality: "auto" },
      { fetch_format: "auto" }
    ],
    public_id: path.parse(filename).name + "_thumb",
    overwrite: true,
  });

  return {
    original: original.secure_url,
    optimized: optimized.secure_url,
    thumb: thumb.secure_url,

    public_ids: {
      original: original.public_id,
      optimized: optimized.public_id,
      thumb: thumb.public_id
    }
  };
}

// ----------------------
// GET → return {gallery, slider}
// ----------------------
export async function GET() {
  try {
    const all = await readGallery();

    const slider = all[SLIDER_KEY] || [];

    // remove slider from gallery list
    const gallery = {};
    for (const [k, v] of Object.entries(all)) {
      if (k !== SLIDER_KEY) gallery[k] = v;
    }

    return NextResponse.json({ ok: true, gallery, slider });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ----------------------
// POST → upload images OR handle JSON commands (createEvent, renameEvent, example upload)
// ----------------------
export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";
    const gallery = await readGallery();

    // JSON → commands: filePath (example upload), createEvent, renameEvent
    if (type.includes("application/json")) {
      const body = await req.json();

      // createEvent → adds empty array if not exists
      if (body.createEvent) {
        const rawName = body.eventName || "";
        const key = sanitizeName(rawName || "");
        if (!key) return NextResponse.json({ error: "eventName required" }, { status: 400 });
        gallery[key] = gallery[key] || [];
        await writeGallery(gallery);
        return NextResponse.json({ ok: true, gallery, slider: gallery[SLIDER_KEY] || [] });
      }

      // renameEvent → server-side metadata rename (does NOT move Cloudinary assets)
      if (body.renameEvent) {
        const oldRaw = body.oldName || "";
        const newRaw = body.newName || "";
        const oldKey = sanitizeName(oldRaw);
        const newKey = sanitizeName(newRaw);

        if (!oldKey || !newKey) {
          return NextResponse.json({ error: "oldName and newName required" }, { status: 400 });
        }

        // prevent renaming into hero key
        if (newKey === SLIDER_KEY) {
          return NextResponse.json({ error: `Cannot rename into reserved key '${SLIDER_KEY}'` }, { status: 400 });
        }

        // check old exists
        if (!gallery[oldKey]) {
          return NextResponse.json({ error: "Old event not found" }, { status: 404 });
        }

        // if target exists, refuse to overwrite/merge (409)
        if (gallery[newKey]) {
          return NextResponse.json({ error: "Target event already exists. Choose a different name.", status: 409 }, { status: 409 });
        }

        // Move metadata key (cloudinary URLs remain unchanged)
        gallery[newKey] = gallery[oldKey];
        delete gallery[oldKey];

        await writeGallery(gallery);

        return NextResponse.json({ ok: true, gallery, slider: gallery[SLIDER_KEY] || [] });
      }

      // example server-local file upload (existing behavior)
      if (body.filePath) {
        const { filePath, eventName, hero } = body;
        if (!filePath) return NextResponse.json({ error: "filePath required" }, { status: 400 });
        if (!filePath.startsWith("/mnt/data/")) return NextResponse.json({ error: "Only /mnt/data paths allowed" }, { status: 400 });

        const buf = await fs.readFile(filePath);
        const filename = path.basename(filePath);

        const bucket = hero ? SLIDER_KEY : (eventName || "default_event");
        const uploaded = await uploadThreeVariants(buf, filename, bucket);

        if (hero) {
          gallery[SLIDER_KEY] = [...(gallery[SLIDER_KEY] || []), uploaded];
        } else {
          const key = eventName || "default_event";
          gallery[key] = [...(gallery[key] || []), uploaded];
        }

        await writeGallery(gallery);

        return NextResponse.json({
          ok: true,
          uploaded,
          gallery,
          slider: gallery[SLIDER_KEY] || []
        });
      }

      return NextResponse.json({ error: "Unsupported JSON POST" }, { status: 400 });
    }

    // multipart → browser upload (unchanged)
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();

      const hero = form.get("hero") === "1" || form.get("hero") === "true";
      const eventName = hero ? SLIDER_KEY : (form.get("eventName") || form.get("event") || "default_event");

      const files = form.getAll("file");
      const results = [];

      for (const file of files) {
        const buf = Buffer.from(await file.arrayBuffer());
        const filename = file.name || `upload_${Date.now()}.jpg`;

        const uploaded = await uploadThreeVariants(buf, filename, eventName);
        results.push(uploaded);

        gallery[eventName] = [...(gallery[eventName] || []), uploaded];
        await writeGallery(gallery);
      }

      return NextResponse.json({
        ok: true,
        results,
        gallery,
        slider: gallery[SLIDER_KEY] || []
      });
    }

    return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });

  } catch (err) {
    console.error("POST ERROR:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ----------------------
// DELETE → remove event, gallery image, or hero image
// ----------------------
export async function DELETE(req) {
  try {
    const body = await req.json();
    const { eventName, url, deleteEvent, hero } = body;

    const gallery = await readGallery();

    if (hero) {
      // Delete ONE hero item
      gallery[SLIDER_KEY] = (gallery[SLIDER_KEY] || []).filter(
        (item) =>
          item.original !== url &&
          item.optimized !== url &&
          item.thumb !== url
      );

      await writeGallery(gallery);
      return NextResponse.json({ ok: true, slider: gallery[SLIDER_KEY] });
    }

    // Normal event deletion
    if (!eventName) return NextResponse.json({ error: "eventName required" }, { status: 400 });

    if (deleteEvent) {
      delete gallery[eventName];
      await writeGallery(gallery);
      return NextResponse.json({ ok: true, deletedEvent: eventName, gallery });
    }

    // Delete single image in event
    gallery[eventName] = (gallery[eventName] || []).filter(
      (item) =>
        item.original !== url &&
        item.optimized !== url &&
        item.thumb !== url
    );

    if (gallery[eventName].length === 0) delete gallery[eventName];

    await writeGallery(gallery);

    return NextResponse.json({ ok: true, gallery });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
