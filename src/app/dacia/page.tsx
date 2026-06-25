export default function DaciaPage() {
  return (
    <div style={{ background: "#000", position: "fixed", inset: 0 }}>
      <video
        src="/video.mov"
        autoPlay
        loop
        muted
        playsInline
        controls
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
