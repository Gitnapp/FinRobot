# @gitnapp/ui

Import components from `@gitnapp/ui/components/ui/<name>`.
Import `@gitnapp/ui/patterns.css` once for the composed layout/navigation/value patterns. Your Tailwind build must scan this package's source, alongside design-tokens.

New in 0.3.0:
- `DateRangePicker`: controlled `{from,to}` ISO dates, up to four presets, two date clicks commit a custom range.
- `EditableValue`: read-only first; click opens one input, blur/Enter commits, Escape cancels. Application validates and persists the value.
- `ValueOrigin`: generated/manual provenance; hover or focus exposes Undo for manual values, `onReset` remains application-owned.
- `CardGrid`, `MetricGrid`, `ReadingLayout`: fluid equal-height grids, stable empty fields, responsive reading layout.
- `SectionNavigation`: controlled active section, compact dot rail and mobile section chooser; pair with `ReadingLayout`. Target sections should have matching IDs and `tabIndex={-1}`.
- `LoadingScope`/`LoadingState`: one shared indicator for nested loading regions; background refresh should retain existing content.
- `InfoLabel`/`InfoHint`: shared icon alignment and keyboard-accessible descriptions.

No provider, finance, routing or persistence logic is embedded. `design.md` is included in the package as the release's design contract.
