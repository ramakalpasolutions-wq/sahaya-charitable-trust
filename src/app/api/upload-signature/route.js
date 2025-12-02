import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") || ""; // coming from client

    const timestamp = Math.round(Date.now() / 1000);

    // SIGN **folder + timestamp**
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
    console.error("upload-signature error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
