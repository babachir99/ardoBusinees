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
import { assertSameOrigin } from "@/lib/request-security";
import { getPublicUploadUrl } from "@/lib/upload-url";

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_UPLOADS_PER_WINDOW = 15;
const UPLOAD_WINDOW_MS = 5 * 60 * 1000;
const PUBLIC_UPLOAD_SCOPES = new Set(["ad-request"]);

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

function matchesMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0,4).toString() === "RIFF" && buffer.subarray(8,12).toString() === "WEBP";
  if (mimeType === "image/gif") return buffer.length >= 6 && ["GIF87a","GIF89a"].includes(buffer.subarray(0,6).toString());
  if (mimeType === "image/avif") return buffer.length >= 12 && buffer.subarray(4,8).toString() === "ftyp" && buffer.subarray(8,12).toString().startsWith("avi");
  return false;
}

export async function POST(request: Request) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;
  const session = await getServerSession(authOptions);
  const formData = await request.formData();
  const uploadScope = String(formData.get("scope") ?? "")
    .trim()
    .toLowerCase();
  const allowsAnonymousUpload = PUBLIC_UPLOAD_SCOPES.has(uploadScope);

  if (!session?.user?.id && !allowsAnonymousUpload) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
  }

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
  if (!matchesMagicBytes(buffer, mimeType)) {
    return NextResponse.json({ error: "Invalid file signature" }, { status: 400 });
  }

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json(
    { url: getPublicUploadUrl(filename) },
    { headers: getRateLimitHeaders(rate) }
  );
}
