import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const META_PUBLIC_ID = "metadata/sahaya_gallery"; // same ID used to store gallery.json
const META_RESOURCE_TYPE = "raw";

// helper: read metadata from Cloudinary (returns { gallery, slider })
async function readGalleryFromCloudinary() {
  try {
    const resource = await cloudinary.api.resource(META_PUBLIC_ID, {
      resource_type: META_RESOURCE_TYPE,
    });

    if (!resource?.secure_url) return { gallery: {}, slider: [] };

    // fetch the raw JSON file from the secure_url
    const res = await fetch(resource.secure_url);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return {
        gallery: parsed.gallery || {},
        slider: parsed.slider || parsed.home_slider || [],
      };
    } catch (e) {
      // invalid JSON stored, return empty
      return { gallery: {}, slider: [] };
    }
  } catch (e) {
    // resource not found or other error -> return empty structures
    return { gallery: {}, slider: [] };
  }
}

// helper: write metadata back to Cloudinary (raw upload)
function uploadBufferToCloudinary(buffer, public_id) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: META_RESOURCE_TYPE,
        public_id,
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

async function writeGalleryToCloudinary(data) {
  const out = {
    gallery: data.gallery || {},
    slider: data.slider || [],
    home_slider: data.slider || [],
  };
  const buffer = Buffer.from(JSON.stringify(out, null, 2), "utf8");
  await uploadBufferToCloudinary(buffer, META_PUBLIC_ID);
}

// sanitize names for keys
function sanitizeName(n) {
  return String(n || "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

// make image object shape
function makeImageObj(url, public_id) {
  return {
    original: url,
    optimized: url,
    thumb: url,
    public_id,
  };
}

// GET: return gallery + slider
export async function GET() {
  try {
    const { gallery, slider } = await readGalleryFromCloudinary();
    return NextResponse.json({ gallery, slider, home_slider: slider });
  } catch (err) {
    console.error("GET /api/event-photos:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST: accepts JSON commands (createEvent, addYoutube, renameEvent, addImage, addHero)
export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });
    }

    const body = await req.json();
    let { gallery, slider } = await readGalleryFromCloudinary();

    // Create event
    if (body.createEvent) {
      const name = sanitizeName(body.eventName || "");
      if (!name) return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
      gallery[name] = gallery[name] || [];
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Add YouTube
    if (body.addYoutube && body.url) {
      const en = sanitizeName(body.eventName || "youtube");
      gallery[en] = gallery[en] || [];
      const item = { youtube: true, url: body.url };
      if (!gallery[en].some(i => i.youtube === true && i.url === body.url)) gallery[en].push(item);
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Rename event
    if (body.renameEvent || (body.oldName && body.newName)) {
      const oldName = sanitizeName(body.oldName || "");
      const newName = sanitizeName(body.newName || "");
      if (!oldName || !newName) return NextResponse.json({ error: "Missing names" }, { status: 400 });
      gallery[newName] = gallery[newName] || [];
      if (gallery[oldName]) {
        gallery[newName] = gallery[newName].concat(gallery[oldName]);
        delete gallery[oldName];
      }
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Add image metadata (after direct Cloudinary upload) - single
    if (body.addImage && body.eventName && body.url) {
      const en = sanitizeName(body.eventName || "");
      gallery[en] = gallery[en] || [];
      gallery[en].push(makeImageObj(body.url, body.public_id || null));
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Add multiple uploaded images at once (non-hero)
    if (Array.isArray(body.uploaded) && body.eventName && !body.hero) {
      const en = sanitizeName(body.eventName);
      gallery[en] = gallery[en] || [];
      for (const it of body.uploaded) {
        if (it?.url) gallery[en].push(makeImageObj(it.url, it.public_id || null));
      }
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Add hero images (batch) — handle uploaded array + hero flag
    if (Array.isArray(body.uploaded) && body.hero) {
      // Ensure slider exists
      slider = slider || [];
      for (const it of body.uploaded) {
        if (it?.url) {
          // avoid duplicate exact URLs
          if (!slider.some(s => (s.original === it.url) || (s.public_id && s.public_id === it.public_id))) {
            slider.push(makeImageObj(it.url, it.public_id || null));
          }
        }
      }
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    // Add hero (single)
    if (body.addHero && body.url) {
      slider = slider || [];
      if (!slider.some(s => s.original === body.url || (s.public_id && s.public_id === body.public_id))) {
        slider.push(makeImageObj(body.url, body.public_id || null));
      }
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    return NextResponse.json({ error: "Unsupported JSON command" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/event-photos:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE: { deleteEvent, eventName } OR { url, public_id, hero? }
export async function DELETE(req) {
  try {
    const body = await req.json();
    let { gallery, slider } = await readGalleryFromCloudinary();

    const { deleteEvent, eventName, url, public_id, hero } = body;

    if (deleteEvent && eventName) {
      const en = sanitizeName(eventName);
      const list = gallery[en] || [];
      for (const item of list) {
        if (item.public_id) {
          try { await cloudinary.uploader.destroy(item.public_id, { resource_type: "image" }); } catch (e) {}
        }
      }
      delete gallery[en];
      await writeGalleryToCloudinary({ gallery, slider });
      return NextResponse.json({ ok: true, gallery, slider });
    }

    if (hero && (url || public_id)) {
      const newSlider = slider.filter(i => i.original !== url && i.public_id !== public_id);
      // delete matched cloudinary resource
      for (const it of slider) {
        if (it.original === url || it.public_id === public_id) {
          if (it.public_id) {
            try { await cloudinary.uploader.destroy(it.public_id, { resource_type: "image" }); } catch (e) {}
          }
        }
      }
      await writeGalleryToCloudinary({ gallery, slider: newSlider });
      return NextResponse.json({ ok: true, gallery, slider: newSlider });
    }

    if (url || public_id) {
      for (const en of Object.keys(gallery)) {
        const idx = gallery[en].findIndex(i => i.original === url || i.public_id === public_id);
        if (idx >= 0) {
          const [removedObj] = gallery[en].splice(idx, 1);
          if (removedObj.public_id) {
            try { await cloudinary.uploader.destroy(removedObj.public_id, { resource_type: "image" }); } catch (e) {}
          }
          await writeGalleryToCloudinary({ gallery, slider });
          return NextResponse.json({ ok: true, gallery, slider });
        }
      }
    }

    return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
  } catch (err) {
    console.error("DELETE /api/event-photos:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
