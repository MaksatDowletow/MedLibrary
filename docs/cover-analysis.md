# Cover image source analysis

## Findings from `dbMedicalLib.sqlite`
- The `Book` table includes a `BookImage` column (type `char(36)`), which stores GUID-like identifiers for cover images rather than file paths or binary data.
- The catalog holds 1,000 book rows, and 993 of them have non-null `BookImage` values, but the database does not include any table that stores the image binaries themselves.
- Example rows show `BookImage` GUIDs alongside Russian book titles.

## Local cover files
- The repository contains 207 files under `data/covers/` plus a README that describes the directory as a cache for cover images downloaded by the API.
- The Express server serves `/covers` from the `COVER_CACHE_DIR`, which defaults to `data/covers`, and helper functions read and write cached images in that directory with extensions `.jpg`, `.jpeg`, `.png`, or `.webp`.

## Conclusion
The SQLite database references cover images via GUIDs but does not embed the images. The actual cover files available in the project live in `data/covers/`, and the server is already configured to expose that folder as the cover image source. Consequently, `data/covers/` should be treated as the active source for cover images when fulfilling cover requests for the catalog data coming from `dbMedicalLib.sqlite`.
