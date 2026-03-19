# OR 2024 PDF Extraction Scenario Test

## Purpose
Verify that the app can extract the full Oregon 2024 OR-40 tax table from the instruction PDF using the deterministic PDF parser, and produce correct values for both Oregon filing-status columns.

## Test Type
Manual scenario test

## State Under Test
- State: Oregon (`OR`)
- Form: OR-40
- Filing status columns:
  - `S` = Single / Married Filing Separately
  - `J` = Married Jointly / Head of Household / Surviving Spouse

## Test Data
Use the Oregon instruction PDF for 2024:
- `OR-40 Instructions Final Rev 12-13-24 (5).pdf`

Expected tax table page range:
- `26-28`

## Preconditions
- The app starts successfully.
- State is set to `Oregon`.
- The OR JSON file paths are configured.
- The Oregon instruction PDF is available locally.
- The tester knows the correct PDF page range is `26-28` and will enter it manually.

## Steps
1. Launch the app.
2. Select state `Oregon`.
3. Select tax year `2024`.
4. Click `Select PDF`.
5. Choose the Oregon instruction PDF.
6. Enter page range `26-28`.
7. Click `Extract Data from PDF`.
8. Wait for extraction and diff review to complete.
9. Open the review tabs for `Single` and `Joint`.
10. Verify the extraction summary and checkpoint values below.

## Expected Results
- Extraction completes without an error toast.
- No conflicting-merge error occurs.
- The review section appears for both Oregon filing statuses.
- The extracted values match the Oregon 2024 instruction PDF.

## Expected Coverage
Expected lower-boundary keys for OR 2024:
- `0`
- `20`
- `50`
- `100` through `49,900` in increments of `100`

Expected row count per filing status:
- `502` rows for `S`
- `502` rows for `J`

## Checkpoint Assertions
Verify these extracted values are represented correctly in the review/update output:

### Beginning of table
- `0` -> `S=0`, `J=0`
- `20` -> `S=2`, `J=2`
- `50` -> `S=4`, `J=4`
- `100` -> `S=7`, `J=7`

### Early-page checkpoints
- `4,000` -> `S=192`, `J=192`
- `9,000` -> `S=525`, `J=439`
- `14,000` -> `S=928`, `J=777`
- `18,900` -> `S=1357`, `J=1108`

### Middle-page checkpoints
- `19,000` -> `S=1365`, `J=1114`
- `24,000` -> `S=1803`, `J=1503`
- `29,000` -> `S=2240`, `J=1941`
- `34,000` -> `S=2678`, `J=2378`
- `38,900` -> `S=3107`, `J=2807`

### Final-page checkpoints
- `39,000` -> `S=3115`, `J=2816`
- `42,000` -> `S=3378`, `J=3078`
- `45,000` -> `S=3640`, `J=3341`
- `47,900` -> `S=3894`, `J=3594`
- `49,900` -> `S=4069`, `J=3769`

## Pass Criteria
The scenario passes if all of the following are true:
- Extraction finishes successfully from the PDF.
- Coverage reaches `49,900`.
- The checkpoint values above match exactly.
- The review tabs for `Single` and `Joint` render correctly.

## Failure Examples
The scenario fails if any of the following occur:
- Extraction stops with an error toast.
- The highest extracted key is less than `49,900`.
- Any checkpoint value is wrong for `S` or `J`.
- One Oregon filing-status column is copied into the other.

## Notes
- This scenario specifically covers the deterministic Oregon PDF parser.
- It should be rerun whenever the Oregon PDF parsing logic, page-range handling, or filing-status mapping changes.
- The row-count and checkpoint assertions intentionally match the 2024 OR-40 PDF table structure.
