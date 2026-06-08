import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type OpaijaEpisodeScene = {
  panelId: string;
  title: string;
  clipPath: string;
  durationInFrames: number;
};

export type OpaijaEpisodeOneProps = {
  episodeTitle: string;
  tagline: string;
  cta: string;
  audioPath: string;
  scenes: OpaijaEpisodeScene[];
};

const cream = "#fff7e9";
const gold = "#f3a712";
const orange = "#e85d04";

export const OpaijaEpisodeOne = ({ episodeTitle, tagline, cta, audioPath, scenes }: OpaijaEpisodeOneProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const titleOpacity = interpolate(frame, [0, 28, 108, 140], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(frame, [durationInFrames - 104, durationInFrames - 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let cursor = 0;

  return (
    <AbsoluteFill style={{ background: "#030303", color: cream, fontFamily: "Arial, sans-serif" }}>
      {audioPath ? <Audio src={staticFile(cleanStaticPath(audioPath))} /> : null}
      {scenes.map((scene) => {
        const from = cursor;
        cursor += scene.durationInFrames;
        return (
          <Sequence key={scene.panelId} from={from} durationInFrames={scene.durationInFrames}>
            <Shot scene={scene} />
          </Sequence>
        );
      })}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,.56), rgba(0,0,0,.08) 26%, rgba(0,0,0,.1) 70%, rgba(0,0,0,.78))",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 74,
          opacity: titleOpacity,
          textShadow: "0 12px 34px rgba(0,0,0,.75)",
        }}
      >
        <div style={{ color: gold, fontSize: 34, fontWeight: 950, textTransform: "uppercase" }}>OPAIJA</div>
        <div style={{ marginTop: 12, color: cream, fontSize: 74, fontWeight: 950, lineHeight: 0.92 }}>{episodeTitle}</div>
        <div style={{ marginTop: 20, width: 250, height: 7, background: `linear-gradient(90deg, ${orange}, ${gold})` }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          bottom: 68,
          opacity: ctaOpacity,
          display: "grid",
          gap: 16,
          textShadow: "0 10px 30px rgba(0,0,0,.72)",
        }}
      >
        <div style={{ color: cream, fontSize: 52, fontWeight: 900, lineHeight: 1.02 }}>{tagline}</div>
        <div
          style={{
            justifySelf: "start",
            padding: "18px 24px",
            background: `linear-gradient(90deg, ${orange}, ${gold})`,
            color: "#130903",
            fontSize: 31,
            fontWeight: 950,
            textTransform: "uppercase",
          }}
        >
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Shot = ({ scene }: { scene: OpaijaEpisodeScene }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, scene.durationInFrames], [1.02, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = interpolate(frame, [0, 8, scene.durationInFrames - 10, scene.durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <OffthreadVideo
        src={staticFile(cleanStaticPath(scene.clipPath))}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          filter: "saturate(1.08) contrast(1.05)",
        }}
      />
    </AbsoluteFill>
  );
};

function cleanStaticPath(value: string) {
  return value.replace(/^\/+/, "");
}
