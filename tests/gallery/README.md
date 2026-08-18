# Demo state for the gallery

One file per component, named `<Component>.json`, holding the state its slide is captured from. A component
with no file here is captured from `{}` — whatever its `from_text` builds when it is given nothing.

**Each file carries a `shows` marker, and that is the point of the format.** `from_text` FALLS BACK when it
does not recognise a field, so a state that drifts from the component — a renamed field, a changed shape —
would produce a slide of the default view and look deliberate. The marker is a string that must appear in
the rendered page, so a drifted state fails loudly instead of quietly showing something else.
