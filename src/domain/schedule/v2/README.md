# Proposed schedule JSON structure (v2 draft)

This is the target contract for the visual schedule editor. It is designed for:

- predictable IDs for editing,
- explicit progression blocks,
- clean upload/validate/download loops,
- backward-compatibility mapping from v1.

```json
{
  "version": 2,
  "metadata": {
    "protocolId": "latarjet-standard",
    "title": "Latarjet recovery",
    "anchor": {
      "type": "surgeryEnd",
      "at": "2026-02-13T16:00:00+01:00"
    },
    "timezone": "Europe/Paris",
    "weekLengthDays": 7,
    "periods": [
      { "id": "p0", "label": "Week 0-2 (Protection)", "startDay": 0, "endDay": 13 }
    ]
  },
  "weeks": [
    {
      "id": "w0",
      "weekNumber": 0,
      "label": "Week 0",
      "description": "Protection and symptom control.",
      "gates": [
        {
          "id": "pain-rules",
          "title": "Pain rules met",
          "detail": ["Rest pain <= 3/10", "Exercise pain <= 6/10"]
        }
      ],
      "sessions": [
        {
          "id": "am",
          "title": "Morning",
          "timeOfDay": "08:00",
          "notes": "Brace on after session.",
          "items": [
            {
              "id": "handpump",
              "kind": "exercise",
              "title": "Hand/wrist pump",
              "purpose": "Promote circulation.",
              "how": [
                "Make a fist 20x",
                "Spread fingers 20x",
                "Wrist circles 10 each direction"
              ],
              "dosage": { "reps": "20", "sets": "1", "holdSec": 0 },
              "progression": {
                "when": "No pain flare for 48h",
                "next": "Increase to 2 sets"
              },
              "links": [{ "label": "Video", "url": "https://example.com/video" }]
            }
          ]
        }
      ]
    }
  ]
}
```

## Mapping notes

- `v1.sessions[].exercises[]` maps to `v2.sessions[].items[]`.
- `v1.exercise.instructions` (newline text) maps to `v2.item.how` (string array).
- `v1.exercise.name` maps to `v2.item.title`.
- `v1.exercise.progression` maps to `v2.item.progression.next`.

Until the v2 parser is implemented, the editor continues to save/load v1-compatible schedules.
