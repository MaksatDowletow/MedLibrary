import argparse
import csv
import json
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
TSV_PATH = REPO_ROOT / "books.html"
OUTPUT_PATH = REPO_ROOT / "data" / "books.json"

COLUMN_ALIASES = {
    "title": [
        "Название книги",
        "Book Name",
        "Book Title",
        "Kitaplar",
        "Kitabyň ady",
        "Name",
        "title",
    ],
    "author": [
        "Имя автора",
        "Authors Name",
        "Author",
        "Awtoryň ady",
        "author",
    ],
    "publisher": [
        "Издатель",
        "Publisher",
        "Publisher Name",
        "Neşirçi",
        "publisher",
    ],
    "city": [
        "Город публикации",
        "Publication City",
        "City",
        "Şäher",
        "city",
    ],
    "year": [
        "Год публикации",
        "Publication Year",
        "Год",
        "Year",
        "Ýyl",
        "year",
    ],
    "pages": [
        "Количество страниц",
        "Page Count",
        "Pages",
        "Sahypalar",
        "pages",
    ],
    "language": [
        "Язык книги",
        "Book Language",
        "Dil",
        "Language",
        "language",
    ],
    "specialty": [
        "Специальность",
        "Специальность / раздел",
        "Раздел",
        "Категория",
        "Category",
        "Specialty",
        "Bölüm",
        "Ugry",
        "specialty",
    ],
    "link": ["Ссылка", "Link", "URL", "Download", "Файл", "File", "link"],
    "cover": [
        "Обложка",
        "Изображение",
        "Фото",
        "Cover",
        "Image",
        "Book image",
        "H",
        "cover",
    ],
}

CANONICAL_FIELDS = [
    "title",
    "author",
    "publisher",
    "city",
    "year",
    "pages",
    "language",
    "specialty",
    "link",
    "cover",
]


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\xa0", " ").split())


def parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    normalized = value.replace("\xa0", " ").strip()
    normalized = normalized.replace(" ", "")
    if not normalized:
        return None
    try:
        return int(normalized)
    except ValueError:
        return None


def select_value(row: dict[str, str], aliases: Iterable[str]) -> str:
    for alias in aliases:
        if alias in row and row[alias] not in (None, ""):
            candidate = normalize_text(row[alias])
            if candidate:
                return candidate
    return ""


def load_rows(source_path: Path) -> list[dict[str, str | int]]:
    with source_path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        results: list[dict[str, str | int]] = []
        for row in reader:
            record: dict[str, str | int] = {}
            for field in CANONICAL_FIELDS:
                aliases = COLUMN_ALIASES.get(field, [])
                value = select_value(row, aliases)
                if not value:
                    continue
                if field in {"year", "pages"}:
                    number = parse_int(value)
                    if number is not None:
                        record[field] = number
                else:
                    record[field] = value
            if record.get("title"):
                results.append(record)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize MedLibrary TSV catalog into JSON"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=TSV_PATH,
        help="Path to the TSV source (defaults to books.html)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_PATH,
        help="Destination JSON path (defaults to data/books.json)",
    )
    args = parser.parse_args()

    source_path = args.input.resolve()
    output_path = args.output.resolve()

    if not source_path.exists():
        raise SystemExit(f"Source file not found: {source_path}")

    rows = load_rows(source_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    try:
        relative = output_path.relative_to(REPO_ROOT)
    except ValueError:
        relative = output_path
    print(f"Saved {len(rows)} records to {relative}")


if __name__ == "__main__":
    main()
