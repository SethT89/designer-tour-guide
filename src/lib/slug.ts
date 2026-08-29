/** Short random suffix that keeps generated slugs unique. */
export function shortId(): string {
  return crypto.randomUUID().slice(0, 8);
}
