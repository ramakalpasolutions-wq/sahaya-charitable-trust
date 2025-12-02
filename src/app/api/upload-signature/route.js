// src/app/api/upload-signature/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function GET(req) {
  try {
    // Get folder from query
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") || "";

    const timestamp = Math.round(Date.now() / 1000);

    // SIGN EXACT FOLDER + TIMESTAMP
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      timestamp,
      signature,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });

  } catch (err) {
    console.error("Signature error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
