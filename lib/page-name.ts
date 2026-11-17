/**
 * Page-name helpers shared by the DB layer and client components.
 * Page names are canonical slugs because they are used verbatim in
 * `page://<name>` links inside generated mocks.
 */

export const MAX_PAGE_NAME_LENGTH = 60;

export function canonicalPageName(input: string): string {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/^page:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_PAGE_NAME_LENGTH);
  return name || "page";
}

export function titleFromPageName(name: string): string {
  return canonicalPageName(name)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
