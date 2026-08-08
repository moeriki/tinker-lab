# Photos are stored exactly as they arrive, and thumbnails come from EXIF

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Photo submission subsystem](https://github.com/moeriki/tinker-lab/issues/10)

## Context

Several games are photo games. A guest picks a photo on their phone, it lands in the admin
gallery, and the host judges it — on a phone, in a dark house, on wifi shared by fifteen teams.

Three facts shape this:

1. **Multipart parsing needs no dependency.** Node can bridge an `IncomingMessage` into a web
   `Request` and let the platform's own parser handle it. Verified on Node 26, which is what the
   container pins. The zero-runtime-dependency build guard from
   [ADR-one-home-assistant-webhook](one-home-assistant-webhook.md)'s ticket survives untouched.
2. **iPhones may send HEIC, and Chrome will not display it.** We judge on "modern iOS and
   Android", so we cannot assume Safari.
3. **Node cannot decode an image without a dependency.** There is no built-in resize, and no
   built-in HEIC-to-JPEG.

The obvious escape — have the phone downscale and re-encode via `<canvas>` before upload — was
considered and **rejected**: client JS is for animation and the hint modal only, and that
constraint was kept deliberately.

## Decision

**Store the bytes exactly as they arrive.** No conversion, no resizing, no re-encoding, ever.

Three things follow:

- **Type comes from magic bytes**, never the filename and never the client's `Content-Type`. It
  is recorded on the submission as `photo_mime`.
- **The thumbnail is the camera's own.** Phone JPEGs embed a ~160×120 JPEG in the EXIF APP1
  segment; extracting it is metadata reading, not decoding, so it stays cheap. Measured on a real
  photo: 1282KB → 6.5KB, a 190× saving. Recorded as `photo_thumb`, and **null is normal** — HEIC
  and PNG carry none.

  This originally read *so it costs no dependency*, and it was true: the extraction was
  fifty-seven hand-written lines of TIFF offset arithmetic. [#102](https://github.com/moeriki/tinker-lab/issues/102)
  replaced them with `exifreader`, which returns the same bytes and is somebody else's problem to
  keep correct. The decision this ADR actually makes — the camera's own thumbnail, no decoding, no
  resizing — is untouched; only the sentence about what it cost.
- **A format the browser may refuse gets a download tile**, not a broken `<img>`. This is the
  entire mitigation for HEIC, and it is a degrade rather than a failure.

Uploads are served `immutable` with a one-year max-age. Filenames are unique and their bytes
never change, so a phone fetches each photo exactly once — which is what makes a tile showing six
thumbnails cheap. Pages remain uncached; only these bytes are.

Filenames are self-describing — `0007-yarn-20260814T2134-a3f9.jpg` — team, game, when, random.
`cp -r data/uploads` is therefore already a labelled archive, so the post-party collage needs no
export feature and nothing runs on the night to support it. The random tail is what keeps an
`/uploads` URL unguessable, since that route has no cookie gate.

The file is written **only after the whole body has parsed**, so an upload that dies on patchy
wifi leaves nothing behind. There is no such thing as a half-written photo.

## Consequences

- Photos are stored at full camera resolution — 3–12MB each. With ~15 teams this is comfortably
  under a gigabyte, which the bind mount absorbs without thought.
- The gallery is cheap to browse but the full image behind a tap is not. That is the right way
  round: the host taps only what they are judging.
- A HEIC photo cannot be shown inline on Android. The host taps through to open it in a native
  viewer instead. Accepted knowingly.
- If iOS turns out to transcode to JPEG on upload — plausible, and untested on a real device —
  everything simply gets better: thumbnails appear and the download tile never fires. Nothing
  needs changing to benefit.
- `MAX_PHOTO_BYTES` is 25MB, capped twice: on the declared `Content-Length`, so an oversized
  upload dies before it is sent, and on the bytes actually seen, because a header is a claim.

## Alternatives considered

**Client-side `<canvas>` downscale and re-encode.** Solves HEIC, size and slow uploads in one
move, and the phone that took the photo can always decode its own format. Rejected because it
spends the "client JS is animation only" constraint, and needs a no-JS fallback path anyway.

**A server-side image library** (`sharp`). Real thumbnails and real HEIC conversion. Rejected:
it is a native dependency, which is precisely what
[ADR-sqlite-via-node-sqlite](sqlite-via-node-sqlite.md) avoided for the database, and a build
that compiles native code the week of the party is a risk with no upside on the night.

**Rely on the browser and hope.** Cheapest, and the failure mode is a gallery of broken images
discovered at 23:00 with no way to recover the photo.
