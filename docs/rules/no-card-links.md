# Cards carry no inline links

A card in the ecosystem column has no small teal word in its corner. If a card is actionable, the whole card is the target, or the kebab holds the action.

**Why it exists.** A link inside a clickable card creates two targets in one object and makes neither obvious: the card's own click has to guard against the link's, the link is a ~60px hit area in a 370px surface, and the eye reads the teal word as the action while the other 95% of the card is silently also an action. It also fails uniformity — a card whose footer link only appears for some rows has a footer that changes shape row to row.

The rule is written down because it was given twice. The `powers` links came out of the Data cards on 2026-07-20, and the same pattern went straight back into the Insurers cards in the next tranche of the same session. A one-off deletion does not survive the next builder; a rule does.

**How to apply.** Building a card in `/workspace` (or any card grid that follows it):

- Need the card to go somewhere? Put it on the card: `onOpen` on `LibraryCard`, or a `role="button"` wrapper. One object, one target.
- Need more than one action? Use `KebabMenu` + `MenuItem` top-right. `LibraryCard` already stops the kebab's clicks from reaching the card.
- Need to show an identifier or a category in the footer? Use plain text, mono for identifiers, and a `Tag` for a category. Not a link.
- A destination that only *some* rows have is a sign the destination belongs on a detail surface, not in a grid footer.

`TextLink` remains correct in prose, in table cells, and in section asides — this rule is about cards.
