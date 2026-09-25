import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";

const FILE_TYPES: Record<string, { extension: string; kind: "image" | "video" }> = {
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/jpg": { extension: "jpg", kind: "image" },
  "image/pjpeg": { extension: "jpg", kind: "image" },
  "image/png": { extension: "png", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "image/gif": { extension: "gif", kind: "image" },
  "video/mp4": { extension: "mp4", kind: "video" },
  "video/webm": { extension: "webm", kind: "video" },
  "video/quicktime": { extension: "mov", kind: "video" },
};

function sniffFile(file: File) {
  if (FILE_TYPES[file.type]) return FILE_TYPES[file.type];
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return FILE_TYPES["image/jpeg"];
  if (name.endsWith(".png")) return FILE_TYPES["image/png"];
  if (name.endsWith(".webp")) return FILE_TYPES["image/webp"];
  if (name.endsWith(".gif")) return FILE_TYPES["image/gif"];
  if (name.endsWith(".mp4")) return FILE_TYPES["video/mp4"];
  if (name.endsWith(".webm")) return FILE_TYPES["video/webm"];
  if (name.endsWith(".mov")) return FILE_TYPES["video/quicktime"];
  return null;
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Check the first bytes against the claimed type, so a renamed executable or
 * HTML file can never be stored and served from /uploads as "media".
 */
function signatureMatches(head: Buffer, extension: string) {
  const ascii = (start: number, end: number) => head.subarray(start, end).toString("latin1");
  switch (extension) {
    case "jpg":
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case "png":
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "gif":
      return ascii(0, 4) === "GIF8";
    case "webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "mp4":
    case "mov":
      return ascii(4, 8) === "ftyp" || ascii(4, 8) === "moov" || ascii(4, 8) === "mdat" || ascii(4, 8) === "wide";
    case "webm":
      return head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
}

export async function POST(request: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_VIDEO_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "Videos must be 50 MB or smaller" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload was interrupted. Try again." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image or video" }, { status: 400 });
  }

  const fileType = sniffFile(file);
  if (!fileType) {
    return NextResponse.json(
      { error: "Use a JPG, PNG or WEBP photo, or an MP4 or WEBM video. iPhone: choose Most Compatible, not HEIC." },
      { status: 415 }
    );
  }
  const limit = fileType.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      { error: fileType.kind === "video" ? "Videos must be 50 MB or smaller" : "Photos must be 20 MB or smaller" },
      { status: 413 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!signatureMatches(bytes.subarray(0, 16), fileType.extension)) {
    return NextResponse.json({ error: "That file does not look like a real photo or video" }, { status: 415 });
  }

  // Media is stored on this server's disk under public/uploads and served
  // straight from there.
  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${fileType.extension}`;
  await writeFile(path.join(directory, filename), bytes);

  return NextResponse.json({ url: `/uploads/${filename}`, kind: fileType.kind });
}
