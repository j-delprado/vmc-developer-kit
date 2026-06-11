/** One tasteful confetti burst (from the approved design). Renders absolutely inside a relative parent. */
export default function Confetti({ burstKey }: { burstKey: string }) {
  const colors = ["#B08D3E", "#1B7F5C", "#10283F", "#D8B872"];
  const pieces = [];
  for (let i = 0; i < 26; i++) {
    const left = (i * 37) % 100;
    const delay = (i % 7) * 60;
    const duration = 900 + (i % 5) * 240;
    const width = 6 + (i % 3) * 2;
    pieces.push(
      <span
        key={`${burstKey}-${i}`}
        style={{
          position: "absolute",
          top: "10%",
          left: `${left}%`,
          width: `${width}px`,
          height: `${width + 3}px`,
          background: colors[i % colors.length],
          borderRadius: "1px",
          opacity: 0,
          animation: `abcConfetti ${duration}ms ease-out ${delay}ms forwards`,
        }}
      />,
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
      {pieces}
    </div>
  );
}
