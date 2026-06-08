import { Composition, Folder } from "remotion";
import { OpaijaEpisodeOne } from "./compositions/OpaijaEpisodeOne";
import { OpaijaShort } from "./compositions/OpaijaShort";
import { OpaijaTeaser } from "./compositions/OpaijaTeaser";

export const RemotionRoot = () => {
  return (
    <Folder name="Opaija">
      <Composition
        id="OpaijaTeaser"
        component={OpaijaTeaser}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "OPAIJA",
          subtitle: "Every Island Has a Warrior. Every Rhythm Has a Weapon.",
          cta: "Join the founder list",
          url: "opaija.com",
          characterImage: "assets/characters/kairo-kai-baptiste.png",
          audioPath: "",
        }}
      />
      <Composition
        id="OpaijaShort"
        component={OpaijaShort}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "Every Island Has a Warrior",
          hook: "The rhythm is not background. It is the weapon.",
          captionLines: [
            "A stick has memory.",
            "A fighter has spirit.",
            "The gayelle binds them together.",
          ],
          characterImage: "assets/characters/kairo-kai-baptiste.png",
          generatedClipPath: "",
          audioPath: "",
          category: "OPAIJA LORE",
        }}
      />
      <Composition
        id="OpaijaEpisodeOne"
        component={OpaijaEpisodeOne}
        durationInFrames={2250}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          episodeTitle: "The First Pulse",
          tagline: "The rhythm has awakened.",
          cta: "Watch OPAIJA at opaija.com",
          audioPath: "",
          scenes: [],
        }}
      />
    </Folder>
  );
};
