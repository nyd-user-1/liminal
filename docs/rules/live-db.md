# The database is live

A LIVE Neon URL may sit in `.env.local`. No destructive write without a reversible map, and clean up any rows a test creates — production is one connection string away.

**Why it exists.** There is no staging tier standing between a local terminal and the real data. The safety here is procedural, not architectural, which means it holds exactly as long as everyone keeps holding it.

**How to apply.** Read before you write. Know how to undo a migration before you apply it. Delete the rows your test created in the same session that created them, and never log PHI on the way past.
