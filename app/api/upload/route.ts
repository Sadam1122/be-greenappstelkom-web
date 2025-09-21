import { writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { ok, err } from "@/lib/response";
import { withCors, handleCorsPreflight } from "@/lib/cors";

export async function OPTIONS(request: Request) {
    return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

export async function POST(request: NextRequest) {
    const pre = handleCorsPreflight(request);
    if (pre) return pre;

    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
        return withCors(err("No file provided.", undefined, 400), request);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename
    const filename = `${Date.now()}-${file.name.replace(/\s/g, "_")}`;
    const path = join(process.cwd(), "public/uploads/rewards", filename);

    try {
        await writeFile(path, buffer);
        console.log(`File saved to ${path}`);
        const imageUrl = `/uploads/rewards/${filename}`;
        return withCors(ok({ imageUrl }, "File uploaded successfully."), request);

    } catch (error) {
        console.error("Error saving file:", error);
        return withCors(err("Failed to save file.", undefined, 500), request);
    }
}