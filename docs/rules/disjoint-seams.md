# Disjoint seams

Each agent owns a slice of the tree. A conflict escalates to the lead — it never clobbers a neighbour's work, and shared files are staged hunk by hunk.

**Why it exists.** Several sessions share one working tree. `git add -A` from any one of them sweeps every other session's half-finished work into a commit nobody reviewed. The seam contract is what makes parallel terminals safe rather than merely fast.

**How to apply.** Work only inside the OWNS list in your tranche brief. Stage by explicit pathspec, and run `git diff --cached --name-only` immediately before every commit to confirm what you are about to write. A file you need that belongs to someone else is a message to the lead, not an edit.
