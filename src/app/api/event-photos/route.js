// src/app/api/event-photos/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import stream from "stream";

// ---------- CLOUDINARY CONFIG ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Where gallery.json will be stored in Cloudinary (RAW file)
const GALLERY_PUBLIC_ID = "metadata/sahaya_gallery";
const GALLERY_RESOURCE_TYPE = "raw";

// ---------- HELPERS ----------

// Upload buffer (image OR json) to cloudinary
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

// Read gallery.json from Cloudinary
async function readGalleryFromCloudinary() {
  try {
    const resource = await cloudinary.api.resource(GALLERY_PUBLIC_ID, {
      resource_type: GALLERY_RESOURCE_TYPE,
    });

    if (!resource?.secure_url) return { gallery: {}, slider: [] };

    const res = await fetch(resource.secure_url);
    const json = await res.text();

    let parsed = {};
    try {
      parsed = JSON.parse(json);
    } catch {
      return { gallery: {}, slider: [] };
    }

    return {
      gallery: parsed.gallery || {},
      slider: parsed.slider || parsed.home_slider || [],
    };
  } catch (e) {
    return { gallery: {}, slider: [] };
  }
}

// Write gallery.json back to Cloudinary
async function writeGalleryToCloudinary(data) {
  const out = {
    gallery: data.gallery || {},
    slider: data.slider || [],
    home_slider: data.slider || [],
  };

  const buffer = Buffer.from(JSON.stringify(out, null, 2), "utf8");

  return uploadBufferToCloudinary(buffer, {
    public_id: GALLERY_PUBLIC_ID,
    resource_type: GALLERY_RESOURCE_TYPE,
    overwrite: true,
  });
}

// Upload image file directly to Cloudinary without local temp
async function uploadImageFromFile(file, folder, filename) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const options = {
    folder,
    use_filename: true,
    unique_filename: false,
    resource_type: "image",
    overwrite: false,
    public_id: filename.replace(/\.[^/.]+$/, ""), // remove extension
  };

  return uploadBufferToCloudinary(buffer, options);
}

async function deleteCloudinary(public_id) {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id, {
      invalidate: true,
      resource_type: "image",
    });
  } catch {}
}

function sanitizeName(n) {
  return String(n || "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function makeImageObj(uploadRes) {
  const url = uploadRes.secure_url;
  return {
    original: url,
    optimized: url,
    thumb: url,
    public_id: uploadRes.public_id,
  };
}

// ---------- GET ----------
export async function GET() {
  const { gallery, slider } = await readGalleryFromCloudinary();
  return NextResponse.json({ gallery, slider, home_slider: slider });
}

// ---------- POST ----------
export async function POST(req) {
  const contentType = req.headers.get("content-type") || "";
  const { gallery, slider } = await readGalleryFromCloudinary();

  // ----- JSON COMMANDS -----
  if (contentType.includes("application/json")) {
    const body = await req.json();

    // Create event
    if (body.createEvent) {
      const name = sanitizeName(body.eventName);
      gallery[name] = gallery[name] || [];
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Add YouTube
    if (body.addYoutube && body.url) {
      const en = sanitizeName(body.eventName || "youtube");
      gallery[en] = gallery[en] || [];
      const yt = { youtube: true, url: body.url };
      if (!gallery[en].some(i => i.youtube && i.url === body.url)) {
        gallery[en].push(yt);
      }
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Rename event
    if (body.renameEvent || (body.oldName && body.newName)) {
      const oldName = sanitizeName(body.oldName);
      const newName = sanitizeName(body.newName);
      if (gallery[oldName]) {
        gallery[newName] = [...(gallery[newName] || []), ...gallery[oldName]];
        delete gallery[oldName];
      }
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    return NextResponse.json({ error: "Invalid JSON command" }, { status: 400 });
  }

  // ----- FILE UPLOADS -----
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();

    const hero = form.get("hero") === "1" || form.get("hero") === "true";
    const eventName = hero
      ? "home_slider"
      : sanitizeName(form.get("eventName") || "");

    const files = form.getAll("file");
    if (!files.length) return NextResponse.json({ error: "No file" }, { status: 400 });

    if (!hero) gallery[eventName] = gallery[eventName] || [];

    const folder = hero ? "slider" : `events/${eventName}`;

    for (const f of files) {
      const fname = `${Date.now()}-${(f.name || "upload").replace(/\s+/g, "_")}`;
      try {
        const uploadRes = await uploadImageFromFile(f, folder, fname);
        const obj = makeImageObj(uploadRes);

        if (hero) slider.push(obj);
        else gallery[eventName].push(obj);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }

    await writeGalleryToCloudinary({ gallery, slider });
    return NextResponse.json({ ok: true, gallery, slider });
  }

  return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });
}

// ---------- DELETE ----------
export async function DELETE(req) {
  const body = await req.json();
  const { gallery, slider } = await readGalleryFromCloudinary();

  const { deleteEvent, eventName, url, hero } = body;

  // Delete whole event
  if (deleteEvent && eventName) {
    const en = sanitizeName(eventName);
    const items = gallery[en] || [];

    for (const it of items) {
      if (it.public_id) await deleteCloudinary(it.public_id);
    }

    delete gallery[en];
    await writeGalleryToCloudinary({ gallery, slider });

    return NextResponse.json({ ok: true, gallery, slider });
  }

  // Hero image delete
  if (hero && url) {
    const match = slider.find(i => i.original === url || i.public_id === url);
    if (match?.public_id) await deleteCloudinary(match.public_id);

    const newSlider = slider.filter(i => i.original !== url && i.public_id !== url);

    await writeGalleryToCloudinary({ gallery, slider: newSlider });
    return NextResponse.json({ ok: true, gallery, slider: newSlider });
  }

  // Normal image delete
  if (url) {
    for (const en of Object.keys(gallery)) {
      const idx = gallery[en].findIndex(i => i.original === url || i.public_id === url);
      if (idx !== -1) {
        const item = gallery[en][idx];
        if (item.public_id) await deleteCloudinary(item.public_id);
        gallery[en].splice(idx, 1);
        await writeGalleryToCloudinary({ gallery, slider });
        return NextResponse.json({ ok: true, gallery, slider });
      }
    }
  }

  return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
}
