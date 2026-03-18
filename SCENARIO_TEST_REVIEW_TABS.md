# Review Changes Tab Switching Scenario Test

## Purpose
Verify that the `Review Changes` section correctly switches between filing status tabs after extraction, and that each tab shows the matching diff panel.

## Test Type
Manual scenario test

## Scope
- Diff tab rendering
- Diff tab click handling
- Panel activation for multiple filing statuses
- Oregon `Single` and `Joint` review panels

## Preconditions
- The app starts successfully.
- A valid OpenAI API key is saved in Settings.
- State is set to `Oregon`.
- The OR JSON file paths are configured.
- The three Oregon 2024 screenshots from the OR extraction scenario are available.
- Extraction completes successfully and produces diffs for both `Single` and `Joint`.

## Test Data
Use the same three Oregon screenshots defined in [SCENARIO_TEST_OR_2024.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_OR_2024.md).

## Steps
1. Launch the app.
2. Select state `Oregon`.
3. Upload the three OR 2024 screenshots.
4. Run extraction until the `Review Changes` section appears.
5. Confirm the `Single` tab is selected by default.
6. Observe the changed-count badge for `Single`.
7. Click the `Joint` tab.
8. Verify the `Joint` tab becomes active.
9. Verify the `Joint` diff panel is shown.
10. Verify the changed-count badge for `Joint` matches the displayed panel data.
11. Verify the `Joint` panel content differs from the `Single` panel content.
12. Click back to `Single`.
13. Verify the `Single` tab becomes active again.
14. Verify the `Single` diff panel is shown again.

## Expected Results
- `Single` is the default active tab when the diff section first renders.
- Clicking `Joint` changes the active tab styling from `Single` to `Joint`.
- Clicking `Joint` hides the `Single` panel and shows the `Joint` panel.
- The `Joint` panel shows Joint values, counts, and changed rows.
- Clicking back to `Single` restores the `Single` panel.
- No console errors or UI freezes occur while switching tabs.

## Specific Assertions
- Only one `.diff-tab` has the `active` class at a time.
- Only one `.diff-panel` has the `active` class at a time.
- The active tab and active panel always refer to the same filing status key.
- The badge count displayed beside `Joint` is not just decorative; the visible panel must also be the `Joint` panel.
- Switching tabs does not rerun extraction or alter the underlying diff data.

## Pass Criteria
The scenario passes if all of the following are true:
- `Joint` becomes active when clicked.
- The visible panel changes to `Joint`.
- Switching back to `Single` works.
- The visible data matches the selected tab each time.

## Failure Examples
The scenario fails if any of the following occur:
- Clicking `Joint` does nothing.
- The badge exists for `Joint` but the `Single` panel remains visible.
- The active underline/highlight changes but the panel does not.
- The panel changes but the wrong tab stays active.
- More than one panel is visible at once.

## Notes
- This scenario specifically covers the regression where the `Joint` tab displayed a badge count but did not switch the visible review panel.
- This should be rerun whenever the diff rendering or tab wiring changes.
