import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type OpaijaShortProps = {
  title: string;
  hook: string;
  captionLines: string[];
  characterImage: string;
  generatedClipPath?: string;
  audioPath?: string;
  category: string;
};

const gold = "#f3a712";
const orange = "#e85d04";
const red = "#bc2b21";
const teal = "#0b6f6f";
const cream = "#fff7e9";

export const OpaijaShort = ({
  title,
  hook,
  captionLines,
  characterImage,
  generatedClipPath,
  audioPath,
  category,
}: OpaijaShortProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const imageScale = interpolate(frame, [0, durationInFrames], [1.08, 1.24]);
  const imageX = interpolate(frame, [0, durationInFrames], [-42, 28]);
  const imageY = Math.sin(frame / 18) * 10;
  const imageRotate = Math.sin(frame / 42) * 0.7;
  const titleLift = interpolate(frame, [8, 52], [54, 0], { extrapolateRight: "clamp" });
  const glow = interpolate(frame % 72, [0, 36, 72], [0.28, 0.72, 0.28]);
  const slashX = interpolate(frame % 96, [0, 32, 96], [-520, 1180, 1180]);
  const pulseScale = interpolate(frame % 48, [0, 24, 48], [0.92, 1.08, 0.92]);

  return (
    <AbsoluteFill style={{ background: "#050505", color: cream, fontFamily: "Arial, sans-serif" }}>
      {audioPath ? <Audio src={staticFile(audioPath)} /> : null}
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(circle at 52% 32%, rgba(243, 167, 18, ${glow}), transparent 30%), ` +
            "linear-gradient(180deg, #050505 0%, #171009 54%, #052120 100%)",
        }}
      />
      {generatedClipPath ? (
        <Video
          src={staticFile(generatedClipPath)}
          muted
          loop
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(1.12) contrast(1.08)",
          }}
        />
      ) : (
        <Img
          src={staticFile(characterImage)}
          style={{
            position: "absolute",
            left: -520,
            top: 252,
            width: 2120,
            height: 1192,
            objectFit: "cover",
            transform: `translate(${imageX}px, ${imageY}px) scale(${imageScale}) rotate(${imageRotate}deg)`,
            filter: "saturate(1.12) contrast(1.05)",
          }}
        />
      )}
      {!generatedClipPath ? (
        <>
          <div
            style={{
              position: "absolute",
              left: slashX,
              top: 770,
              width: 620,
              height: 10,
              background: `linear-gradient(90deg, transparent, ${gold}, ${orange}, transparent)`,
              boxShadow: `0 0 42px ${gold}`,
              transform: "rotate(-18deg)",
              opacity: 0.78,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 112,
              top: 608,
              width: 168,
              height: 168,
              border: `7px solid rgba(243, 167, 18, ${glow})`,
              borderRadius: "50%",
              transform: `scale(${pulseScale})`,
              boxShadow: `0 0 52px rgba(243, 167, 18, ${glow})`,
              opacity: 0.72,
            }}
          />
        </>
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,.66), rgba(0,0,0,.18) 34%, rgba(0,0,0,.9) 78%), " +
            "linear-gradient(90deg, rgba(0,0,0,.56), transparent 48%, rgba(0,0,0,.38))",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 82,
          left: 62,
          right: 62,
          transform: `translateY(${titleLift}px)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "12px 16px",
            border: `3px solid ${gold}`,
            color: gold,
            background: "rgba(5,5,5,.58)",
            fontSize: 29,
            fontWeight: 900,
            textTransform: "uppercase",
          }}
        >
          {category}
        </div>
        <div style={{ marginTop: 26, color: cream, fontSize: 94, fontWeight: 950, lineHeight: 0.93 }}>
          {title}
        </div>
      </div>
      <Sequence from={72}>
        <div
          style={{
            position: "absolute",
            left: 62,
            right: 62,
            bottom: 360,
            color: gold,
            fontSize: 56,
            fontWeight: 900,
            lineHeight: 1.04,
            textShadow: "0 10px 30px rgba(0,0,0,.72)",
          }}
        >
          {hook}
        </div>
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          bottom: 122,
          display: "grid",
          gap: 13,
        }}
      >
        {captionLines.slice(0, 3).map((line, index) => {
          const opacity = interpolate(frame, [104 + index * 42, 130 + index * 42], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={line}
              style={{
                opacity,
                padding: "16px 18px",
                borderLeft: `8px solid ${index === 1 ? orange : index === 2 ? teal : red}`,
                background: "rgba(5,5,5,.72)",
                color: cream,
                fontSize: 38,
                fontWeight: 850,
                lineHeight: 1.12,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          bottom: 50,
          display: "flex",
          justifyContent: "space-between",
          color: gold,
          fontSize: 24,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        <span>Rhythm. Roots. Resistance.</span>
        <span>opaija.com</span>
      </div>
    </AbsoluteFill>
  );
};
