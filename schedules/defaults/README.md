# Default schedules

Put repository-managed schedule JSON files in this folder.

## How to add a default

1. Add your schedule file, for example: `my-protocol-v1.json`.
2. That's it — the app auto-discovers any `.json` file in this folder.
3. Ensure the JSON matches a supported schedule contract version (`version: 1` currently).

## Notes

- Discovery relies on the web server exposing this folder so the app can read links.
- Filenames are shown as labels (with `-`/`_` replaced by spaces).
