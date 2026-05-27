// Renders a JSON-LD structured-data block. Server component — emitted inline in
// the page <head>/body for search engines (Google Rich Results, etc.).
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; we escape `<` to avoid any HTML
      // parser confusion inside the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
