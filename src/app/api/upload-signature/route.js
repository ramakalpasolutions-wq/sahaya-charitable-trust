// src/app/api/upload-signature/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// configure cloudinary (server-side)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function GET() {
  try {
    const timestamp = Math.round(Date.now() / 1000);

    // Cloudinary helper to sign requests
    const signature = cloudinary.utils.api_sign_request(
      { timestamp },
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error("upload-signature error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
