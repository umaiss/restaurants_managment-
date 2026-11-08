/** The chosen options of a line as one line of text, in the order they were chosen: "Large, Extra cheese, No onions" (BR2.3, BR9.1). */
export function optionsText(options: ReadonlyArray<{ label: string }> | undefined | null): string {
  return (options ?? []).map((o) => o.label).join(', ');
}
