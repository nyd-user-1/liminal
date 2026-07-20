# Plain-column unique index

A materialized view refreshed without blocking needs a unique index on plain columns — an expression index silently breaks the concurrent refresh.

**Why it exists.** Postgres accepts the expression index without complaint and then refuses the concurrent refresh at run time, in the middle of the night, in a job nobody is watching. The failure is silent at definition and loud only where it costs the most.

**How to apply.** Materialize the expression into a real column and index that column. Confirm the refresh actually runs concurrently before you consider the migration finished — a matview that can only be refreshed with a lock will take the surfaces down with it.
