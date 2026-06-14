interface TunerPendulumProps {
  cents: number; // -50 to +50, 0 = perfectly in tune
}

const CENTER_X = 180;
const CENTER_Y = 185;
const NEEDLE_LENGTH = 128;
const IN_TUNE_THRESHOLD = 5; // ±5 cents counts as "in tune"

export default function TunerPendulum({ cents }: TunerPendulumProps) {
  const clamped = Math.max(-50, Math.min(50, cents ? cents : 0));
  const inTune = Math.abs(clamped) <= IN_TUNE_THRESHOLD;

  // Map -50..+50 cents to -90deg..+90deg (needle sweep)
  const angleDeg = (clamped / 50) * 90;
  const angleRad = (angleDeg - 90) * (Math.PI / 180); // -90 = pointing up

  const needleX = CENTER_X + NEEDLE_LENGTH * Math.cos(angleRad);
  const needleY = CENTER_Y + NEEDLE_LENGTH * Math.sin(angleRad);

  const needleColor = inTune ? "#3F7A53" : "#1C1A15";

  return (
    <svg
      viewBox="0 0 360 200"
      width="100%"
      style={{ maxWidth: 380 }}
      role="img"
      aria-label={`Tuning gauge, ${clamped} cents ${clamped === 0 ? "in tune" : clamped > 0 ? "sharp" : "flat"}`}
    >
      {/* background arc */}
      <path
        d="M47.6 114.6 A150 150 0 0 1 312.4 114.6"
        fill="none"
        stroke="#DCD3C0"
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* in-tune zone highlight */}
      <path
        d="M161.7 36.1 A150 150 0 0 1 198.3 36.1"
        fill="none"
        stroke="#3F7A53"
        strokeWidth={6}
        strokeLinecap="round"
      />

      {/* tick marks */}
      <g stroke="#B8AE99" strokeWidth={2}>
        <line x1="65.7" y1="87.8" x2="74.9" y2="95.6" />
        <line x1="89.3" y1="65.5" x2="96.6" y2="75.1" />
        <line x1="117.1" y1="48.8" x2="122.1" y2="59.7" />
        <line x1="147.8" y1="38.5" x2="150.4" y2="50.2" />
        <line x1="212.2" y1="38.5" x2="209.6" y2="50.2" />
        <line x1="242.9" y1="48.8" x2="237.9" y2="59.7" />
        <line x1="270.7" y1="65.5" x2="263.4" y2="75.1" />
        <line x1="294.3" y1="87.8" x2="285.1" y2="95.6" />
      </g>

      {/* end + center major ticks */}
      <g stroke="#1C1A15" strokeWidth={2.5}>
        <line x1="47.6" y1="114.6" x2="65.2" y2="124.0" />
        <line x1="180" y1="35" x2="180" y2="55" />
        <line x1="312.4" y1="114.6" x2="294.8" y2="124.0" />
      </g>

      {/* flat / sharp labels */}
      <text x="40" y="138" fontSize="17" fill="#8A8170">
        ♭
      </text>
      <text x="312" y="138" fontSize="17" fill="#8A8170">
        ♯
      </text>

      {/* needle */}
      <line
        x1={CENTER_X}
        y1={CENTER_Y}
        x2={needleX}
        y2={needleY}
        stroke={needleColor}
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{ transition: "x2 0.15s ease-out, y2 0.15s ease-out, stroke 0.2s" }}
      />

      {/* pivot */}
      <circle cx={CENTER_X} cy={CENTER_Y} r={8.5} fill="#1C1A15" />
      <circle cx={CENTER_X} cy={CENTER_Y} r={3.5} fill="#F4EFE2" />
    </svg>
  );
}
