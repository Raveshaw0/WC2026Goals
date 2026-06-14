// A fixed, darkened celebration photo behind the page. Content cards are opaque
// (`bg-card`), so legibility is unaffected; the photo shows in the margins and
// gaps. The overlay is a vertical gradient: darker at the top (behind the
// header) and bottom, lighter through the middle band so the scorer stays
// visible. Sits at -z-10, below all content but above the body background.
export function PhotoBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: "url(/irakunda.jpg)",
          backgroundPosition: "50% 35%",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(16,20,24,0.88) 0%, rgba(16,20,24,0.72) 42%, rgba(16,20,24,0.92) 100%)",
        }}
      />
    </div>
  );
}
