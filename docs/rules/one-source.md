# One source per fact

The table registry, the CPT labels, the coverage cohort — each has exactly one home, so no two surfaces can quietly disagree.

**Why it exists.** The moment a figure is computed in two places, the two places drift, and the product starts contradicting itself in front of the person who trusts it least. Duplication of logic is a bug with a delay fuse.

**How to apply.** Derived numbers live in a repo function or a materialized view, never in a component. If a second surface needs the figure, it imports the same function. If two surfaces disagree today, that is a defect to file, not a rounding difference to explain. The data dictionary at `/workspace/data-dictionary` names where each fact lives.
