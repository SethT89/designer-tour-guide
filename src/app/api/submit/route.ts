import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePlaceInput, slugify } from "@/lib/place-input";
import { shortId } from "@/lib/slug";
import { uploadPlacePhotos } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const FIELDS = [
  "name",
  "category",
  "tags",
  "description",
  "why",
  "address",
  "city",
  "country",
  "lat",
  "lng",
  "external_url",
] as const;

export async function POST(request: Request) {
  try {
    const fd = await request.formData();

    // Honeypot — a bot filled the hidden field. Pretend success, write nothing.
    if (String(fd.get("company") ?? "").trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "local";
    const { allowed } = await checkRateLimit(`submit:${ip}`, {
      limit: 5,
      windowSec: 3600,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Try again later." },
        { status: 429 },
      );
    }

    const raw: Record<string, string> = {};
    for (const f of FIELDS) raw[f] = String(fd.get(f) ?? "");

    const parsed = parsePlaceInput(raw);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Please check the form.", errors: parsed.errors },
        { status: 400 },
      );
    }
    const value = parsed.value;

    const submitter_email = String(fd.get("submitter_email") ?? "").trim();
    const submitter_note = String(fd.get("submitter_note") ?? "").trim();
    const slug = `${slugify(value.name)}-${shortId()}`;

    const supabase = createAdminClient();
    const { data: newId, error } = await supabase.rpc("insert_place", {
      p: { ...value, slug, status: "pending", submitter_email, submitter_note },
      p_lng: value.lng,
      p_lat: value.lat,
    });
    if (error) throw new Error(error.message);

    const files = fd
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 0) {
      const paths = await uploadPlacePhotos(newId as string, files);
      const { error: photoError } = await supabase
        .from("place_photos")
        .insert(
          paths.map((storage_path, i) => ({
            place_id: newId,
            storage_path,
            sort_order: i,
          })),
        );
      if (photoError) throw new Error(photoError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submission failed" },
      { status: 500 },
    );
  }
}
