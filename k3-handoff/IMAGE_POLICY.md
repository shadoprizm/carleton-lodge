# Image Policy for the History Section

## Classification

Every image must have one of these types:

### 1. Historical photograph
An authentic photograph made in or near the period depicted.

Display label:
`Historical photograph`

### 2. Document / map scan
A scan of a historical primary or secondary document.

Display label:
`Historical document` or `Historical map`

### 3. Modern artifact photograph
A modern photograph of a surviving historical object, building or document.

Display label:
`Photographed [year] — historical artifact`

### 4. AI reconstruction
A generated visual created because no authentic image exists.

Mandatory nearby label:
`Historical reconstruction — AI-generated from documented sources; not an original photograph.`

## Rules

- Never put AI reconstructions in the `Historical photographs` gallery filter.
- Never apply fake scratches/sepia processing to make an AI image look deceptively archival.
- Never remove an archive watermark or attribution.
- Never publish an HTHS image without permission unless HTHS explicitly releases it under terms that allow reuse.
- For LAC material, inspect the individual catalogue item's copyright/reproduction conditions before production use.
- Retain full provenance in metadata even if the front-end displays a shorter credit.
- Prefer an authentic mediocre photograph over a beautiful but fictional reconstruction.
- Modern photography of the surviving Le Havre artifacts should be treated as a major visual priority.

## Recommended metadata

```ts
type HistoryImage = {
  id: string
  title: string
  dateLabel?: string
  imageType:
    | "historical_photo"
    | "document_scan"
    | "map"
    | "modern_artifact_photo"
    | "ai_reconstruction"
  sourceInstitution: string
  sourceIdentifier?: string
  rightsStatus: "cleared" | "permission_required" | "rights_check_required" | "lodge_owned"
  creditLine: string
  caption: string
  alt: string
  localPath?: string
  sourceUrl?: string
}
```
