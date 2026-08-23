# Cover image source analysis

## SQLite catalog facts
- The `Book` table defines a `BookImage` column (`char(36)`) but the database has no table that stores image binaries or file names.
- `Book` contains **1,000** rows; **993** rows have a non-empty `BookImage` value, leaving only 7 books without a reference. The `BookImage` values are UUID/GUID strings, not file paths.
- Distinct `BookImage` GUIDs also total **993**, which indicates each populated row points to its own GUID rather than reusing shared images.

## Files available locally
- The project ships **206** image files under `data/covers/` (197 unique base names once extensions are stripped) plus `README.md` that labels this directory as a cache for downloaded covers.
- All cover filenames are simple integers (`1`–`199`) with extensions such as `.jpg`, `.png`, `.webp`, or `.bmp`; none follow the GUID format used in the SQLite `BookImage` column.
- Because the on-disk names are numeric and the SQLite references are GUIDs, there is no direct filename match between the database metadata and the cached files.

## How the app uses cover files
- The Express server exposes `/covers` as a static route backed by `data/covers` (the `COVER_CACHE_DIR` default). Any cached cover saved here becomes immediately reachable by the client via `/covers/<filename>`.
- When the client posts to `/covers/cache`, the server will download the requested remote image, store it in `data/covers/` with an allowed extension, and return the public `/covers/...` URL. The helper `findCachedCover` also looks for existing files in this folder using the provided cache key.

## Conclusion
`BookImage` GUIDs in `dbMedicalLib.sqlite` describe cover references but do not correspond to stored binaries. The actual cover assets available to the app live in `data/covers/`, and the server is configured to serve and populate that directory as the source of cover images. Any new covers obtained for database rows must be cached into `data/covers/` (or whichever path `COVER_CACHE_DIR` points to) to be displayed.
