// // // pages/api/event-photos.js
// // import formidable from "formidable";
// // import fs from "fs";
// // import fsp from "fs/promises";
// // import path from "path";
// // import { promisify } from "util";
// // import { pipeline as pipelineCb } from "stream";
// // const pipeline = promisify(pipelineCb);

// // // disable Next's default body parser
// // export const config = {
// //   api: {
// //     bodyParser: false,
// //   },
// // };

// // const DATA_DIR = path.join(process.cwd(), "data");
// // const GALLERY_JSON = path.join(DATA_DIR, "gallery.json");
// // const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");
// // const EVENTS_DIR = path.join(PUBLIC_UPLOADS, "events");
// // const SLIDER_DIR = path.join(PUBLIC_UPLOADS, "slider");

// // // helper: ensure directories exist
// // async function ensureDirs() {
// //   await fsp.mkdir(DATA_DIR, { recursive: true });
// //   await fsp.mkdir(PUBLIC_UPLOADS, { recursive: true });
// //   await fsp.mkdir(EVENTS_DIR, { recursive: true });
// //   await fsp.mkdir(SLIDER_DIR, { recursive: true });
// //   // ensure gallery.json exists
// //   try {
// //     await fsp.access(GALLERY_JSON);
// //   } catch (err) {
// //     await fsp.writeFile(GALLERY_JSON, JSON.stringify({ gallery: {}, slider: [] }, null, 2));
// //   }
// // }

// // // read metadata
// // async function readMeta() {
// //   try {
// //     const raw = await fsp.readFile(GALLERY_JSON, "utf8");
// //     const obj = JSON.parse(raw || "{}");
// //     obj.gallery = obj.gallery || {};
// //     obj.slider = obj.slider || [];
// //     return obj;
// //   } catch (err) {
// //     return { gallery: {}, slider: [] };
// //   }
// // }

// // // write metadata
// // async function writeMeta(meta) {
// //   await fsp.writeFile(GALLERY_JSON, JSON.stringify(meta, null, 2));
// // }

// // // sanitize file/event names
// // function sanitizeName(name = "") {
// //   return name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "_");
// // }

// // // normalize image object used by UI
// // function makeImageObj(relPath) {
// //   // relPath: path relative to public (e.g. /uploads/events/foo/img.png)
// //   // We'll keep original and thumb the same for now (thumb/optimized generation not implemented here).
// //   return { original: relPath, optimized: relPath, thumb: relPath };
// // }

// // // copy an example local file to public uploads
// // async function copyExampleTo(targetDir, srcPath) {
// //   // if srcPath is inside container (absolute), copy it. If not, throw.
// //   if (!srcPath || typeof srcPath !== "string") throw new Error("Invalid example path");
// //   // ensure src exists
// //   await fsp.access(srcPath);
// //   const base = path.basename(srcPath);
// //   const destPath = path.join(targetDir, `${Date.now()}-${base}`);
// //   await fsp.copyFile(srcPath, destPath);
// //   // return path relative to public root
// //   const rel = destPath.startsWith(path.join(process.cwd(), "public"))
// //     ? destPath.slice(path.join(process.cwd(), "public").length).replace(/\\/g, "/")
// //     : `/uploads/${path.basename(targetDir)}/${path.basename(destPath)}`;
// //   return rel.startsWith("/") ? rel : `/${rel}`;
// // }

// // async function handleGet(req, res) {
// //   await ensureDirs();
// //   const meta = await readMeta();
// //   return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// // }

// // async function parseForm(req) {
// //   await ensureDirs();
// //   const form = new formidable.IncomingForm({ multiples: true, keepExtensions: true });
// //   return new Promise((resolve, reject) => {
// //     form.parse(req, (err, fields, files) => {
// //       if (err) return reject(err);
// //       resolve({ fields, files });
// //     });
// //   });
// // }

// // async function handlePost(req, res) {
// //   await ensureDirs();
// //   const contentType = (req.headers["content-type"] || "").toLowerCase();

// //   // support JSON body (createEvent, example local uploads) OR multipart/form-data for file uploads
// //   if (contentType.includes("application/json")) {
// //     // parse manually
// //     const body = await new Promise((r) => {
// //       let s = "";
// //       req.on("data", (c) => (s += c.toString()));
// //       req.on("end", () => r(s ? JSON.parse(s) : {}));
// //     });

// //     const meta = await readMeta();
// //     const { createEvent, eventName, filePath, hero } = body;

// //     if (createEvent) {
// //       const name = sanitizeName(eventName || "");
// //       if (!name) return res.status(400).json({ error: "Missing eventName" });
// //       meta.gallery[name] = meta.gallery[name] || [];
// //       await writeMeta(meta);
// //       return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// //     }

// //     if (filePath) {
// //       const target = hero ? SLIDER_DIR : path.join(EVENTS_DIR, sanitizeName(eventName || "unknown"));
// //       await fsp.mkdir(target, { recursive: true });
// //       try {
// //         const rel = await copyExampleTo(target, filePath);
// //         const obj = makeImageObj(rel);
// //         if (hero) {
// //           // prevent duplicate identical path entries
// //           if (!meta.slider.find(i => i.original === obj.original)) meta.slider.push(obj);
// //         } else {
// //           const ename = sanitizeName(eventName || "unknown");
// //           meta.gallery[ename] = meta.gallery[ename] || [];
// //           meta.gallery[ename].push(obj);
// //         }
// //         await writeMeta(meta);
// //         return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// //       } catch (err) {
// //         console.error("Example copy failed:", err);
// //         return res.status(500).json({ error: "Example copy failed: " + err.message });
// //       }
// //     }

// //     return res.status(400).json({ error: "Unsupported JSON POST" });
// //   }

