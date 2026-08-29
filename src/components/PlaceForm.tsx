"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { PLACE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { resizeImage } from "@/lib/image-resize";
import { photoUrl } from "@/lib/photo-url";

// PinPicker pulls in maplibre-gl; load it only in the browser.
const PinPicker = dynamic(() => import("./PinPicker").then((m) => m.PinPicker), {
  ssr: false,
});

export type ExistingPhoto = { id: string; storage_path: string; alt: string };

export type PlaceFormValues = {
  name: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  category: string;
  tags: string;
  description: string;
  why: string;
  external_url: string;
  photos: ExistingPhoto[];
};

export type PlaceFormResult = { ok: boolean; error?: string; slug?: string };

type Mode = "public" | "admin-create" | "admin-edit";

type Props = {
  mode: Mode;
  initial?: Partial<PlaceFormValues>;
  action: (form: FormData) => Promise<PlaceFormResult>;
};

const MAX_PHOTOS = 5;

const fieldClass =
  "w-full border border-rule bg-paper px-3 py-2 outline-none focus:border-ink";

export function PlaceForm({ mode, initial, action }: Props) {
  const router = useRouter();
  const isPublic = mode === "public";

  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? PLACE_CATEGORIES[0],
  );
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [why, setWhy] = useState(initial?.why ?? "");
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? "");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );

  const [geoResults, setGeoResults] = useState<
    { label: string; lat: number; lng: number }[]
  >([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const [keptPhotos, setKeptPhotos] = useState<ExistingPhoto[]>(
    initial?.photos ?? [],
  );
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const honeypotRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function findOnMap() {
    if (!address.trim()) return;
    setGeoBusy(true);
    setGeoMsg(null);
    setGeoResults([]);
    try {
      // Bias the search toward the current pin so a plain street address
      // resolves near where the place actually is.
      const near = pin ? `&lat=${pin.lat}&lon=${pin.lng}` : "";
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(address.trim())}${near}`,
      );
      const body = await res.json();
      const results = res.ok ? (body.results ?? []) : [];
      setGeoResults(results);
      if (results.length === 0) {
        setGeoMsg(
          res.ok
            ? "No matches — drop the pin on the map below instead."
            : "Address lookup is unavailable. Drop the pin on the map below.",
        );
      }
    } catch {
      setGeoMsg("Address lookup failed. Drop the pin on the map below.");
    } finally {
      setGeoBusy(false);
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setPhotoBusy(true);
    try {
      const room = MAX_PHOTOS - keptPhotos.length - newPhotos.length;
      const resized = await Promise.all(
        picked.slice(0, Math.max(0, room)).map((f) => resizeImage(f)),
      );
      setNewPhotos((prev) => [...prev, ...resized]);
    } catch {
      setError("One of those images could not be processed.");
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!pin) {
      setError("Pick the location on the map.");
      return;
    }

    const fd = new FormData();
    fd.set("name", name);
    fd.set("address", address);
    fd.set("city", city);
    fd.set("country", country);
    fd.set("category", category);
    fd.set("tags", tags);
    fd.set("description", description);
    fd.set("why", why);
    fd.set("external_url", externalUrl);
    fd.set("lat", String(pin.lat));
    fd.set("lng", String(pin.lng));
    fd.set("company", honeypotRef.current?.value ?? "");
    if (isPublic) {
      fd.set("submitter_email", email);
      fd.set("submitter_note", note);
    }
    if (mode === "admin-edit") {
      fd.set("kept_photo_ids", JSON.stringify(keptPhotos.map((p) => p.id)));
    }
    for (const file of newPhotos) fd.append("photos", file);

    setSubmitting(true);
    try {
      const result = await action(fd);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      if (isPublic) router.push("/submit/thanks");
      else if (result.slug) router.push(`/place/${result.slug}`);
      else router.push("/admin");
    } catch {
      setError("Something went wrong.");
      setSubmitting(false);
    }
  }

  const submitLabel =
    mode === "public"
      ? "Submit for review"
      : mode === "admin-create"
        ? "Publish place"
        : "Save changes";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Name">
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>

      <Field label="Address">
        <div className="flex gap-2">
          <input
            className={fieldClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button
            type="button"
            onClick={findOnMap}
            disabled={geoBusy || !address.trim()}
            className="label shrink-0 border border-ink px-3 disabled:opacity-40"
          >
            {geoBusy ? "…" : "Find on map"}
          </button>
        </div>
        {geoResults.length > 0 && (
          <ul className="mt-2 divide-y divide-rule border border-rule">
            {geoResults.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-dim"
                  onClick={() => {
                    setPin({ lat: r.lat, lng: r.lng });
                    setGeoResults([]);
                    setGeoMsg(null);
                  }}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {geoMsg && <p className="label mt-2">{geoMsg}</p>}
      </Field>

      <Field label="Location">
        <PinPicker value={pin} onChange={setPin} />
        <p className="label mt-1">
          {pin
            ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} — drag the pin to adjust`
            : "Search an address or drag the pin"}
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="City">
          <input
            className={fieldClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </Field>
        <Field label="Country">
          <input
            className={fieldClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Category">
        <select
          className={fieldClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {PLACE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tags (comma-separated)">
        <input
          className={fieldClass}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </Field>

      <Field label="What is it">
        <textarea
          className={fieldClass}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Why it's worth seeing">
        <textarea
          className={fieldClass}
          rows={3}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
      </Field>

      <Field label="Official site (optional)">
        <input
          className={fieldClass}
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          inputMode="url"
        />
      </Field>

      <Field label="Photos">
        {(keptPhotos.length > 0 || newPhotos.length > 0) && (
          <div className="mb-2 grid grid-cols-3 gap-2">
            {keptPhotos.map((p) => (
              <figure key={p.id} className="relative">
                <Image
                  src={photoUrl(p.storage_path)}
                  alt={p.alt}
                  width={200}
                  height={150}
                  className="h-24 w-full object-cover border border-rule"
                />
                <button
                  type="button"
                  onClick={() =>
                    setKeptPhotos((prev) => prev.filter((x) => x.id !== p.id))
                  }
                  className="label absolute right-1 top-1 bg-paper px-1"
                >
                  Remove
                </button>
              </figure>
            ))}
            {newPhotos.map((f, i) => (
              <figure key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  className="h-24 w-full object-cover border border-rule"
                />
                <button
                  type="button"
                  onClick={() =>
                    setNewPhotos((prev) => prev.filter((_, x) => x !== i))
                  }
                  className="label absolute right-1 top-1 bg-paper px-1"
                >
                  Remove
                </button>
              </figure>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFiles}
          className="label"
        />
        {photoBusy && <p className="label mt-1">Processing…</p>}
      </Field>

      {isPublic && (
        <>
          <Field label="Your email (optional)">
            <input
              type="email"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Note to the curator (optional)">
            <textarea
              className={fieldClass}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div aria-hidden className="absolute left-[-9999px]">
            <label>
              Company
              <input
                ref={honeypotRef}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                name="company"
              />
            </label>
          </div>
        </>
      )}

      {error && <p className="label !text-accent">{error}</p>}

      <button
        type="submit"
        disabled={submitting || photoBusy}
        className={`w-full px-4 py-2.5 font-sans disabled:opacity-50 ${
          isPublic ? "bg-accent text-paper" : "bg-ink text-paper"
        }`}
      >
        {submitting ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="label block">{label}</span>
      {children}
    </div>
  );
}
