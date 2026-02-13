import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  checkRateLimit,
  getRateLimitHeaders,
  resolveClientIp,
} from "@/lib/rate-limit";

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_UPLOADS_PER_WINDOW = 15;
const UPLOAD_WINDOW_MS = 5 * 60 * 1000;

const allowedImageMimeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function getUploaderScope(sessionUserId: string | undefined, request: Request) {
  if (sessionUserId) {
    return `user:${sessionUserId}`;
  }

  return `ip:${resolveClientIp(request)}`;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const scope = getUploaderScope(session?.user?.id, request);

  const rate = checkRateLimit({
    key: `upload:${scope}`,
    limit: MAX_UPLOADS_PER_WINDOW,
    windowMs: UPLOAD_WINDOW_MS,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait before retrying." },
      { status: 429, headers: getRateLimitHeaders(rate) }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const typedFile = file as File;
  const mimeType = typedFile.type?.toLowerCase() ?? "";
  const extension = allowedImageMimeToExtension[mimeType];

  if (!extension) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Allowed types: JPEG, PNG, WEBP, GIF, AVIF.",
      },
      { status: 400 }
    );
  }

  if (typedFile.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  if (typedFile.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 4MB." },
      { status: 400 }
    );
  }

  const arrayBuffer = await typedFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json(
    { url: `/uploads/${filename}` },
    { headers: getRateLimitHeaders(rate) }
  );
}
