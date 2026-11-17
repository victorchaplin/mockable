/**
 * Layout archetypes are the divergence axis for proposal generation (design
 * D4). Pure data so both the server prompts and the pick-grid UI can share it.
 */

export type LayoutArchetypeId =
  | "sidebar-shell"
  | "top-nav-cards"
  | "dashboard-grid"
  | "wizard-stepper"
  | "master-detail";

export type LayoutArchetype = {
  id: LayoutArchetypeId;
  label: string;
  directive: string;
};

export const LAYOUT_ARCHETYPES: LayoutArchetype[] = [
  {
    id: "sidebar-shell",
    label: "Sidebar shell",
    directive:
      "Use a persistent left sidebar for primary navigation and a wide main content area to the right. The sidebar carries the product name and section links; the main area carries the page content.",
  },
  {
    id: "top-nav-cards",
    label: "Top nav + cards",
    directive:
      "Use a horizontal top navigation bar with the product name, links, and a primary action, then a page body built from a card grid with a clear hero or heading above it.",
  },
  {
    id: "dashboard-grid",
    label: "Dashboard grid",
    directive:
      "Use a dense dashboard grid of panels and widgets arranged in a responsive multi-column grid, with compact headings and numeric or status summaries in each panel.",
  },
  {
    id: "wizard-stepper",
    label: "Wizard / stepper",
    directive:
      "Use a centered, focused layout with a numbered horizontal or vertical stepper and one primary form card for the current step, with clear Back/Continue actions.",
  },
  {
    id: "master-detail",
    label: "Master-detail",
    directive:
      "Use a two-pane master-detail layout: a scrollable list/queue pane on the left and a detail pane for the selected item on the right, with the selection visually highlighted.",
  },
];

const ARCHETYPE_BY_ID = new Map(
  LAYOUT_ARCHETYPES.map((archetype) => [archetype.id, archetype]),
);

export function getArchetype(
  id: string | undefined,
): LayoutArchetype | undefined {
  return id ? ARCHETYPE_BY_ID.get(id as LayoutArchetypeId) : undefined;
}

export function archetypeLabel(id: string): string {
  return getArchetype(id)?.label ?? id;
}
