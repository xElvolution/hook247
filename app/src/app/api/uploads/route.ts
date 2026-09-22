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

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image or video" }, { status: 400 });
  }

  const fileType = sniffFile(file);
  if (!fileType) {
    return NextResponse.json(
      { error: "Use a JPG, PNG or WEBP photo. iPhone: choose Most Compatible, not HEIC." },
      { status: 415 }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Uploads must be 20 MB or smaller" }, { status: 413 });
  }

  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${fileType.extension}`;
  await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/${filename}`, kind: fileType.kind });
}
