/**
 * Type shim for the Preact (frontend) build.
 *
 * Runtime correctness comes from the webpack aliases in webpack.config.js
 * (`react` -> `preact/compat`, `react-dom` -> `preact/compat`,
 * `react-dom/client` -> `preact/compat`, `react/jsx-runtime` ->
 * `preact/jsx-runtime`). This file exists so the project's TypeScript
 * tooling can opt in to typechecking the Preact build against `preact/compat`
 * surface types instead of `react`'s.
 *
 * Editor build typecheck (default `tsc` invocation): uses tsconfig.json which
 * EXCLUDES this file — React types win and the editor source typechecks
 * normally.
 *
 * Preact build typecheck (follow-up: tsconfig.preact.json + `tsc -p ...`):
 * INCLUDES this file alongside `compilerOptions.paths` overrides so that
 * `from 'react'` resolves to `preact/compat`'s typings.
 *
 * Today this file is intentionally inert (a single empty export to make it a
 * module). Slice 2 only needs the webpack/babel aliases for runtime
 * correctness; the dedicated Preact-build typecheck is a follow-up.
 */

export {};
