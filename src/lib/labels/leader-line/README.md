# `labels/leader-line/`

**What lives here:** The leader-line React cluster — `LeaderLine`, `LeaderLineUnderlay`, `LeaderLineContext`, `LabelLeaderLineRegistrar`, `useLeaderLineRegistration`. Kinds: component, hook, provider.

**Layer + dependency rule:** Nested under `labels/`. May import `@prc/charting-utilities` (including `labelLayout/`), `primitives/`. Must **not** import `overlays/`, `charts/`, or `controller/`.

**Admission test:** Is it part of the leader-line rendering/context layer (not pure compute)? If yes, here — pure compute belongs in `@prc/charting-utilities/labelLayout/`.
