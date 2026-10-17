# Adapters are registered by name and chosen explicitly

A component declaration names the adapter that mounts it (`adapter: 'vue'` or `adapter: 'react'`). The Core Instance only knows adapters that were registered with `useAdapter`. An unknown name or a duplicate registration name fails before that batch starts. Makoo does not infer the adapter from the component's shape, from a filename, or from a CLI suffix.

Explicit choice was kept because one project can mount both Vue and React, and a guess that is wrong fails at mount time on the page instead of at configuration time.

## Considered Options

- Detect Vue versus React from the component value. Rejected: the two component shapes are not a reliable signal, and a mixed project would need a tie-break anyway.
- Infer the adapter from a project suffix or from the scaffold framework. Rejected: the scaffold already knows the framework and can write `adapter` into the entry. Inference would hide that choice from later edits.

## Consequences

- Every `inject()` that mounts a component must set `adapter` to a name already passed to `useAdapter`.
- Adding another framework means a new adapter package and an explicit `useAdapter` call, not a new detection rule in core.
