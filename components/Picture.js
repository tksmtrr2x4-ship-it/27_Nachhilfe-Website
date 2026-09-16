// <picture> mit AVIF/WebP und klassischem Fallback, festen Abmessungen (kein
// Layout-Springen) und steuerbarem Laden: oberhalb des sichtbaren Bereichs
// loading="eager", darunter "lazy". Funktioniert in Server- und
// Client-Komponenten (keine Hooks).
export default function Picture({ image, alt, className, loading = "lazy", fetchPriority, decorative = false }) {
  if (!image) return null;
  return (
    <picture>
      {image.avif ? <source srcSet={image.avif} type="image/avif" /> : null}
      {image.webp ? <source srcSet={image.webp} type="image/webp" /> : null}
      <img
        src={image.src}
        width={image.width}
        height={image.height}
        alt={decorative ? "" : alt}
        aria-hidden={decorative ? "true" : undefined}
        className={className}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
      />
    </picture>
  );
}
