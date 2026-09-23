/** Minimum rows shown per page anywhere in the app (see Pagination.tsx). */
export const MIN_PAGE_SIZE = 6;

export const PAGE_SIZE_OPTIONS = [6, 12, 24, 48] as const;

/** Clamps `page` into [1, max(1, ceil(total/pageSize))]. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  return Math.min(Math.max(1, page), pageCount);
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = clampPage(page, items.length, pageSize);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Builds a compact list of page numbers to render, e.g. [1, 2, "...", 203]
 * (the "Showing 1–10 of 2027" style pagination). Always includes the first
 * and last page, the current page, and one neighbour on each side.
 */
export function pageNumbers(current: number, pageCount: number): Array<number | "..."> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, pageCount, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: Array<number | "..."> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...");
    out.push(sorted[i]);
  }
  return out;
}