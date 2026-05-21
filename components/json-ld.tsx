/**
 * Emits a JSON-LD <script> for structured data (SEO).
 *
 * The serialized JSON is hardened by escaping "<" to its unicode form, which
 * prevents any "</script>" sequence inside string values from breaking out of
 * the script element. This is the standard, safe way to inline JSON-LD in
 * React/Next, and keeps OSM-sourced store names (which can contain "&" or "<")
 * from corrupting the document or enabling injection.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
