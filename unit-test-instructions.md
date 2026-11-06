# Unit-Scoped Test Command — U2 `u2-diner-screens`

Run from the worktree root (not the project main folder):

```
npx vitest run --reporter=verbose src/client/screens/diner src/client/hooks/useTableSSE.ts src/client/hooks/useCart.ts src/client/components/diner
```

The full test suite (all units) is run via `npm test` from the worktree root.

The swarm check command (run from main folder):

```
aidlc engine swarm check u2-diner-screens --show-output
```