// //   // else treat as multipart/form-data
// //   try {
// //     const { fields, files } = await parseForm(req);
// //     const meta = await readMeta();
// //     const eventNameRaw = fields.eventName || fields.eventname || fields.event || "";
// //     const heroFlag = String(fields.hero || "0") === "1" || fields.hero === "true" || fields.hero === true;
// //     const eventNameSan = sanitizeName(eventNameRaw || (heroFlag ? "home_slider" : "unknown"));

// //     // ensure folder exists
// //     if (!heroFlag) meta.gallery[eventNameSan] = meta.gallery[eventNameSan] || [];

// //     // files can be single file or array
// //     const fileList = [];
// //     if (files && files.file) {
// //       if (Array.isArray(files.file)) fileList.push(...files.file);
// //       else fileList.push(files.file);
// //     } else {
// //       // some clients may send files under different field names (support all file fields)
// //       for (const key of Object.keys(files || {})) {
// //         const entry = files[key];
// //         if (Array.isArray(entry)) fileList.push(...entry);
// //         else fileList.push(entry);
// //       }
// //     }

// //     if (fileList.length === 0) {
// //       return res.status(400).json({ error: "No files uploaded" });
// //     }

// //     const savedObjs = [];
// //     const targetDir = heroFlag ? SLIDER_DIR : path.join(EVENTS_DIR, eventNameSan);
// //     await fsp.mkdir(targetDir, { recursive: true });

// //     for (const f of fileList) {
// //       const fname = `${Date.now()}-${path.basename(f.originalFilename || f.filepath || f.newFilename || "upload")}`;
// //       const dest = path.join(targetDir, fname);
// //       // move/stream file
// //       await pipeline(fs.createReadStream(f.filepath), fs.createWriteStream(dest));
// //       // build public relative path
// //       const relPath = dest.startsWith(path.join(process.cwd(), "public"))
// //         ? dest.slice(path.join(process.cwd(), "public").length).replace(/\\/g, "/")
// //         : `/uploads/${heroFlag ? "slider" : "events"}/${eventNameSan}/${fname}`;
// //       const publicRel = relPath.startsWith("/") ? relPath : `/${relPath}`;
// //       const imgObj = makeImageObj(publicRel);
// //       savedObjs.push(imgObj);

// //       if (heroFlag) {
// //         if (!meta.slider.find(i => i.original === imgObj.original)) meta.slider.push(imgObj);
// //       } else {
// //         meta.gallery[eventNameSan] = meta.gallery[eventNameSan] || [];
// //         meta.gallery[eventNameSan].push(imgObj);
// //       }
// //     }

// //     await writeMeta(meta);
// //     return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// //   } catch (err) {
// //     console.error(err);
// //     return res.status(500).json({ error: err.message || "Upload failed" });
// //   }
// // }

// // async function handleDelete(req, res) {
// //   await ensureDirs();
// //   const meta = await readMeta();

// //   // delete via JSON body
// //   const body = await new Promise((r) => {
// //     let s = "";
// //     req.on("data", (c) => (s += c.toString()));
// //     req.on("end", () => r(s ? JSON.parse(s) : {}));
// //   });

// //   const { eventName, deleteEvent, url, hero } = body;

// //   if (deleteEvent && eventName) {
// //     const en = sanitizeName(eventName);
// //     // delete files from disk
// //     const list = meta.gallery[en] || [];
// //     for (const item of list) {
// //       try {
// //         const p = path.join(process.cwd(), "public", item.original || item.optimized || item.thumb).replace(/^\//, "");
// //         if (await fsp.stat(p).catch(() => false)) await fsp.unlink(p);
// //       } catch (e) { /* ignore */ }
// //     }
// //     delete meta.gallery[en];
// //     await writeMeta(meta);
// //     return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// //   }

// //   if (url) {
// //     // determine whether it's hero or gallery deletion
// //     const targetHero = Boolean(hero);
// //     if (targetHero) {
// //       meta.slider = meta.slider.filter(i => i.original !== url && i.optimized !== url && i.thumb !== url);
// //       // attempt remove file from disk
// //       try {
// //         const p = path.join(process.cwd(), "public", url).replace(/^\//, "");
// //         if (await fsp.stat(p).catch(() => false)) await fsp.unlink(p);
// //       } catch (e) { /* ignore */ }
// //       await writeMeta(meta);
// //       return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// //     } else {
// //       // find and remove from gallery events
// //       let removed = false;
// //       for (const en of Object.keys(meta.gallery)) {
// //         const arr = meta.gallery[en];
// //         const idx = arr.findIndex(i => i.original === url || i.optimized === url || i.thumb === url);
// //         if (idx >= 0) {
// //           const [removedObj] = arr.splice(idx, 1);
// //           removed = true;
// //           // delete file from disk (best-effort)
// //           try {
// //             const p = path.join(process.cwd(), "public", removedObj.original).replace(/^\//, "");
// //             if (await fsp.stat(p).catch(() => false)) await fsp.unlink(p);
// //           } catch (e) { /* ignore */ }
// //           // if event becomes empty, you may want to keep the empty folder; we keep empty array
// //           break;
// //         }
// //       }
// //       await writeMeta(meta);
// //       if (!removed) return res.status(404).json({ error: "Image not found in gallery" });
// //       return res.status(200).json({ gallery: meta.gallery, slider: meta.slider });
// //     }
// //   }

// //   return res.status(400).json({ error: "Invalid delete request" });
// // }

export default async function handler(req, res) {
  if (req.method === "GET") return handleGet(req, res);
  if (req.method === "POST") return handlePost(req, res);
  if (req.method === "DELETE") return handleDelete(req, res);
  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
