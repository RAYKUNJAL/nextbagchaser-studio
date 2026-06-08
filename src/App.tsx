import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  Archive,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock3,
  Command,
  FileUp,
  Download,
  FolderKanban,
  Gift,
  Gauge,
  Image,
  Layers3,
  Megaphone,
  KeyRound,
  Play,
  Shirt,
  Radio,
  RefreshCw,
  Search,
  ServerCog,
  Sparkles,
  WandSparkles,
  Trash2,
  Users,
  Zap,
  Mail,
} from "lucide-react";
import { agents } from "./data/agents";
import {
  bookEngineStages,
  bookFormats,
  bookMetrics,
  digitalPassTiers,
  episodeBookProducts,
  kdpPresets,
  kdpRules,
  paidReaderFeatures,
  reuseRules,
} from "./data/books";
import { characters, type Character } from "./data/characters";
import { actionSceneStandard, fxAgents, fxMetrics, fxPillars } from "./data/fx";
import {
  complianceRules,
  contentPillars,
  growthAgents,
  growthLoops,
  growthMetrics,
  launchPlan,
  leadMagnets,
} from "./data/growth";
import { merchAgents, merchMetrics, merchPipeline, merchProducts, storeSections } from "./data/merch";
import { memoryRules, pipeline, releaseTargets } from "./data/workflows";
import { OpaijaMotionHero } from "./components/OpaijaMotionHero";

type View =
  | "command"
  | "setup"
  | "api-keys"
  | "projects"
  | "assets"
  | "characters"
  | "agents"
  | "pipeline"
  | "books"
  | "fx"
  | "video-agent"
  | "merch"
  | "growth";

const navItems: Array<{ id: View; label: string; icon: typeof Command }> = [
  { id: "command", label: "Command", icon: Command },
  { id: "setup", label: "Setup", icon: ServerCog },
  { id: "projects", label: "Projects", icon: FileUp },
  { id: "api-keys", label: "API Keys", icon: KeyRound },
  { id: "assets", label: "Files", icon: Archive },
  { id: "characters", label: "Characters", icon: Users },
  { id: "agents", label: "Agents", icon: Brain },
  { id: "pipeline", label: "Pipeline", icon: FolderKanban },
  { id: "growth", label: "Growth", icon: Megaphone },
  { id: "video-agent", label: "Video Builder", icon: Clapperboard },
  { id: "fx", label: "FX", icon: WandSparkles },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "merch", label: "Merch", icon: Shirt },
];

const statusLabels: Record<Character["status"], string> = {
  locked: "Sheet loaded",
  "needs-bible": "Needs bible",
  "needs-model-sheet": "Needs model sheet",
};

const adminSessionKey = "opaija_admin_session";

function getAdminHeaders(extra: HeadersInit = {}) {
  const token = window.localStorage.getItem(adminSessionKey);
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function App() {
  if (window.location.pathname.startsWith("/hero-prototype")) {
    return <OpaijaMotionHero />;
  }

  if (window.location.pathname === "/blog" || window.location.pathname === "/blog/") {
    return <BlogIndexPage />;
  }

  if (window.location.pathname.startsWith("/blog/")) {
    return <BlogPostPage slug={window.location.pathname.replace(/^\/blog\//, "").replace(/\/$/, "")} />;
  }

  const isAdminRoute =
    window.location.pathname.startsWith("/command") ||
    window.location.pathname.startsWith("/admin") ||
    window.location.pathname.startsWith("/login");
  return isAdminRoute ? <CommandCenter /> : <PublicSite />;
}

function CommandCenter() {
  const [authStatus, setAuthStatus] = useState<"checking" | "ready" | "login" | "error">("checking");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeView, setActiveView] = useState<View>(getInitialCommandView());
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(characters[0]);
  const [agentFilter, setAgentFilter] = useState("All");
  const [queueMode, setQueueMode] = useState("Bible Build");

  const filteredAgents = useMemo(() => {
    if (agentFilter === "All") return agents;
    return agents.filter((agent) => agent.team === agentFilter);
  }, [agentFilter]);

  const lockedCount = characters.filter((character) => character.status === "locked").length;

  useEffect(() => {
    fetch("/api/admin/session", { headers: getAdminHeaders() })
      .then((response) => response.json())
      .then((data: { required: boolean; authenticated: boolean; ownerEmail?: string }) => {
        if (data.ownerEmail) setAdminEmail(data.ownerEmail);
        setAuthStatus(data.authenticated ? "ready" : "login");
      })
      .catch(() => setAuthStatus("error"));
  }, []);

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      if (!response.ok) throw new Error("Invalid password");
      const data = (await response.json()) as { token?: string };
      if (data.token) window.localStorage.setItem(adminSessionKey, data.token);
      setAuthStatus("ready");
    } catch {
      setLoginError("That owner login did not unlock the studio.");
    }
  }

  function logoutAdmin() {
    window.localStorage.removeItem(adminSessionKey);
    setAdminEmail("");
    setAdminPassword("");
    setAuthStatus("login");
  }

  if (authStatus === "checking") {
    return <AdminLoginShell title="Checking command access" detail="Loading the operator session." />;
  }

  if (authStatus === "error") {
    return <AdminLoginShell title="Command access unavailable" detail="The admin session endpoint did not respond." />;
  }

  if (authStatus === "login") {
    return (
      <AdminLoginShell title="Next Bag Chaser Studio Login" detail="Log in once to manage all cartoon projects, API keys, agents, schedules, assets, and provider tests.">
        <form className="admin-login-form" onSubmit={submitAdminLogin}>
          <label>
            <span>Owner email</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="primary-action">
            <KeyRound size={18} />
            Enter Studio
          </button>
          {loginError ? <p className="gate-error">{loginError}</p> : null}
        </form>
      </AdminLoginShell>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Opaija command navigation">
        <div className="brand-lockup">
          <span className="brand-mark">O</span>
          <div>
            <strong>NBC Studio</strong>
            <span>Master Hub</span>
          </div>
        </div>

        <nav className="nav-stack">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "nav-button active" : "nav-button"}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <Radio size={18} />
          <div>
            <strong>Studio online</strong>
            <span>Shared API keys active</span>
          </div>
        </div>
        <button type="button" className="ghost-action sidebar-logout" onClick={logoutAdmin}>
          <KeyRound size={18} />
          Lock studio
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="section-label">Rhythm. Roots. Resistance.</p>
            <h1>Build the commercial content machine.</h1>
          </div>
          <div className="search-control">
            <Search size={17} />
            <span>Canon, agents, bibles, releases</span>
          </div>
        </header>

        {activeView === "command" && (
          <CommandView
            lockedCount={lockedCount}
            selectedCharacter={selectedCharacter}
            setSelectedCharacter={setSelectedCharacter}
            setActiveView={setActiveView}
          />
        )}
        {activeView === "setup" && <SetupView />}
        {activeView === "api-keys" && <ApiKeysView />}
        {activeView === "projects" && <ProjectsView />}
        {activeView === "assets" && <AssetLibraryView />}
        {activeView === "characters" && (
          <CharactersView selectedCharacter={selectedCharacter} setSelectedCharacter={setSelectedCharacter} />
        )}
        {activeView === "agents" && (
          <AgentsView agentFilter={agentFilter} setAgentFilter={setAgentFilter} filteredAgents={filteredAgents} />
        )}
        {activeView === "pipeline" && <PipelineView queueMode={queueMode} setQueueMode={setQueueMode} />}
        {activeView === "growth" && <GrowthView />}
        {activeView === "video-agent" && <VideoAgentView />}
        {activeView === "fx" && <FxView />}
        {activeView === "books" && <BookEngineView />}
        {activeView === "merch" && <MerchView />}
      </section>
    </main>
  );
}

function getInitialCommandView(): View {
  if (window.location.pathname.startsWith("/command/video")) return "video-agent";
  if (window.location.pathname.startsWith("/command/keys")) return "api-keys";
  if (window.location.pathname.startsWith("/command/projects")) return "projects";
  return "command";
}

function AdminLoginShell({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <main className="admin-login-shell">
      <section className="admin-login-panel">
        <span className="brand-mark">O</span>
        <p className="section-label">Private operator area</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {children}
      </section>
    </main>
  );
}

type LeaderboardEntry = {
  name: string;
  email: string;
  favoriteCharacter: string;
  referralCode: string;
  referralLink: string;
  referrals: number;
  clicks: number;
  instagramHandle?: string;
  socialActions?: string[];
};

type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  keywords: string[];
  publishedAt: string;
  readingMinutes: number;
  heroImage?: string;
};

type BlogPostDetail = BlogPostSummary & {
  html: string;
  sources: Array<{ title: string; url: string }>;
};

type VideoRunRecord = {
  id: string;
  title: string;
  status: "planned" | "rendered" | "queued" | "failed" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  category: string;
  outputPath?: string;
  packetPath: string;
  publicVideoPath?: string;
  sourceRunId?: string;
  characterId?: string;
  characterName?: string;
  characterImage?: string;
  socialCaption: string;
  hashtags: string[];
  reviewNote?: string;
  reviewedAt?: string;
};

type VideoAgentJobRecord = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  pid?: number;
  exitCode?: number | null;
  error?: string;
  logTail?: string;
  options: {
    characterId?: string;
    storyboardOnly?: boolean;
    clipProvider?: string;
    renderWidth?: string | number;
    renderHeight?: string | number;
    renderDurationFrames?: string | number;
  };
};

type StoryboardScene = {
  sceneId: string;
  startSec: number;
  durationSec: number;
  goal: string;
  inputImage?: string;
  imagePrompt: string;
  videoPrompt: string;
  camera: string;
  firstFrame?: string;
  lastFrame?: string;
  motionArc?: string;
  continuityLock?: string;
  continuityTags: string[];
};

type VideoRunArtifacts = {
  id: string;
  title: string;
  characterId?: string;
  characterName?: string;
  project?: {
    projectId: string;
    concept: string;
    characterName?: string;
    durationSec?: number;
    status?: string;
  } | null;
  referencePack?: {
    name: string;
    modelSheet: string;
    identityLock: string;
    motionLanguage: string[];
    wardrobeAndProps: string[];
    powerRules: string[];
    forbiddenDrift: string[];
  } | null;
  sceneManifest?: {
    durationSec: number;
    seedance?: {
      model: string;
      styleLock: boolean;
      sequencePrompt: string;
    };
    storyboard: StoryboardScene[];
  } | null;
  storyboardPanels?: {
    runtimeSeconds: number;
    panelCount: number;
    panels: Array<{
      panelId: string;
      parentShot: number;
      timecode: string;
      camera: string;
      action: string;
      emotion: string;
      fx: string;
      audio: string;
      artworkPrompt: string;
      animationPrompt: string;
    }>;
  } | null;
  storyboardPanelSheet?: string;
  storyboardContactSheet?: string;
  storyboardFrames?: Array<{
    provider: string;
    status: string;
    shotNumber: number;
    publicPath?: string;
  }> | null;
  storyboardQc?: {
    ok: boolean;
    score: number;
    checks: Array<{
      id: string;
      ok: boolean;
      severity: "blocker" | "warning";
      message: string;
      shotNumber?: number;
    }>;
  } | null;
  seedanceStoryboardPrompt?: string;
};

type EpisodeOneStudio = {
  id: string;
  title: string;
  status: "needs_fix" | "ready" | "building" | "missing";
  manifestStatus?: string;
  mode: "storyboard_studio";
  providerMode?: string;
  updatedAt?: string;
  sourceLinks: Array<{
    label: string;
    href: string;
  }>;
  stageFlow: Array<{
    id: string;
    label: string;
    status: "passed" | "current" | "blocked" | "waiting";
    summary: string;
    count?: string;
  }>;
  references: {
    status: string;
    styleSource: string;
    globalStyleLock: string;
    forbidden: string[];
    characters: Array<{
      id: string;
      name: string;
      referencePath: string;
      locks: string[];
    }>;
  };
  package: {
    providerTarget: string;
    aspectRatio: string;
    styleLock: string;
    referenceRule: string;
    masterPrompt: string;
    globalNegative: string[];
    nextStep: string;
    voiceover: string[];
  };
  editor: {
    status: "ready_for_review" | "waiting_for_clips" | "missing";
    assembler: string;
    remotionLayer: string;
    clipsAssembled: number;
    totalClips: number;
    audioAttached: boolean;
    finalVideoPath?: string;
    note: string;
  };
  finalVideo?: {
    publicPath: string;
    probe?: {
      valid: boolean;
      width?: number;
      height?: number;
      duration: number;
      size: number;
    } | null;
  };
  voice?: {
    provider?: string;
    path?: string;
    fileName?: string;
    characterCount?: number;
    quality: "rejected" | "pending" | "approved";
    note: string;
  };
  timing?: {
    status: "ready" | "timing_failed";
    targetWpm: number;
    totalDurationSec: number;
    audioDurationSec?: number;
    driftSec?: number;
    maxAudioVideoDriftSec: number;
    qcStatus: "passed" | "timing_failed" | "missing_audio" | "pending";
    panels: Array<{
      panelId: string;
      narration: string;
      wordCount: number;
      finalClipDurationSec: number;
      actionBeat: string;
    }>;
  };
  qc: {
    status: "failed" | "pending" | "passed";
    summary: string;
    blockers: string[];
    nextFixes: string[];
    forbidden: string[];
    gate: string;
  };
  frames: Array<{
    imageRef: string;
    panelId: string;
    title: string;
    characters: string[];
    prompt: string;
    motion: string;
    durationSec?: number;
    camera?: string;
    actionStart?: string;
    actionImpact?: string;
    actionEnd?: string;
    emotion?: string;
    fx?: string;
    qcGate?: string;
    imagePath?: string;
    clipPath?: string;
    clipStatus: "missing" | "queued" | "ready" | "error";
    requestId?: string;
    modelId?: string;
    error?: string;
  }>;
};

type ContentStorageItem = {
  id: string;
  title: string;
  category: "episode" | "storyboard" | "clip" | "voice" | "reference" | "social";
  status: "draft" | "needs_review" | "approved" | "rejected";
  style: string;
  createdAt: string;
  updatedAt: string;
  buildId?: string;
  episode?: string;
  notes: string[];
  assets: Array<{
    type: "video" | "audio" | "image" | "clip" | "manifest" | "props" | "source" | "timing";
    label: string;
    publicPath?: string;
    filePath?: string;
  }>;
};

type StudioProject = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  audience: string;
  tone: string;
  runtimeGoal: string;
  visualStyleNotes: string;
  publicDomain?: string;
  status:
    | "story_intake"
    | "bible_review"
    | "character_review"
    | "season_review"
    | "teaser_ready"
    | "production_ready"
    | "publishing"
    | "paused";
  createdAt: string;
  updatedAt: string;
  counts: {
    storyOutlines: number;
    characterSheets: number;
  };
  latestWorldPackPath?: string;
};

type WorldPackResponse = {
  worldPack: {
    title: string;
    status: string;
    storyBible: {
      premise: string;
      audiencePromise: string;
      tone: string;
      verticalFormat: string;
    };
    seasonOne: {
      format: string;
      episodes: Array<{ episode: number; title: string; hook: string; cliffhanger: string }>;
    };
    powerTeasers: Array<{ target: string; runtimeSec: string; purpose: string }>;
    productionReadiness: string[];
  };
  files: {
    worldPackPath: string;
    styleMemoryPath: string;
  };
};

type PowerTeaserStudio = {
  mode: "power_teaser_studio";
  title: string;
  summary: string;
  firstFormat: {
    teaserRuntimeSec: string;
    episodeRuntimeSec: string;
    compilationGoal: string;
  };
  launchCharacters: Array<{
    id: string;
    name: string;
    shortName: string;
    power: string;
    weapon: string;
    referencePath: string;
  }>;
  workflow: string[];
  activePackage?: {
    id: string;
    status: "dry_run_ready" | "needs_fix" | "approved_for_animation";
    runtimeTargetSec: {
      min: number;
      max: number;
      planned: number;
    };
    character: {
      id: string;
      name: string;
      shortName: string;
      role: string;
      power: string;
      weapon: string;
      referencePath: string;
    };
    styleLock: {
      source: string;
      summary: string;
      required: string[];
      forbidden: string[];
    };
    audioActionRules: {
      maxDriftSec: number;
      voiceStyle: string;
      rule: string;
    };
    voiceLines: string[];
    beats: Array<{
      beatId: string;
      label: string;
      startSec: number;
      endSec: number;
      durationSec: number;
      visualAction: string;
      cameraMove: string;
      impactFrame: string;
      sfx: string;
      musicHit: string;
      voiceLine: string;
      voicePlacement: string;
    }>;
    storyboardPanels: Array<{
      panelId: string;
      beatId: string;
      poseType: "start" | "impact" | "end";
      prompt: string;
      seedanceRole: string;
    }>;
    seedanceHandoff: {
      orderedReferences: Array<{
        imageRef: string;
        panelId: string;
        beatId: string;
        instruction: string;
      }>;
      masterPrompt: string;
      negativePrompt: string;
    };
    qc: {
      status: "passed" | "blocked";
      checks: Array<{
        id: string;
        status: "passed" | "blocked";
        message: string;
      }>;
    };
  };
};

type VideoAgentReadiness = {
  recommendation: string;
  stack: string[];
  liveReady: boolean;
  liveGenerationVerified: boolean;
  providers: Array<{
    id: string;
    label: string;
    status: "ready" | "missing_secret" | "dry_run" | "needs_config";
    configured: boolean;
    mode: "planning" | "keyframe" | "video" | "voice" | "editor";
    recommendation: string;
  }>;
  blockers: string[];
  verificationNote: string;
};

type ProviderSmokeTestRecord = {
  id: string;
  provider:
    | "openai-keyframe"
    | "openai-storyboard-frame"
    | "openai-sora-reference-clip"
    | "seedance-clip"
    | "seedance-reference-clip";
  status: "dry_run" | "configured" | "queued" | "created" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  liveSpendConfirmed: boolean;
  requestId?: string;
  modelId?: string;
  publicPath?: string;
  review?: {
    characterConsistency: number;
    motionQuality: number;
    artifactControl: number;
    storyClarity: number;
    costScore: number;
    speedScore: number;
    note?: string;
    reviewedAt: string;
  };
  error?: string;
};

type ProviderComparisonReport = {
  recommendation: string;
  readyForDecision: boolean;
  decisionGate: "needs_live_bakeoff" | "waiting_for_completion" | "needs_review" | "needs_tiebreaker" | "ready";
  winner?: "seedance-reference-clip" | "openai-sora-reference-clip";
  decisionQuality?: {
    minimumScore: number;
    minimumMargin: number;
    bestScore: number;
    margin: number;
  };
  generatedAt: string;
  nextStep: string;
  providers: Array<{
    id: "seedance-reference-clip" | "openai-sora-reference-clip";
    label: string;
    status: string;
    liveTested: boolean;
    artifactReady: boolean;
    artifactProbe?: {
      valid: boolean;
      width?: number;
      height?: number;
      duration: number;
      size: number;
    };
    artifactPath?: string;
    score: number;
    reviewScore?: number;
    strengths: string[];
    risks: string[];
  }>;
};

type VideoWorkflowResearchReport = {
  generatedAt: string;
  currentAnswer: string;
  recommendedStack: string[];
  providerDecision: {
    defaultProvider: "seedance";
    challengerProvider: "openai-sora";
    reason: string;
    gate: string;
  };
  workflow: Array<{
    step: string;
    owner: string;
    output: string;
  }>;
  references: Array<{
    label: string;
    url: string;
    use: string;
  }>;
};

type BakeoffPreflightReport = {
  ok: boolean;
  generatedAt: string;
  nextStep: string;
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
};

type ProviderBakeoffPacket = {
  id: string;
  createdAt: string;
  liveSpendConfirmed: boolean;
  ok: boolean;
  stage: string;
};

type VideoAgentScheduleStatus = {
  enabled: boolean;
  times: string[];
  timezone: string;
  characterId?: string;
  characterIds?: string[];
  nextCharacterId?: string;
  keyframeProvider?: string;
  clipProvider?: string;
  voiceProvider?: string;
  storyboardDirectorProvider?: string;
  storyboardFrameProvider?: string;
  storyboardOnly?: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunPid?: number;
  lastCharacterId?: string;
};

type VideoAgentDoctor = {
  ok: boolean;
  liveReady: boolean;
  liveGenerationVerified: boolean;
  bakeoffPreflight?: BakeoffPreflightReport;
  providerComparison?: {
    readyForDecision: boolean;
    decisionGate: ProviderComparisonReport["decisionGate"];
    winner?: ProviderComparisonReport["winner"];
    nextStep: string;
    providers: Array<{
      id: string;
      status: string;
      liveTested: boolean;
      artifactReady: boolean;
      score: number;
      reviewScore?: number;
    }>;
  };
  productionDecision?: VideoProductionDecision | null;
  latestBakeoffPacket?: ProviderBakeoffPacket | null;
  runs: {
    total: number;
    latest: null | {
      id: string;
      title: string;
      status: string;
      outputExists: boolean;
      publicVideoPath?: string;
      publicOutputExists: boolean;
      probe?: {
        valid: boolean;
        width?: number;
        height?: number;
        frames?: string;
        duration?: number;
        size?: number;
      } | null;
    };
    latestRendered: null | {
      id: string;
      title: string;
      status: string;
      outputExists: boolean;
      publicVideoPath?: string;
      publicOutputExists: boolean;
      probe?: {
        valid: boolean;
        width?: number;
        height?: number;
        frames?: string;
        duration?: number;
        size?: number;
      } | null;
    };
    latestStoryboard: null | {
      id: string;
      title: string;
      status: string;
      packetPath: string;
      ready: boolean;
      packetReady?: boolean;
      packetChecks?: Array<{
        id: string;
        ok: boolean;
        reason: string;
      }>;
      characterName?: string;
    };
  };
  smokeTests: {
    total: number;
    latest: null | {
      provider: string;
      status: string;
      liveSpendConfirmed: boolean;
      publicPath?: string;
    };
  };
};

type ApprovedQueueStatus = {
  ok: boolean;
  counts: {
    approved: number;
    eligible: number;
    blocked: number;
    rendered: number;
  };
  eligible: Array<{ id: string; title: string; characterName?: string }>;
  blocked: Array<{ id: string; title: string; reason: string }>;
  rendered: Array<{ id: string; title: string }>;
};

type ApprovedQueueScheduleStatus = {
  enabled: boolean;
  intervalMinutes: number;
  keyframeProvider: string;
  clipProvider: string;
  voiceProvider: string;
  storyboardFrameProvider: string;
  waitForClip: boolean;
  confirmLiveSpend: boolean;
  maxRuns: number;
  nextRunAt?: string;
  lastRunAt?: string;
  lastResult?: {
    started?: Array<{ sourceRunId: string; title: string; pid?: number }>;
    skipped?: Array<{ sourceRunId: string; title: string; reason: string }>;
  };
};

type SeasonStoryboardBatchSummary = {
  ok: boolean;
  generatedAt: string;
  count: number;
  ready: number;
  failed: number;
  results: Array<{
    characterId: string;
    characterName: string;
    ok: boolean;
    runId?: string;
    packetReady?: boolean;
    error?: string;
  }>;
};

type SeasonStoryboardBatchApproval = {
  ok: boolean;
  approved: Array<{ id: string; title: string }>;
  skipped: Array<{ id?: string; characterName: string; reason: string }>;
};

type VideoProductionDecision = {
  appliedAt: string;
  winner: "seedance-reference-clip" | "openai-sora-reference-clip";
  clipProvider: "seedance" | "openai";
  reason: string;
};

type ProductionMode = "local-qwen" | "hybrid" | "production";

type ProductionRunSummary = {
  id: string;
  createdAt: string;
  mode: ProductionMode;
  status: "storyboard-ready" | "needs-review" | "failed";
  characterId: string;
  characterName: string;
  title: string;
  qcScore: number;
  packetDir: string;
  nextAction: string;
};

type ProductionMemory = {
  events: Array<{
    id: string;
    runId: string;
    type: string;
    summary: string;
    status?: string;
    score?: number;
    createdAt: string;
  }>;
  modelPerformance: Array<{
    task: string;
    provider: string;
    model: string;
    status: string;
    latencyMs: number;
    completedAt: string;
    error?: string;
  }>;
};

type ModelRouterStatus = {
  defaultBrain: "qwen-local";
  qwen: {
    provider: string;
    baseUrl: string;
    model: string;
  };
  escalationProvider: "openrouter" | "openai";
  escalationModel: string;
  modes: Array<{ id: ProductionMode; label: string; behavior: string }>;
};

function PublicSite() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [favoriteCharacter, setFavoriteCharacter] = useState("Kai");
  const [shirtSize, setShirtSize] = useState("L");
  const [prizeCharacters, setPrizeCharacters] = useState(["Kai", "Mother Lall"]);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [socialActions, setSocialActions] = useState<string[]>([]);
  const [flipPage, setFlipPage] = useState(0);
  const [isFlipbookUnlocked, setIsFlipbookUnlocked] = useState(false);
  const [showFlipbookGate, setShowFlipbookGate] = useState(false);
  const [flipbookEmail, setFlipbookEmail] = useState("");
  const [flipbookName, setFlipbookName] = useState("");
  const [flipbookStatus, setFlipbookStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [referralCode, setReferralCode] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leadStatus, setLeadStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref") ?? "";
    setReferralCode(ref);
    if (ref) {
      fetch(`/api/growth/referrals/${encodeURIComponent(ref)}/click`, { method: "POST" }).catch(() => undefined);
    }
    fetch("/api/growth/leaderboard")
      .then((response) => response.json())
      .then((data: LeaderboardEntry[]) => setLeaderboard(data.slice(0, 6)))
      .catch(() => undefined);
  }, []);

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadStatus("saving");

    try {
      const response = await fetch("/api/growth/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          favoriteCharacter,
          source: "website",
          consent: true,
          contestOptIn: true,
          shirtSize,
          prizeCharacters,
          referredBy: referralCode,
          instagramHandle,
          socialActions,
          tags: ["founder-list", "opaija.com", "t-shirt-giveaway"],
          interests: ["founder art drop", "pilot", "merch", "books", "viral contest", ...socialActions],
        }),
      });

      if (!response.ok) throw new Error("Lead capture failed");
      const saved = await response.json();
      setLeadStatus("saved");
      setReferralCode(saved.lead.referralCode);
      setEmail("");
      const board = await fetch("/api/growth/leaderboard").then((res) => res.json());
      setLeaderboard(board.slice(0, 6));
    } catch {
      setLeadStatus("error");
    }
  }

  const featuredCharacters = ["kairo", "nia", "malik", "mother-lall"].map(
    (id) => characters.find((character) => character.id === id)!,
  );
  const flipbookPages = ["cover", ...characters.map((character) => character.id)];
  const currentFlipCharacter =
    flipPage === 0 ? null : characters.find((character) => character.id === flipbookPages[flipPage]);
  const freeFlipbookLimit = 4;
  const canOpenFlipPage = (page: number) => isFlipbookUnlocked || page <= freeFlipbookLimit;
  const openFlipPage = (page: number) => {
    if (!canOpenFlipPage(page)) {
      setShowFlipbookGate(true);
      return;
    }
    setFlipPage(page);
  };
  const nextFlipPage = () => {
    const nextPage = Math.min(flipPage + 1, flipbookPages.length - 1);
    openFlipPage(nextPage);
  };
  const previousFlipPage = () => setFlipPage((current) => Math.max(current - 1, 0));

  async function submitFlipbookUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFlipbookStatus("saving");

    try {
      const response = await fetch("/api/growth/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: flipbookEmail,
          firstName: flipbookName,
          favoriteCharacter: currentFlipCharacter?.shortName ?? "Kai",
          source: "website",
          consent: true,
          contestOptIn: true,
          referredBy: referralCode,
          tags: ["founder-list", "flipbook-unlock", "opaija.com"],
          interests: ["flipbook", "character previews", "caribbean anime", "founder contest"],
        }),
      });

      if (!response.ok) throw new Error("Flipbook unlock failed");
      const saved = await response.json();
      setReferralCode(saved.lead.referralCode);
      setIsFlipbookUnlocked(true);
      setShowFlipbookGate(false);
      setFlipbookStatus("saved");
      setFlipPage(Math.max(flipPage, freeFlipbookLimit + 1));
      const board = await fetch("/api/growth/leaderboard").then((res) => res.json());
      setLeaderboard(board.slice(0, 6));
    } catch {
      setFlipbookStatus("error");
    }
  }

  return (
    <main className="public-site">
      <header className="site-nav">
        <a href="/" className="site-brand" aria-label="Opaija home">
          <span className="brand-mark">O</span>
          <strong>OPAIJA</strong>
        </a>
        <nav>
          <a href="#story">Story</a>
          <a href="#characters">Characters</a>
          <a href="#preview">Flipbook</a>
          <a href="#founders">Giveaway</a>
          <a href="/blog">Blog</a>
          <a href="#books">Books</a>
          <a href="#pass">Pass</a>
          <a href="#shop">Merch</a>
        </nav>
      </header>

      <section className="public-hero">
        <div className="public-copy">
          <p className="section-label">Founder giveaway now open</p>
          <h1>The Caribbean finally gets its anime legend.</h1>
          <p>
            Born in Trinidad and Tobago, Opaija begins a journey through the Caribbean islands,
            where rhythm carries memory, every shore hides a guardian, and one young fighter must
            protect a power his people were never meant to forget.
          </p>
          <div className="public-actions">
            <a href="#founders" className="primary-action">
              <Gift size={18} />
              Enter the Giveaway
            </a>
            <a href="#story" className="ghost-action">
              <Play size={18} />
              Discover the Story
            </a>
          </div>
          <div className="hero-mini-list" aria-label="Founder list rewards">
            <span>Free founder art drops</span>
            <span>Share link + live leaderboard</span>
            <span>Island-by-island story drops</span>
          </div>
        </div>
        <div className="hero-video-stage" aria-label="Opaija cinematic hero video">
          <video
            src="/assets/video/opaija-hero-kai-strike.mp4"
            poster="/assets/video/opaija-hero-kai-strike-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
        <div className="hero-proof-strip" aria-label="Opaija world highlights">
          {["Caribbean anime", "Cinematic stick fighting", "Founder rewards"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section id="story" className="public-band">
        <div className="band-copy">
          <span className="signal">The story</span>
          <h2>A rhythm wakes in Trinidad. The call travels island to island.</h2>
          <p>
            Opaija is built for the whole Caribbean: Trinidad and Tobago first, then the wider
            islands, each with its own warriors, songs, food, folklore, rival crews, and hidden
            powers. This is a coming-of-age battle saga about remembering who we are before the
            world tells us to forget.
          </p>
        </div>
        <div className="feature-grid">
          {[
            ["Trinidad and Tobago", "The first spark: stick fighting, rhythm, doubles, chantwell power, and ancestral memory."],
            ["Across the Islands", "Every new chapter opens another Caribbean shore, guardian, fighting style, and secret."],
            ["The One Drum", "A dangerous force wants to flatten every island into one command and one silence."],
          ].map(([title, copy]) => (
            <article key={title}>
              <Check size={19} />
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="characters" className="public-section">
        <div className="public-section-header">
          <span className="signal">First character reveals</span>
          <h2>Meet the warriors, rivals, and guardians shaping the first season.</h2>
        </div>
        <div className="public-character-grid">
          {featuredCharacters.map((character) => (
            <article key={character.id}>
              <div className="public-character-image">
                {character.image ? <img src={character.image} alt={`${character.name} character sheet`} /> : null}
              </div>
              <h3>{character.name}</h3>
              <p>{character.role}</p>
              <span>{character.power}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="preview" className="flipbook-section">
        <div className="public-section-header">
          <span className="signal">Free flipbook preview</span>
          <h2>Start with the free flipbook. The full books come through the reader pass.</h2>
          <p>
            Start with the cover and four free character pages. Drop your email to unlock all 10
            character spreads, then get first notice when the longer comic, manga, storybook, and
            coloring-book drops open.
          </p>
        </div>
        <div className="flipbook-shell">
          <div className="flipbook-cta-strip">
            <div>
              <strong>Want the full book?</strong>
              <span>Unlock the complete 10-character preview and join the early list for the longer reader drops.</span>
            </div>
            <button type="button" className="primary-action" onClick={() => setShowFlipbookGate(true)}>
              <Mail size={18} />
              Unlock the Flipbook
            </button>
          </div>
          <div className="flipbook-stage" aria-live="polite">
            {currentFlipCharacter ? (
              <article className="flipbook-page character-page">
                <div className="flipbook-copy facts-page">
                  <span>Page {flipPage} / 10</span>
                  <h3>{currentFlipCharacter.name}</h3>
                  <p>{currentFlipCharacter.role}</p>
                  <ul className="fact-list">
                    {[
                      `Island origin: ${currentFlipCharacter.island}`,
                      `Signature power: ${currentFlipCharacter.power}`,
                      `Weapon: ${currentFlipCharacter.weapon}`,
                      ...currentFlipCharacter.strengths.slice(0, 2).map((fact) => `Strength: ${fact}`),
                    ].map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                  <dl>
                    <div>
                      <dt>Story clue</dt>
                      <dd>{currentFlipCharacter.pipeline[0]}</dd>
                    </div>
                    <div>
                      <dt>Founder action</dt>
                      <dd>Share the book, tag @opa_ija, and bring one more fan into the tribe.</dd>
                    </div>
                  </dl>
                  <a href="#founders" className="ghost-action">Join the Founder Giveaway</a>
                </div>
                <div className="flipbook-image protected-art" onContextMenu={(event) => event.preventDefault()}>
                  {currentFlipCharacter.image ? (
                    <img
                      src={currentFlipCharacter.image}
                      alt={`${currentFlipCharacter.name} character sheet preview`}
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                    />
                  ) : null}
                </div>
              </article>
            ) : (
              <article className="flipbook-page cover-page protected-art" onContextMenu={(event) => event.preventDefault()}>
                <img
                  src="/assets/flipbook/opaija-flipbook-cover.png"
                  alt="Opaija flipbook cover"
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                />
                <a href="#founders" className="primary-action">
                  <Gift size={18} />
                  Get the Founder Drop
                </a>
              </article>
            )}
          </div>
          <div className="flipbook-controls">
            <button type="button" onClick={previousFlipPage} disabled={flipPage === 0}>
              Previous
            </button>
            <div className="flipbook-dots" aria-label="Flipbook pages">
              {flipbookPages.map((page, index) => (
                <button
                  key={page}
                  type="button"
                  className={flipPage === index ? "active" : ""}
                  onClick={() => openFlipPage(index)}
                  aria-label={index === 0 ? "Cover" : `Character page ${index}`}
                />
              ))}
            </div>
            <button type="button" onClick={nextFlipPage} disabled={flipPage === flipbookPages.length - 1}>
              Next
            </button>
          </div>
          <div className="flipbook-share-bar">
            <strong>{isFlipbookUnlocked ? "Full preview unlocked" : "Cover + four character pages free"}</strong>
            <span>Share the preview, tag @opa_ija, and invite fans into the first Caribbean anime reader list.</span>
            <div>
              <a href="https://www.instagram.com/opa_ija/" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://www.youtube.com/@Opaija" target="_blank" rel="noreferrer">YouTube</a>
            </div>
          </div>
        </div>
      </section>

      {showFlipbookGate ? (
        <div className="gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="flipbook-gate-title">
          <form className="gate-modal" onSubmit={submitFlipbookUnlock}>
            <button type="button" className="gate-close" onClick={() => setShowFlipbookGate(false)} aria-label="Close">
              x
            </button>
            <span className="signal">Unlock the full preview</span>
            <h2 id="flipbook-gate-title">Get all 10 Opaija character pages.</h2>
            <p>
              Enter your email to unlock the full flipbook, join the founder list, and get early
              art drops from the first Caribbean anime saga.
            </p>
            <label>
              Name
              <input value={flipbookName} onChange={(event) => setFlipbookName(event.target.value)} placeholder="Your name" />
            </label>
            <label>
              Email
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                required
                value={flipbookEmail}
                onChange={(event) => setFlipbookEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" className="primary-action" disabled={flipbookStatus === "saving"}>
              <Mail size={18} />
              {flipbookStatus === "saving" ? "Unlocking..." : "Unlock the Flipbook"}
            </button>
            <small>
              Preview images are protected with watermarking and copy controls. Founder emails get release updates only.
            </small>
            {flipbookStatus === "error" ? <small className="gate-error">Could not unlock yet. Check the email and try again.</small> : null}
          </form>
        </div>
      ) : null}

      <section id="founders" className="founder-section">
        <div>
          <span className="signal">Early-bird founder list</span>
          <h2>Win the first Opaija prize pack.</h2>
          <p>
            Join the email list for free story and art drops. Share your personal link to climb
            the leaderboard. Tag us, repost us, and help carry the first Caribbean island-spanning
            anime movement into the world.
          </p>
          <div className="giveaway-prize">
            <strong>Main prize</strong>
            <span>Two Opaija character shirts in your size, two characters of your choice, plus hand-signed original artwork by Ray.</span>
          </div>
          <div className="social-boost">
            <strong>Boost your entry</strong>
            <a href="https://www.instagram.com/opa_ija/" target="_blank" rel="noreferrer">
              Follow, tag, and repost @opa_ija on Instagram
            </a>
            <a href="https://www.youtube.com/@Opaija" target="_blank" rel="noreferrer">
              Subscribe and share Opaija on YouTube
            </a>
            <span>Use #OpaijaFounders so we can spot and verify your posts.</span>
          </div>
        </div>
        <form className="founder-form" onSubmit={submitLead}>
          <label>
            Name
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Your name"
            />
          </label>
          <label>
            Email
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Favorite character
            <select value={favoriteCharacter} onChange={(event) => setFavoriteCharacter(event.target.value)}>
              {characters.map((character) => (
                <option key={character.id}>{character.shortName}</option>
              ))}
            </select>
          </label>
          <label>
            Shirt size
            <select value={shirtSize} onChange={(event) => setShirtSize(event.target.value)}>
              {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <label>
            Prize character picks
            <select
              value={prizeCharacters.join("|")}
              onChange={(event) => setPrizeCharacters(event.target.value.split("|"))}
            >
              <option value="Kai|Mother Lall">Kai + Mother Lall</option>
              <option value="Kai|Nia">Kai + Nia</option>
              <option value="Malik|Selah">Malik + Selah</option>
              <option value="Jabari|Tariq">Jabari + Tariq</option>
              <option value="Marius|Papa Etienne">Marius + Papa Etienne</option>
            </select>
          </label>
          <label>
            Instagram handle
            <input
              value={instagramHandle}
              onChange={(event) => setInstagramHandle(event.target.value)}
              placeholder="@yourhandle"
            />
          </label>
          <div className="social-checklist" aria-label="Social contest actions">
            {[
              ["follow-instagram", "I followed @opa_ija"],
              ["repost-instagram", "I reposted or tagged @opa_ija"],
              ["subscribe-youtube", "I subscribed on YouTube"],
              ["share-youtube", "I shared the Opaija YouTube channel"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={socialActions.includes(value)}
                  onChange={(event) =>
                    setSocialActions((current) =>
                      event.target.checked ? [...current, value] : current.filter((item) => item !== value),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="primary-action" disabled={leadStatus === "saving"}>
            <Mail size={18} />
            {leadStatus === "saving" ? "Joining..." : "Join + Get My Share Link"}
          </button>
          {leadStatus === "saved" && referralCode ? (
            <div className="referral-box">
              <strong>Your share link</strong>
              <span>{`${window.location.origin}/?ref=${referralCode}#founders`}</span>
            </div>
          ) : null}
          <p>
            {leadStatus === "saved"
              ? "You are in. Share your link to climb the leaderboard."
              : leadStatus === "error"
                ? "The form could not save locally. Try again once the API is live."
                : "No spam. Just founder drops, contest updates, and early access."}
          </p>
        </form>
      </section>

      <section className="public-section leaderboard-section">
        <div className="public-section-header">
          <span className="signal">Live contest leaderboard</span>
          <h2>Bring the tribe. Move up the board.</h2>
        </div>
        <div className="leaderboard-list">
          {(leaderboard.length ? leaderboard : [null, null, null]).map((entry: LeaderboardEntry | null, index) => (
            <article key={entry?.referralCode ?? index}>
              <strong>#{index + 1}</strong>
              <div>
                <span>{entry?.name ?? "Founder spot open"}</span>
                <small>
                  {entry ? `${entry.referrals} verified referrals / ${entry.clicks} clicks` : "Join to claim this spot"}
                </small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="books" className="public-band">
        <div className="band-copy">
          <span className="signal">Books and digital stories</span>
          <h2>Step into Opaija through comics, manga chapters, coloring books, and storybooks.</h2>
          <p>
            New releases will expand the world with character-driven comic chapters, manga-style
            adventures, narrated storybooks, printable coloring books, and collector artbooks for
            fans who want to keep the story close.
          </p>
        </div>
        <div className="feature-grid">
          {[
            ["Digital comic chapters", "Action, lore, and character moments released as polished story drops."],
            ["Manga-style reads", "High-energy black-and-white chapters built for fans of bold visual storytelling."],
            ["Coloring and storybooks", "Printable books and narrated adventures for families, collectors, and events."],
          ].map(([title, copy]) => (
            <article key={title}>
              <BookOpen size={19} />
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="pass" className="public-section reader-pass-section">
        <div className="public-section-header">
          <span className="signal">Digital comic pass</span>
          <h2>Free previews first. Paid digital books after the library opens.</h2>
          <p>
            Founder emails get the first samples. The paid reader will unlock longer Opaija books,
            bonus pages, manga drops, and collector previews once the first chapters are ready.
          </p>
        </div>
        <div className="pass-tier-grid">
          {digitalPassTiers.map((tier) => (
            <article key={tier.name}>
              <span>{tier.price}</span>
              <h3>{tier.name}</h3>
              <p>{tier.access}</p>
              <a href="#founders" className={tier.name === "Digital Comic Pass" ? "primary-action" : "ghost-action"}>
                <Mail size={18} />
                Get on the List
              </a>
            </article>
          ))}
        </div>
        <div className="reader-feature-strip">
          {paidReaderFeatures.slice(0, 4).map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>
      </section>

      <section id="shop" className="public-section">
        <div className="public-section-header">
          <span className="signal">Merch drops coming soon</span>
          <h2>Clothing, posters, stickers, and lifestyle drops from the world of Opaija.</h2>
          <p>
            The store will launch with character-led apparel, collector art, and product photos that
            show each drop in real-life style. Join the early list to vote on first releases and get
            first access when the shop opens.
          </p>
        </div>
        <div className="feature-grid merch-preview">
          {merchProducts.slice(0, 6).map((product) => (
            <article key={product.name}>
              <Shirt size={19} />
              <strong>{product.name}</strong>
              <span>{product.character} / {product.type}</span>
            </article>
          ))}
        </div>
      </section>

      <footer className="public-footer">
        <strong>OPAIJA</strong>
        <span>This is Opaija. Rhythm. Roots. Resistance.</span>
        <a href="/blog">Read the blog</a>
      </footer>
    </main>
  );
}

function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch("/api/blog/posts")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load blog posts");
        return response.json();
      })
      .then((data: BlogPostSummary[]) => {
        setPosts(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <main className="public-site blog-site">
      <SiteHeader />
      <section className="blog-hero">
        <div>
          <span className="signal">Story blog</span>
          <h1>Opaija lore, characters, and Caribbean anime worldbuilding.</h1>
          <p>
            Twice-daily posts from the Opaija story engine: character reveals, island lore, behind-the-art notes,
            action language, books, collectibles, and founder updates.
          </p>
          <div className="public-actions">
            <a href="/#founders" className="primary-action">
              <Gift size={18} />
              Join the Founder List
            </a>
            <a href="/" className="ghost-action">
              <ArrowRight size={18} />
              Back to Opaija
            </a>
          </div>
        </div>
      </section>

      <section className="blog-list-section">
        {status === "loading" && <div className="empty-state">Loading story drops...</div>}
        {status === "error" && <div className="empty-state">The blog feed is not available right now.</div>}
        {status === "ready" && posts.length === 0 && (
          <div className="empty-state">
            <strong>The first story drops are being prepared.</strong>
            <span>The blog agent will publish here as soon as the scheduler runs.</span>
          </div>
        )}
        {featuredPost && (
          <article className="featured-blog-card">
            <div className="featured-blog-media">
              {featuredPost.heroImage ? <img src={featuredPost.heroImage} alt="" /> : null}
            </div>
            <div>
              <span className="signal">{featuredPost.category}</span>
              <h2>{featuredPost.title}</h2>
              <p>{featuredPost.excerpt}</p>
              <div className="blog-meta">
                <span>{formatBlogDate(featuredPost.publishedAt)}</span>
                <span>{featuredPost.readingMinutes} min read</span>
              </div>
              <a href={`/blog/${featuredPost.slug}`} className="primary-action">
                <BookOpen size={18} />
                Read Article
              </a>
            </div>
          </article>
        )}
        {remainingPosts.length > 0 && (
          <div className="blog-card-grid">
            {remainingPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>
      <BlogFooter />
    </main>
  );
}

function BlogPostPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch(`/api/blog/posts/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load blog post");
        return response.json();
      })
      .then((data: BlogPostDetail) => {
        setPost(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug]);

  return (
    <main className="public-site blog-site">
      <SiteHeader />
      {status === "loading" && <section className="blog-article-shell empty-state">Loading article...</section>}
      {status === "error" && (
        <section className="blog-article-shell empty-state">
          <strong>Article not found.</strong>
          <a href="/blog" className="ghost-action">Back to Blog</a>
        </section>
      )}
      {status === "ready" && post && (
        <article className="blog-article-shell">
          <header className="blog-article-header">
            <span className="signal">{post.category}</span>
            <h1>{post.title}</h1>
            <p>{post.excerpt}</p>
            <div className="blog-meta">
              <span>{formatBlogDate(post.publishedAt)}</span>
              <span>{post.readingMinutes} min read</span>
            </div>
          </header>
          {post.heroImage ? (
            <div className="blog-article-media">
              <img src={post.heroImage} alt="" />
            </div>
          ) : null}
          <div className="blog-article-body" dangerouslySetInnerHTML={{ __html: post.html }} />
          <aside className="blog-cta-panel">
            <span className="signal">Founder list</span>
            <h2>Get the next Opaija drop first.</h2>
            <p>Join for character art, flipbook updates, story drops, and early reader-pass news.</p>
            <a href="/#founders" className="primary-action">
              <Gift size={18} />
              Join the Founder List
            </a>
          </aside>
          {post.sources.length > 0 && (
            <footer className="blog-source-list">
              <strong>Sources</strong>
              {post.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ))}
            </footer>
          )}
        </article>
      )}
      <BlogFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="site-nav">
      <a href="/" className="site-brand" aria-label="Opaija home">
        <span className="brand-mark">O</span>
        <strong>OPAIJA</strong>
      </a>
      <nav>
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
        <a href="/#characters">Characters</a>
        <a href="/#founders">Giveaway</a>
      </nav>
    </header>
  );
}

function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <article className="blog-card">
      <span className="signal">{post.category}</span>
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <div className="blog-meta">
        <span>{formatBlogDate(post.publishedAt)}</span>
        <span>{post.readingMinutes} min read</span>
      </div>
      <a href={`/blog/${post.slug}`} className="ghost-action">
        Read More
      </a>
    </article>
  );
}

function BlogFooter() {
  return (
    <footer className="public-footer">
      <strong>OPAIJA Blog</strong>
      <span>Characters, lore, art, books, and founder drops.</span>
      <a href="/#founders">Join the founder list</a>
    </footer>
  );
}

function formatBlogDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function CommandView({
  lockedCount,
  selectedCharacter,
  setSelectedCharacter,
  setActiveView,
}: {
  lockedCount: number;
  selectedCharacter: Character;
  setSelectedCharacter: (character: Character) => void;
  setActiveView: (view: View) => void;
}) {
  return (
    <div className="view-grid command-grid">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="signal">Season 1 operating room</span>
          <h2>Opaija runs from one shared source of truth.</h2>
          <p>
            The system starts with character bibles, model sheets, agent ownership, repeatable video
            packets, and launch assets tied to revenue from day one.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-action" onClick={() => setActiveView("video-agent")}>
              <Clapperboard size={18} />
              Make storyboard/video
            </button>
            <button type="button" className="ghost-action" onClick={() => setActiveView("characters")}>
              <Archive size={18} />
              Pick character
            </button>
          </div>
        </div>
        <div className="hero-art">
          <img src={selectedCharacter.image} alt={`${selectedCharacter.name} model sheet`} />
        </div>
      </section>

      <section className="metric-row" aria-label="Command metrics">
        <MetricCard icon={Clapperboard} label="Use first" value="Video Builder" detail="Storyboard and test video buttons" />
        <MetricCard icon={Image} label="Sheets loaded" value={`${lockedCount}/10`} detail="P1 cast reference library" />
        <MetricCard icon={Brain} label="Qwen room" value="Ready" detail="Story, panels, QC, memory" />
        <MetricCard icon={CalendarDays} label="Live mode" value="Gated" detail="Paid providers require approval" />
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Users} title="Priority Cast" action="Character room" />
          <div className="character-strip">
            {characters.slice(0, 10).map((character) => (
              <button
                type="button"
                key={character.id}
                className={selectedCharacter.id === character.id ? "mini-character active" : "mini-character"}
                onClick={() => setSelectedCharacter(character)}
              >
                {character.image ? <img src={character.image} alt="" /> : <span>{character.shortName.slice(0, 2)}</span>}
                <strong>{character.shortName}</strong>
                <small>{statusLabels[character.status]}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelHeader icon={Activity} title="Live Pipeline" action="Ops board" />
          <div className="pipeline-list">
            {pipeline.map((stage) => (
              <article key={stage.id} className={`pipeline-item ${stage.status}`}>
                <div>
                  <strong>{stage.name}</strong>
                  <span>{stage.owner}</span>
                </div>
                <p>{stage.metric}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

type HealthStatus = {
  ok: boolean;
  provider: string;
  voiceProvider: string;
  keys: Record<string, boolean>;
  seedance: string;
  publicSiteUrl?: string;
  email?: {
    provider: string;
    configured: boolean;
    from: string;
  };
};

type AdminSecretStatus = {
  name: string;
  label: string;
  description: string;
  provider: string;
  requiredFor: string;
  placeholder: string;
  configured: boolean;
  maskedValue: string;
};

function ApiKeysView() {
  const [secrets, setSecrets] = useState<AdminSecretStatus[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  async function loadSecrets() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/admin/secrets", { headers: getAdminHeaders() });
      if (!response.ok) throw new Error("Unable to load API key status.");
      const data = (await response.json()) as { secrets: AdminSecretStatus[] };
      setSecrets(data.secrets);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to load API key status.");
    }
  }

  useEffect(() => {
    loadSecrets();
  }, []);

  async function saveKeys(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()));
    if (!Object.keys(updates).length) {
      setMessage("Paste at least one new key before saving.");
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/secrets", {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Unable to save API keys.");
      }
      const data = (await response.json()) as { secrets: AdminSecretStatus[]; updated: string[] };
      setSecrets(data.secrets);
      setValues({});
      setStatus("ready");
      setMessage(`Saved ${data.updated.join(", ")}. Restart the API/server before live jobs if the running process does not pick it up.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save API keys.");
    }
  }

  const configuredCount = secrets.filter((secret) => secret.configured).length;
  const geminiReady = secrets.some((secret) => (secret.name === "GEMINI_API_KEY" || secret.name === "GOOGLE_API_KEY") && secret.configured);

  return (
    <div className="view-grid setup-room">
      <section className="book-hero setup-hero">
        <div>
          <span className="signal">Protected settings</span>
          <h2>API keys for the Opaija production agents.</h2>
          <p>
            Paste keys here to update the server `.env`. Saved keys are masked and never shown back in the browser.
            Gemini is the preferred keyframe provider for bible-sheet-locked anime artwork.
          </p>
        </div>
        <div className="book-metrics">
          <article>
            <span>Configured</span>
            <strong>{configuredCount}/{secrets.length || 9}</strong>
            <small>Provider keys detected</small>
          </article>
          <article>
            <span>Gemini</span>
            <strong>{geminiReady ? "Ready" : "Missing"}</strong>
            <small>Needed for exact bible-sheet frames</small>
          </article>
        </div>
      </section>

      <form className="panel api-key-panel" onSubmit={saveKeys}>
        <PanelHeader icon={KeyRound} title="Provider API Keys" action={status === "saving" ? "Saving" : "Masked"} />
        {message ? <p className={status === "error" ? "gate-error" : "agent-output"}>{message}</p> : null}
        <div className="api-key-grid">
          {secrets.map((secret) => (
            <label key={secret.name} className={secret.configured ? "api-key-card ready" : "api-key-card missing"}>
              <span>{secret.provider}</span>
              <div className="api-key-title-row">
                <strong>{secret.label}</strong>
                <b>{secret.configured ? "Saved" : "Missing"}</b>
              </div>
              <small>{secret.requiredFor}</small>
              <input
                type="password"
                value={values[secret.name] ?? ""}
                placeholder={secret.configured ? `${secret.maskedValue} saved` : secret.placeholder}
                autoComplete="off"
                onChange={(event) => setValues((current) => ({ ...current, [secret.name]: event.target.value }))}
              />
              <em>{secret.description}</em>
            </label>
          ))}
        </div>
        <div className="api-key-actions">
          <button type="submit" className="primary-action" disabled={status === "saving"}>
            <Check size={18} />
            Save API Keys
          </button>
          <button type="button" className="ghost-action" onClick={loadSecrets} disabled={status === "saving"}>
            <RefreshCw size={18} />
            Refresh Status
          </button>
        </div>
      </form>
    </div>
  );
}

function SetupView() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [summary, setSummary] = useState<{ leadCount: number; contestOptIns: number } | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch(() => undefined);
    fetch("/api/growth/summary")
      .then((response) => response.json())
      .then((data) => setSummary(data))
      .catch(() => undefined);
  }, []);

  const providerRows = [
    ["Gemini Image References", health?.keys.gemini, "GEMINI_API_KEY or GOOGLE_API_KEY"],
    ["OpenAI Brain", health?.keys.openai, "OPENAI_API_KEY"],
    ["Seedance / fal.ai", health?.keys.fal, "FAL_KEY"],
    ["ElevenLabs Voice", health?.keys.elevenlabs, "ELEVENLABS_API_KEY"],
    ["Resend Email", health?.keys.resend, "RESEND_API_KEY + RESEND_AUDIENCE_ID"],
    ["Print-on-demand", Boolean(health?.keys.printful || health?.keys.printify), "PRINTFUL_API_KEY or PRINTIFY_API_KEY"],
  ] as const;

  return (
    <div className="view-grid setup-room">
      <section className="book-hero setup-hero">
        <div>
          <span className="signal">Admin setup</span>
          <h2>Connect the content machine, email list, and AI production team.</h2>
          <p>
            Put provider keys in the local `.env` file while building. On the live server, the same variables go in
            the server project `.env` or hosting secret manager. Never paste API keys into public pages or commits.
          </p>
        </div>
        <div className="book-metrics">
          <article>
            <span>Site</span>
            <strong>{health?.ok ? "Live local" : "Checking"}</strong>
            <small>{health?.publicSiteUrl || "PUBLIC_SITE_URL not loaded"}</small>
          </article>
          <article>
            <span>Founder leads</span>
            <strong>{summary?.leadCount ?? 0}</strong>
            <small>{summary?.contestOptIns ?? 0} contest opt-ins</small>
          </article>
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={KeyRound} title="Provider Keys" action="Readiness" />
          <a href="/command/keys" className="primary-action setup-key-link">
            <KeyRound size={18} />
            Open API Key Manager
          </a>
          <div className="setup-checklist">
            {providerRows.map(([label, ready, variable]) => (
              <article key={label} className={ready ? "ready" : "missing"}>
                <span>{ready ? "Connected" : "Missing"}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{variable}</small>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelHeader icon={Mail} title="Resend Email Setup" action="Founder list" />
          <div className="env-instructions">
            <p>Local key file:</p>
            <code>C:\Users\RAY\OneDrive\Documents\Opaija\.env</code>
            <p>Add or update these lines:</p>
            <pre>{`RESEND_API_KEY=re_...
RESEND_AUDIENCE_ID=...
RESEND_FROM_EMAIL=Opaija <founders@opaija.com>
PUBLIC_SITE_URL=https://opaija.com`}</pre>
            <small>After saving `.env`, restart the Node/API process so Resend is picked up.</small>
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Brain} title="AI Team Command" action="Brain + Goose + Paperclip" />
        <div className="agent-grid">
          {agents.slice(0, 9).map((agent) => {
            const Icon = agent.icon;
            return (
              <article key={agent.id} className="agent-card">
                <div className="agent-topline">
                  <span className={`agent-state ${agent.status}`}>{agent.status}</span>
                  <Icon size={22} />
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.role}</p>
                <div className="agent-output">
                  <strong>{agent.cadence}</strong>
                  <span>{agent.output}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Sparkles} title="Open-Generative-AI Fit" action="Reference, not core" />
          <ul className="memory-list">
            <li><ChevronRight size={16} /><span>Use it as a model-provider/studio reference, not as the Opaija source of truth.</span></li>
            <li><ChevronRight size={16} /><span>Keep Opaija canon, character memory, prompts, and approvals inside this command center.</span></li>
            <li><ChevronRight size={16} /><span>Add selected provider patterns later behind our existing `/api/video`, `/api/voice`, and `/api/brain` adapters.</span></li>
          </ul>
        </div>
        <div className="panel">
          <PanelHeader icon={ServerCog} title="Live Deploy Blocker" action="SSH" />
          <div className="env-instructions">
            <p>The current SSH key did not authenticate to `root@5.78.105.83`.</p>
            <p>To take `opaija.com` live from here, add this key to the server user or give the correct user/path:</p>
            <code>C:\Users\RAY\.ssh\codex_nextbagchaser_hetzner.pub</code>
          </div>
        </div>
      </section>
    </div>
  );
}

type AssetFile = {
  id: string;
  name: string;
  relativePath: string;
  category: string;
  size: number;
  updatedAt: string;
  downloadable: boolean;
  deletable: boolean;
  downloadUrl: string;
};

function AssetLibraryView() {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [deletingId, setDeletingId] = useState("");

  async function loadAssets() {
    setStatus("loading");
    try {
      const response = await fetch("/api/assets");
      if (!response.ok) throw new Error("Unable to load asset library");
      const data = (await response.json()) as { assets: AssetFile[] };
      setAssets(data.assets);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  async function deleteAsset(asset: AssetFile) {
    if (!asset.deletable) return;
    setDeletingId(asset.id);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete asset");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
    } catch {
      setStatus("error");
    } finally {
      setDeletingId("");
    }
  }

  const totals = assets.reduce(
    (acc, asset) => {
      acc.bytes += asset.size;
      acc.categories.add(asset.category);
      if (asset.deletable) acc.generated += 1;
      return acc;
    },
    { bytes: 0, generated: 0, categories: new Set<string>() },
  );

  return (
    <div className="view-grid asset-room">
      <section className="book-hero asset-hero">
        <div>
          <span className="signal">Production file room</span>
          <h2>See what the machine has made, download finished assets, and remove bad outputs.</h2>
          <p>
            Generated videos, voiceovers, book packets, flipbook files, and locked reference assets are tracked from one
            dashboard. Only generated outputs can be deleted here; source character art stays protected.
          </p>
        </div>
        <div className="book-metrics">
          <article>
            <span>Files</span>
            <strong>{assets.length}</strong>
            <small>{totals.categories.size} asset groups</small>
          </article>
          <article>
            <span>Generated</span>
            <strong>{totals.generated}</strong>
            <small>safe to delete</small>
          </article>
          <article>
            <span>Storage</span>
            <strong>{formatBytes(totals.bytes)}</strong>
            <small>tracked locally</small>
          </article>
        </div>
      </section>

      <section className="panel asset-library-panel">
        <PanelHeader icon={Archive} title="Asset Library" action={status === "loading" ? "Scanning files" : "Download / delete"} />
        <div className="asset-toolbar">
          <p>
            Books in <code>out/books</code>, rendered videos in <code>out</code>, and voiceovers in <code>public/voiceover</code>
            are managed outputs. Character sheets and site media are locked for brand safety.
          </p>
          <button type="button" className="ghost-action" onClick={loadAssets}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {status === "error" ? (
          <div className="empty-state">
            <Archive size={28} />
            <strong>Could not load the asset library.</strong>
            <span>Check the API server, then refresh this panel.</span>
          </div>
        ) : null}

        <div className="asset-table" aria-label="Generated asset library">
          <div className="asset-row asset-row-head">
            <span>File</span>
            <span>Group</span>
            <span>Size</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          {assets.map((asset) => (
            <article key={asset.id} className="asset-row">
              <div>
                <strong>{asset.name}</strong>
                <small>{asset.relativePath}</small>
              </div>
              <span className="asset-chip">{asset.category}</span>
              <span>{formatBytes(asset.size)}</span>
              <span>{formatDate(asset.updatedAt)}</span>
              <div className="asset-actions">
                {asset.downloadable ? (
                  <a className="icon-action" href={asset.downloadUrl}>
                    <Download size={16} />
                    <span>Download</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  className="icon-action danger"
                  disabled={!asset.deletable || deletingId === asset.id}
                  onClick={() => deleteAsset(asset)}
                >
                  <Trash2 size={16} />
                  <span>{asset.deletable ? (deletingId === asset.id ? "Deleting" : "Delete") : "Locked"}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectsView() {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("opaija");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "building" | "error">("loading");
  const [projectForm, setProjectForm] = useState({
    title: "",
    genre: "Vertical animated micro-series",
    audience: "Mobile-first anime and short-drama fans",
    tone: "Fast, emotional, cliffhanger-driven",
    runtimeGoal: "20-35s teasers and 60-90s episodes",
    visualStyleNotes: "",
    publicDomain: "",
  });
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [characterFiles, setCharacterFiles] = useState<FileList | null>(null);
  const [worldPack, setWorldPack] = useState<WorldPackResponse | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setStatus("loading");
    try {
      const response = await fetch("/api/projects", { headers: getAdminHeaders() });
      if (!response.ok) throw new Error("Unable to load projects");
      const data = (await response.json()) as { projects: StudioProject[] };
      setProjects(data.projects);
      setSelectedProjectId((current) => data.projects.find((project) => project.id === current)?.id ?? data.projects[0]?.id ?? "opaija");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function createNewProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(projectForm),
      });
      if (!response.ok) throw new Error("Unable to create project");
      const project = (await response.json()) as StudioProject;
      setProjectForm({
        title: "",
        genre: "Vertical animated micro-series",
        audience: "Mobile-first anime and short-drama fans",
        tone: "Fast, emotional, cliffhanger-driven",
        runtimeGoal: "20-35s teasers and 60-90s episodes",
        visualStyleNotes: "",
        publicDomain: "",
      });
      await loadProjects();
      setSelectedProjectId(project.id);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function uploadStory() {
    if (!selectedProject || !storyFile) return;
    setStatus("saving");
    try {
      const payload = await fileToUpload(storyFile);
      const response = await fetch(`/api/projects/${selectedProject.id}/intake/story`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to upload story");
      setStoryFile(null);
      await loadProjects();
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function uploadSheets() {
    if (!selectedProject || !characterFiles?.length) return;
    setStatus("saving");
    try {
      const files = await Promise.all(Array.from(characterFiles).map(fileToUpload));
      const response = await fetch(`/api/projects/${selectedProject.id}/intake/character-sheets`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ files }),
      });
      if (!response.ok) throw new Error("Unable to upload character sheets");
      setCharacterFiles(null);
      await loadProjects();
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function buildWorldPack() {
    if (!selectedProject) return;
    setStatus("building");
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/world-pack`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Unable to build world pack");
      const data = (await response.json()) as WorldPackResponse;
      setWorldPack(data);
      await loadProjects();
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="view-grid book-room">
      <section className="panel start-here-panel">
        <PanelHeader icon={FileUp} title="Project Intake" action="Master studio hub" />
        <div className="book-hero">
          <div>
            <span className="signal">Next Bag Chaser Studio</span>
            <h2>Upload a base storyline and character sheets, then let the agent team build the world pack.</h2>
            <p>
              This is the reusable intake for all future cartoons. Opaija stays as the default flagship project, while each
              new world gets isolated story files, character sheets, memory, production packets, and content storage.
            </p>
          </div>
          <div className="book-metrics">
            <article>
              <span>Projects</span>
              <strong>{projects.length}</strong>
              <small>studio worlds</small>
            </article>
            <article>
              <span>Active</span>
              <strong>{selectedProject?.title ?? "None"}</strong>
              <small>{selectedProject?.status.replace(/_/g, " ") ?? "not loaded"}</small>
            </article>
            <article>
              <span>Storage</span>
              <strong>shared</strong>
              <small>one API-key vault</small>
            </article>
          </div>
        </div>
        {status === "error" ? <p className="gate-error">Project intake action failed. Check the API server and file type.</p> : null}
      </section>

      <section className="panel">
        <PanelHeader icon={FolderKanban} title="Create Project" action="New cartoon world" />
        <form className="admin-login-form project-intake-form" onSubmit={createNewProject}>
          <label>
            <span>Project title</span>
            <input value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} />
          </label>
          <label>
            <span>Genre</span>
            <input value={projectForm.genre} onChange={(event) => setProjectForm({ ...projectForm, genre: event.target.value })} />
          </label>
          <label>
            <span>Audience</span>
            <input value={projectForm.audience} onChange={(event) => setProjectForm({ ...projectForm, audience: event.target.value })} />
          </label>
          <label>
            <span>Tone</span>
            <input value={projectForm.tone} onChange={(event) => setProjectForm({ ...projectForm, tone: event.target.value })} />
          </label>
          <label>
            <span>Runtime goal</span>
            <input value={projectForm.runtimeGoal} onChange={(event) => setProjectForm({ ...projectForm, runtimeGoal: event.target.value })} />
          </label>
          <label>
            <span>Public domain</span>
            <input value={projectForm.publicDomain} onChange={(event) => setProjectForm({ ...projectForm, publicDomain: event.target.value })} />
          </label>
          <label>
            <span>Visual style notes</span>
            <textarea value={projectForm.visualStyleNotes} onChange={(event) => setProjectForm({ ...projectForm, visualStyleNotes: event.target.value })} />
          </label>
          <button type="submit" className="primary-action" disabled={status === "saving" || !projectForm.title.trim()}>
            <FileUp size={18} />
            {status === "saving" ? "Creating" : "Create Project"}
          </button>
        </form>
      </section>

      <section className="panel">
        <PanelHeader icon={Archive} title="Project Workspace" action="Story and sheets" />
        <div className="asset-toolbar">
          <label className="agent-control">
            <span>Active project</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-action" onClick={loadProjects}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        {selectedProject ? (
          <div className="workflow-decision latest-builder-result">
            <article>
              <span className="agent-state online">{selectedProject.status.replace(/_/g, " ")}</span>
              <h3>{selectedProject.title}</h3>
              <p>{selectedProject.genre} / {selectedProject.audience}</p>
              <small>{selectedProject.runtimeGoal}</small>
            </article>
            <article>
              <span className="agent-state building">Intake files</span>
              <h3>{selectedProject.counts.storyOutlines} story / {selectedProject.counts.characterSheets} sheets</h3>
              <p>{selectedProject.visualStyleNotes || "Upload style notes and character sheets before paid production."}</p>
              <small>{selectedProject.latestWorldPackPath ? "World pack exists" : "World pack not built yet"}</small>
            </article>
          </div>
        ) : null}

        <div className="studio-editor-grid">
          <article>
            <span className="signal">Story outline</span>
            <h3>Upload base storyline</h3>
            <p>Allowed: .txt, .md, .pdf, .docx. Text extraction for PDF/DOCX is staged; the file still becomes part of the world pack source.</p>
            <input type="file" accept=".txt,.md,.pdf,.docx" onChange={(event) => setStoryFile(event.target.files?.[0] ?? null)} />
            <button type="button" className="primary-action" onClick={uploadStory} disabled={!storyFile || status === "saving"}>
              <FileUp size={16} />
              Upload Story
            </button>
          </article>
          <article>
            <span className="signal">Character sheets</span>
            <h3>Upload visual bible art</h3>
            <p>Allowed: .png, .jpg, .webp. These become the project-specific character identity references.</p>
            <input type="file" accept=".png,.jpg,.jpeg,.webp" multiple onChange={(event) => setCharacterFiles(event.target.files)} />
            <button type="button" className="primary-action" onClick={uploadSheets} disabled={!characterFiles?.length || status === "saving"}>
              <Image size={16} />
              Upload Sheets
            </button>
          </article>
          <article>
            <span className="signal">World pack</span>
            <h3>Build review packet</h3>
            <p>Creates story bible, character bible review notes, Season 1 outline, power teaser plan, and readiness gates with no paid providers.</p>
            <button
              type="button"
              className="primary-action"
              onClick={buildWorldPack}
              disabled={!selectedProject || selectedProject.counts.storyOutlines < 1 || selectedProject.counts.characterSheets < 1 || status === "building"}
            >
              <Sparkles size={16} />
              {status === "building" ? "Building World Pack" : "Build World Pack"}
            </button>
          </article>
        </div>
      </section>

      {worldPack ? (
        <section className="panel">
          <PanelHeader icon={BookOpen} title="Latest World Pack" action="Needs review" />
          <div className="workflow-decision latest-builder-result">
            <article>
              <span className="agent-state building">{worldPack.worldPack.status}</span>
              <h3>{worldPack.worldPack.title}</h3>
              <p>{worldPack.worldPack.storyBible.premise}</p>
              <small>{worldPack.files.worldPackPath}</small>
            </article>
            <article>
              <span className="agent-state online">Season plan</span>
              <h3>{worldPack.worldPack.seasonOne.episodes.length} starter chapters</h3>
              <p>{worldPack.worldPack.seasonOne.format}</p>
              <small>{worldPack.worldPack.powerTeasers.length} power teasers planned</small>
            </article>
          </div>
          <div className="episode-fix-grid">
            {worldPack.worldPack.productionReadiness.map((item) => (
              <article key={item}>
                <CheckCircle2 size={17} />
                <span>{item}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function fileToUpload(file: File) {
  return new Promise<{ fileName: string; contentType: string; dataBase64: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64: String(reader.result ?? ""),
      });
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

function CharactersView({
  selectedCharacter,
  setSelectedCharacter,
}: {
  selectedCharacter: Character;
  setSelectedCharacter: (character: Character) => void;
}) {
  return (
    <div className="view-grid character-room">
      <section className="character-gallery" aria-label="Season 1 character list">
        {characters.map((character) => (
          <button
            type="button"
            key={character.id}
            className={selectedCharacter.id === character.id ? "character-card active" : "character-card"}
            onClick={() => setSelectedCharacter(character)}
          >
            <div className="thumb-frame">
              {character.image ? (
                <img src={character.image} alt={`${character.name} reference sheet`} />
              ) : (
                <div className="empty-thumb">
                  <Sparkles size={24} />
                </div>
              )}
            </div>
            <div className="card-copy">
              <span>{character.priority}</span>
              <strong>{character.name}</strong>
              <small>{character.role}</small>
            </div>
          </button>
        ))}
      </section>

      <aside className="detail-panel">
        <div className="detail-media">
          {selectedCharacter.image ? (
            <img src={selectedCharacter.image} alt={`${selectedCharacter.name} full model sheet`} />
          ) : (
            <div className="empty-reference">
              <Sparkles size={42} />
              <strong>Reference sheet pending</strong>
            </div>
          )}
        </div>
        <div className="detail-copy">
          <span className={`status-pill ${selectedCharacter.status}`}>{statusLabels[selectedCharacter.status]}</span>
          <h2>{selectedCharacter.name}</h2>
          <p>{selectedCharacter.role}</p>
          <dl className="profile-grid">
            <div>
              <dt>Island</dt>
              <dd>{selectedCharacter.island}</dd>
            </div>
            <div>
              <dt>Power</dt>
              <dd>{selectedCharacter.power}</dd>
            </div>
            <div>
              <dt>Weapon</dt>
              <dd>{selectedCharacter.weapon}</dd>
            </div>
          </dl>
          <InfoList title="Next build packet" items={selectedCharacter.pipeline} />
          <InfoList title="Brand hooks" items={selectedCharacter.merchHooks} />
        </div>
      </aside>
    </div>
  );
}

function AgentsView({
  agentFilter,
  setAgentFilter,
  filteredAgents,
}: {
  agentFilter: string;
  setAgentFilter: (team: string) => void;
  filteredAgents: typeof agents;
}) {
  const teams = ["All", "Brain", "Goose", "Paperclip", "Revenue", "Guardrail"];

  return (
    <div className="view-grid">
      <section className="panel">
        <PanelHeader icon={Brain} title="AI Team Roster" action="Shared ownership" />
        <div className="segmented-control" aria-label="Filter agents by team">
          {teams.map((team) => (
            <button
              type="button"
              key={team}
              className={agentFilter === team ? "active" : ""}
              onClick={() => setAgentFilter(team)}
            >
              {team}
            </button>
          ))}
        </div>
        <div className="agent-grid">
          {filteredAgents.map((agent) => {
            const Icon = agent.icon;
            return (
              <article key={agent.id} className="agent-card">
                <div className="agent-topline">
                  <span className={`agent-state ${agent.status}`}>{agent.status}</span>
                  <Icon size={22} />
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.role}</p>
                <InfoList title="Owns" items={agent.owns} />
                <div className="agent-output">
                  <strong>{agent.cadence}</strong>
                  <span>{agent.output}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PipelineView({
  queueMode,
  setQueueMode,
}: {
  queueMode: string;
  setQueueMode: (mode: string) => void;
}) {
  return (
    <div className="view-grid pipeline-room">
      <section className="panel">
        <PanelHeader icon={Gauge} title="Production Workflow" action="Repeatable content machine" />
        <div className="mode-row" aria-label="Pipeline queue mode">
          {["Bible Build", "Video Packets", "Launch Calendar"].map((mode) => (
            <button
              type="button"
              key={mode}
              className={queueMode === mode ? "mode-button active" : "mode-button"}
              onClick={() => setQueueMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="stage-board">
          {pipeline.map((stage) => (
            <article key={stage.id} className={`stage-column ${stage.status}`}>
              <div className="stage-header">
                <span>{stage.status}</span>
                <h3>{stage.name}</h3>
                <p>{stage.owner}</p>
              </div>
              <ul>
                {stage.tasks.map((task) => (
                  <li key={task}>
                    <CheckCircle2 size={16} />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Archive} title="Memory Rules" action="Canon guardrails" />
          <ul className="memory-list">
            {memoryRules.map((rule) => (
              <li key={rule}>
                <ChevronRight size={16} />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <PanelHeader icon={CalendarDays} title="Release Targets" action="Launch runway" />
          <div className="target-list">
            {releaseTargets.map((target) => (
              <article key={target.label}>
                <strong>{target.count}</strong>
                <div>
                  <span>{target.label}</span>
                  <small>
                    {target.format} / {target.timing}
                  </small>
                </div>
                <ArrowRight size={17} />
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BookEngineView() {
  return (
    <div className="view-grid book-room">
      <section className="panel">
        <PanelHeader icon={BookOpen} title="Book Engine" action="Amazon KDP-ready reuse system" />
        <div className="book-hero">
          <div>
            <span className="signal">Episode art becomes products</span>
            <h2>Comics, manga, coloring books, storybooks, and artbooks from one asset bank.</h2>
            <p>
              Each episode creates a reusable asset packet first. The book engine adapts approved model sheets,
              keyframes, props, backgrounds, narration, and captions into KDP-ready page manifests.
            </p>
          </div>
          <div className="book-metrics">
            {bookMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="book-format-grid">
          {bookFormats.map((format) => {
            const Icon = format.icon;
            return (
              <article key={format.id} className={`book-format ${format.status}`}>
                <div className="agent-topline">
                  <Icon size={23} />
                  <span className={`agent-state ${format.status === "ready" ? "online" : "building"}`}>
                    {format.status}
                  </span>
                </div>
                <h3>{format.name}</h3>
                <p>{format.format}</p>
                <div className="book-source">
                  <strong>Reuse source</strong>
                  <span>{format.reuseSource}</span>
                </div>
                <InfoList title="Outputs" items={format.outputs} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Layers3} title="Engine Stages" action="Asset reuse workflow" />
          <div className="book-stage-list">
            {bookEngineStages.map((stage, index) => (
              <article key={stage.id}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <div>
                  <h3>{stage.name}</h3>
                  <span>{stage.owner}</span>
                  <p>{stage.task}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelHeader icon={Archive} title="Reuse Rules" action="Keep art on brand" />
          <ul className="memory-list">
            {reuseRules.map((rule) => (
              <li key={rule}>
                <ChevronRight size={16} />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={BookOpen} title="KDP Presets" action="Default print targets" />
          <div className="target-list">
            {kdpPresets.map((preset) => (
              <article key={preset.name}>
                <strong>KDP</strong>
                <div>
                  <span>{preset.name}</span>
                  <small>
                    {preset.trim} / {preset.bleedPage} / {preset.use}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={CheckCircle2} title="KDP Rules" action="Upload guardrails" />
          <ul className="memory-list">
            {kdpRules.map((rule) => (
              <li key={rule}>
                <ChevronRight size={16} />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={CalendarDays} title="First Book Products" action="Built from episodes" />
        <div className="episode-product-grid">
          {episodeBookProducts.map((episode) => (
            <article key={episode.episode}>
              <h3>{episode.episode}</h3>
              <InfoList title="Products" items={episode.products} />
              <InfoList title="Source assets" items={episode.sourceAssets} />
            </article>
          ))}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={KeyRound} title="Digital Reader Pass" action="Paid library roadmap" />
          <div className="target-list">
            {digitalPassTiers.map((tier) => (
              <article key={tier.name}>
                <strong>{tier.price}</strong>
                <div>
                  <span>{tier.name}</span>
                  <small>{tier.access}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={CheckCircle2} title="Reader Rules" action="Free sample to paid book" />
          <ul className="memory-list">
            {paidReaderFeatures.map((feature) => (
              <li key={feature}>
                <ChevronRight size={16} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function FxView() {
  return (
    <div className="view-grid book-room">
      <section className="panel">
        <PanelHeader icon={WandSparkles} title="Cinematic FX Engine" action="Anime action plus Opaija power language" />
        <div className="book-hero fx-hero">
          <div>
            <span className="signal">World-class action standard</span>
            <h2>Pose-first anime action with Caribbean rhythm effects layered in post.</h2>
            <p>
              We do not need to train a model first. The right move is an FX agent with a strict effects bible,
              reference packs, Seedance prompts, and Remotion compositing. Train or fine-tune later only if
              consistency breaks at scale.
            </p>
          </div>
          <div className="book-metrics">
            {fxMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="agent-grid">
          {fxAgents.map((agent) => {
            const Icon = agent.icon;
            return (
              <article key={agent.name} className="agent-card">
                <div className="agent-topline">
                  <span className="agent-state online">active</span>
                  <Icon size={22} />
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.role}</p>
                <InfoList title="Owns" items={agent.owns} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Sparkles} title="FX Pillars" action="Power language" />
          <div className="book-stage-list">
            {fxPillars.map((pillar, index) => (
              <article key={pillar.name}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <div>
                  <h3>{pillar.name}</h3>
                  <span>{pillar.visual}</span>
                  <p>{pillar.use}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={CheckCircle2} title="Action Rules" action="Shot QC" />
          <ul className="memory-list">
            {actionSceneStandard.map((rule) => (
              <li key={rule}>
                <ChevronRight size={16} />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function GrowthView() {
  return (
    <div className="view-grid book-room">
      <section className="panel">
        <PanelHeader icon={Megaphone} title="Tribe Growth Engine" action="Organic, paid, email, blog, founder list" />
        <div className="book-hero growth-hero">
          <div>
            <span className="signal">Owned audience first</span>
            <h2>Build the fan tribe fast, then scale winners with paid ads.</h2>
            <p>
              The growth engine turns characters, lore, art drops, story blogs, and founder collectibles into
              email capture, retargeting pools, social momentum, and early revenue signals.
            </p>
          </div>
          <div className="book-metrics">
            {growthMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="agent-grid">
          {growthAgents.map((agent) => {
            const Icon = agent.icon;
            return (
              <article key={agent.name} className="agent-card">
                <div className="agent-topline">
                  <span className="agent-state online">{agent.channel}</span>
                  <Icon size={22} />
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.role}</p>
                <InfoList title="Owns" items={agent.owns} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Radio} title="Growth Loops" action="Agents feed each other" />
          <div className="book-stage-list">
            {growthLoops.map((loop, index) => (
              <article key={loop.name}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <div>
                  <h3>{loop.name}</h3>
                  <span>
                    {loop.target} / {loop.cadence}
                  </span>
                  <p>{loop.steps.join(" -> ")}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={Gift} title="Lead Magnets" action="Email capture assets" />
          <div className="target-list">
            {leadMagnets.map((magnet) => (
              <article key={magnet.name}>
                <strong>Lead</strong>
                <div>
                  <span>{magnet.name}</span>
                  <small>
                    {magnet.type} / {magnet.capture}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={CalendarDays} title="Fast Launch Plan" action="5-week sprint" />
          <div className="book-stage-list">
            {launchPlan.map((week) => (
              <article key={week.week}>
                <strong>{week.week.replace("Week ", "W")}</strong>
                <div>
                  <h3>{week.focus}</h3>
                  <p>{week.output}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={CheckCircle2} title="Growth Guardrails" action="Business-safe growth" />
          <ul className="memory-list">
            {complianceRules.map((rule) => (
              <li key={rule}>
                <ChevronRight size={16} />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={BookOpen} title="Story Blog Pillars" action="Lead-gen content system" />
        <div className="episode-product-grid">
          {contentPillars.map((pillar) => (
            <article key={pillar}>
              <h3>{pillar}</h3>
              <p>Turn this pillar into shorts, blog posts, email drops, ad angles, and book/KDP previews.</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function VideoAgentView() {
  const [runs, setRuns] = useState<VideoRunRecord[]>([]);
  const [readiness, setReadiness] = useState<VideoAgentReadiness | null>(null);
  const [smokeTests, setSmokeTests] = useState<ProviderSmokeTestRecord[]>([]);
  const [providerComparison, setProviderComparison] = useState<ProviderComparisonReport | null>(null);
  const [workflowResearch, setWorkflowResearch] = useState<VideoWorkflowResearchReport | null>(null);
  const [bakeoffPreflight, setBakeoffPreflight] = useState<BakeoffPreflightReport | null>(null);
  const [productionDecision, setProductionDecision] = useState<VideoProductionDecision | null>(null);
  const [modelRouter, setModelRouter] = useState<ModelRouterStatus | null>(null);
  const [productionRuns, setProductionRuns] = useState<ProductionRunSummary[]>([]);
  const [productionMemory, setProductionMemory] = useState<ProductionMemory | null>(null);
  const [schedule, setSchedule] = useState<VideoAgentScheduleStatus | null>(null);
  const [doctor, setDoctor] = useState<VideoAgentDoctor | null>(null);
  const [approvedQueue, setApprovedQueue] = useState<ApprovedQueueStatus | null>(null);
  const [approvedQueueSchedule, setApprovedQueueSchedule] = useState<ApprovedQueueScheduleStatus | null>(null);
  const [artifacts, setArtifacts] = useState<VideoRunArtifacts | null>(null);
  const [episodeStudio, setEpisodeStudio] = useState<EpisodeOneStudio | null>(null);
  const [powerTeaserStudio, setPowerTeaserStudio] = useState<PowerTeaserStudio | null>(null);
  const [powerTeaserStatus, setPowerTeaserStatus] = useState<"idle" | "building" | "done" | "error">("idle");
  const [contentStorage, setContentStorage] = useState<ContentStorageItem[]>([]);
  const [selectedStudioPanelId, setSelectedStudioPanelId] = useState("");
  const [artifactStatus, setArtifactStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [startStatus, setStartStatus] = useState<"idle" | "starting" | "queued" | "error">("idle");
  const [smokeStatus, setSmokeStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [workflowSmokeStatus, setWorkflowSmokeStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [decisionStatus, setDecisionStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preflightStatus, setPreflightStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [scheduleStatus, setScheduleStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [renderingId, setRenderingId] = useState("");
  const [renderStatus, setRenderStatus] = useState<"idle" | "queued" | "error">("idle");
  const [approvedQueueStatus, setApprovedQueueStatus] = useState<"idle" | "queued" | "error">("idle");
  const [approvedQueueScheduleStatus, setApprovedQueueScheduleStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [seasonBatchStatus, setSeasonBatchStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [seasonBatch, setSeasonBatch] = useState<SeasonStoryboardBatchSummary | null>(null);
  const [seasonApprovalStatus, setSeasonApprovalStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [seasonApproval, setSeasonApproval] = useState<SeasonStoryboardBatchApproval | null>(null);
  const [productionRunStatus, setProductionRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [simpleBuilderStatus, setSimpleBuilderStatus] = useState<"idle" | "storyboard" | "video" | "done" | "error">("idle");
  const [activeVideoJob, setActiveVideoJob] = useState<VideoAgentJobRecord | null>(null);
  const [completingSmokeId, setCompletingSmokeId] = useState("");
  const [keyframeProvider, setKeyframeProvider] = useState("mock");
  const [clipProvider, setClipProvider] = useState("mock");
  const [voiceProvider, setVoiceProvider] = useState("mock");
  const [storyboardDirectorProvider, setStoryboardDirectorProvider] = useState("local");
  const [storyboardFrameProvider, setStoryboardFrameProvider] = useState("mock");
  const [productionMode, setProductionMode] = useState<ProductionMode>("local-qwen");
  const [videoCharacterId, setVideoCharacterId] = useState("kairo");
  const [waitForClip, setWaitForClip] = useState(false);
  const [storyboardOnly, setStoryboardOnly] = useState(true);
  const [confirmLiveSpend, setConfirmLiveSpend] = useState(false);
  const [reviewingId, setReviewingId] = useState("");

  const loadRuns = () => {
    setStatus("loading");
    fetch("/api/video-agent/runs", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load video runs");
        return response.json();
      })
      .then((data: VideoRunRecord[]) => {
        setRuns(data);
        setStatus("ready");
        if (data[0]) loadRunArtifacts(data[0].id);
      })
      .catch(() => setStatus("error"));
  };

  const loadRunArtifacts = (id: string) => {
    setArtifactStatus("loading");
    fetch(`/api/video-agent/runs/${id}/artifacts`, { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load video run artifacts");
        return response.json();
      })
      .then((data: VideoRunArtifacts) => {
        setArtifacts(data);
        setArtifactStatus("ready");
      })
      .catch(() => setArtifactStatus("error"));
  };

  const loadVideoJob = (id: string) => {
    fetch(`/api/video-agent/jobs/${id}`, { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load video job");
        return response.json();
      })
      .then((data: VideoAgentJobRecord) => setActiveVideoJob(data))
      .catch(() => {
        setActiveVideoJob((current) => (current?.id === id ? { ...current, status: "failed", error: "Job status could not be loaded." } : current));
      });
  };

  const loadLatestVideoJob = () => {
    fetch("/api/video-agent/jobs", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load video jobs");
        return response.json();
      })
      .then((data: VideoAgentJobRecord[]) => {
        setActiveVideoJob(data[0] ?? null);
      })
      .catch(() => setActiveVideoJob(null));
  };

  const loadReadiness = () => {
    fetch("/api/video-agent/readiness", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load readiness");
        return response.json();
      })
      .then((data: VideoAgentReadiness) => setReadiness(data))
      .catch(() => setReadiness(null));
  };

  const loadSmokeTests = () => {
    fetch("/api/video-agent/provider-smoke-tests", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load smoke tests");
        return response.json();
      })
      .then((data: ProviderSmokeTestRecord[]) => setSmokeTests(data))
      .catch(() => setSmokeTests([]));
  };

  const loadProviderComparison = () => {
    fetch("/api/video-agent/provider-comparison", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load provider comparison");
        return response.json();
      })
      .then((data: ProviderComparisonReport) => setProviderComparison(data))
      .catch(() => setProviderComparison(null));
  };

  const loadWorkflowResearch = () => {
    fetch("/api/video-agent/workflow-research", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load workflow research");
        return response.json();
      })
      .then((data: VideoWorkflowResearchReport) => setWorkflowResearch(data))
      .catch(() => setWorkflowResearch(null));
  };

  const loadBakeoffPreflight = () => {
    setPreflightStatus("checking");
    fetch("/api/video-agent/provider-bakeoff/preflight", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load bakeoff preflight");
        return response.json();
      })
      .then((data: BakeoffPreflightReport) => {
        setBakeoffPreflight(data);
        setPreflightStatus("ready");
      })
      .catch(() => {
        setBakeoffPreflight(null);
        setPreflightStatus("error");
      });
  };

  const loadProductionDecision = () => {
    fetch("/api/video-agent/production-decision", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load production decision");
        return response.json();
      })
      .then((data: VideoProductionDecision | null) => setProductionDecision(data))
      .catch(() => setProductionDecision(null));
  };

  const loadModelRouter = () => {
    fetch("/api/production/model-router", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load model router");
        return response.json();
      })
      .then((data: ModelRouterStatus) => setModelRouter(data))
      .catch(() => setModelRouter(null));
  };

  const loadProductionRuns = () => {
    fetch("/api/production/runs", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load production runs");
        return response.json();
      })
      .then((data: ProductionRunSummary[]) => setProductionRuns(data))
      .catch(() => setProductionRuns([]));
  };

  const loadProductionMemory = () => {
    fetch("/api/production/memory", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load production memory");
        return response.json();
      })
      .then((data: ProductionMemory) => setProductionMemory(data))
      .catch(() => setProductionMemory(null));
  };

  const loadSchedule = () => {
    fetch("/api/video-agent/schedule", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load schedule");
        return response.json();
      })
      .then((data: VideoAgentScheduleStatus) => setSchedule(data))
      .catch(() => setSchedule(null));
  };

  const loadDoctor = () => {
    fetch("/api/video-agent/doctor", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load doctor");
        return response.json();
      })
      .then((data: VideoAgentDoctor) => setDoctor(data))
      .catch(() => setDoctor(null));
  };

  const loadEpisodeStudio = () => {
    fetch("/api/video-agent/episode-one/studio", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load Episode 1 studio");
        return response.json();
      })
      .then((data: EpisodeOneStudio) => {
        setEpisodeStudio(data);
        setSelectedStudioPanelId((current) => current || data.frames[0]?.panelId || "");
      })
      .catch(() => setEpisodeStudio(null));
  };

  const loadPowerTeaserStudio = () => {
    fetch("/api/video-agent/power-teasers/studio", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load power teaser studio");
        return response.json();
      })
      .then((data: PowerTeaserStudio) => setPowerTeaserStudio(data))
      .catch(() => setPowerTeaserStudio(null));
  };

  const loadContentStorage = () => {
    fetch("/api/content-storage/items", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load content storage");
        return response.json();
      })
      .then((data: ContentStorageItem[]) => setContentStorage(data))
      .catch(() => setContentStorage([]));
  };

  const loadApprovedQueue = () => {
    fetch("/api/video-agent/approved-queue", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load approved queue");
        return response.json();
      })
      .then((data: ApprovedQueueStatus) => setApprovedQueue(data))
      .catch(() => setApprovedQueue(null));
  };

  const loadApprovedQueueSchedule = () => {
    fetch("/api/video-agent/approved-queue/schedule", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load approved queue schedule");
        return response.json();
      })
      .then((data: ApprovedQueueScheduleStatus) => setApprovedQueueSchedule(data))
      .catch(() => setApprovedQueueSchedule(null));
  };

  const loadSeasonBatch = () => {
    fetch("/api/video-agent/season-storyboards", { headers: getAdminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load Season 1 storyboard batch");
        return response.json();
      })
      .then((data: SeasonStoryboardBatchSummary | null) => setSeasonBatch(data))
      .catch(() => setSeasonBatch(null));
  };

  useEffect(() => {
    loadRuns();
    loadReadiness();
    loadSmokeTests();
    loadProviderComparison();
    loadWorkflowResearch();
    loadBakeoffPreflight();
    loadProductionDecision();
    loadModelRouter();
    loadProductionRuns();
    loadProductionMemory();
    loadSchedule();
    loadDoctor();
    loadEpisodeStudio();
    loadPowerTeaserStudio();
    loadContentStorage();
    loadApprovedQueue();
    loadApprovedQueueSchedule();
    loadSeasonBatch();
    loadLatestVideoJob();
  }, []);

  async function startRun() {
    setStartStatus("starting");
    try {
      const response = await fetch("/api/video-agent/runs", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          keyframeProvider,
          clipProvider,
          voiceProvider,
          storyboardDirectorProvider,
          storyboardFrameProvider,
          characterId: videoCharacterId,
          waitForClip,
          storyboardOnly,
          confirmLiveSpend,
          requireLlm: false,
        }),
      });
      if (!response.ok) throw new Error("Unable to start run");
      setStartStatus("queued");
      window.setTimeout(loadRuns, 2200);
    } catch {
      setStartStatus("error");
    }
  }

  async function runSimpleBuilder(mode: "storyboard" | "video") {
    setSimpleBuilderStatus(mode);
    setActiveVideoJob(null);
    try {
      const response = await fetch("/api/video-agent/runs", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          keyframeProvider: "mock",
          clipProvider: "mock",
          voiceProvider: "mock",
          storyboardDirectorProvider: "local",
          storyboardFrameProvider: "mock",
          characterId: videoCharacterId,
          waitForClip: false,
          storyboardOnly: mode === "storyboard",
          confirmLiveSpend: false,
          requireLlm: false,
          renderWidth: mode === "video" ? 360 : undefined,
          renderHeight: mode === "video" ? 640 : undefined,
          renderDurationFrames: mode === "video" ? 90 : undefined,
        }),
      });
      if (response.status === 401) {
        window.localStorage.removeItem(adminSessionKey);
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Unable to run builder");
      const data = (await response.json()) as { jobId?: string; pid?: number };
      if (data.jobId) {
        setActiveVideoJob({
          id: data.jobId,
          status: "queued",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pid: data.pid,
          options: { characterId: videoCharacterId, storyboardOnly: mode === "storyboard" },
        });
        loadVideoJob(data.jobId);
      }
      setSimpleBuilderStatus("done");
      pollBuilderResults(data.jobId);
    } catch {
      setSimpleBuilderStatus("error");
    }
  }

  function pollBuilderResults(jobId?: string) {
    [1500, 4000, 8000, 15000, 30000, 60000, 90000].forEach((delay) => {
      window.setTimeout(() => {
        loadRuns();
        loadDoctor();
        loadEpisodeStudio();
        loadPowerTeaserStudio();
        loadContentStorage();
        if (jobId) loadVideoJob(jobId);
      }, delay);
    });
  }

  function refreshBuilderResults() {
    loadRuns();
    loadDoctor();
    loadEpisodeStudio();
    loadPowerTeaserStudio();
    loadContentStorage();
    loadLatestVideoJob();
  }

  async function buildPowerTeaserDryRun(characterId = "kairo") {
    setPowerTeaserStatus("building");
    try {
      const response = await fetch("/api/video-agent/power-teasers/dry-run", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ characterId }),
      });
      if (response.status === 401) {
        window.localStorage.removeItem(adminSessionKey);
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Unable to build power teaser dry run");
      setPowerTeaserStatus("done");
      await loadPowerTeaserStudio();
      await loadContentStorage();
    } catch {
      setPowerTeaserStatus("error");
    }
  }

  async function startProductionRun() {
    setProductionRunStatus("running");
    try {
      const response = await fetch("/api/production/runs", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          mode: productionMode,
          characterId: videoCharacterId,
          confirmLiveSpend,
          brief: "Build the next Opaija vertical anime production packet with exact character continuity, full storyboard action movement, and Seedance-ready handoff.",
        }),
      });
      if (!response.ok) throw new Error("Unable to start production run");
      setProductionRunStatus("done");
      await loadProductionRuns();
      await loadProductionMemory();
    } catch {
      setProductionRunStatus("error");
    }
  }

  async function reviewRun(id: string, reviewStatus: "approved" | "rejected") {
    setReviewingId(id);
    try {
      const response = await fetch(`/api/video-agent/runs/${id}/review`, {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: reviewStatus }),
      });
      if (!response.ok) throw new Error("Unable to review run");
      await loadRuns();
    } finally {
      setReviewingId("");
    }
  }

  async function renderRun(id: string) {
    setRenderingId(id);
    setRenderStatus("idle");
    try {
      const response = await fetch(`/api/video-agent/runs/${id}/render`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          keyframeProvider,
          clipProvider,
          voiceProvider,
          storyboardFrameProvider,
          waitForClip,
          confirmLiveSpend,
        }),
      });
      if (!response.ok) throw new Error("Unable to render storyboard");
      setRenderStatus("queued");
      window.setTimeout(loadRuns, 3000);
    } catch {
      setRenderStatus("error");
    } finally {
      setRenderingId("");
    }
  }

  async function processApprovedQueue() {
    setApprovedQueueStatus("idle");
    try {
      const response = await fetch("/api/video-agent/approved-queue", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          keyframeProvider,
          clipProvider,
          voiceProvider,
          storyboardFrameProvider,
          waitForClip,
          confirmLiveSpend,
          maxRuns: 3,
          renderWidth: clipProvider === "mock" ? 360 : undefined,
          renderHeight: clipProvider === "mock" ? 640 : undefined,
          renderDurationFrames: clipProvider === "mock" ? 60 : undefined,
        }),
      });
      if (!response.ok) throw new Error("Unable to process approved queue");
      setApprovedQueueStatus("queued");
      window.setTimeout(loadRuns, 3500);
      await loadApprovedQueue();
    } catch {
      setApprovedQueueStatus("error");
    }
  }

  async function buildSeasonStoryboards() {
    setSeasonBatchStatus("running");
    try {
      const response = await fetch("/api/video-agent/season-storyboards", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          characterIds: characters.filter((character) => character.status === "locked" && character.image).map((character) => character.id),
        }),
      });
      if (!response.ok) throw new Error("Unable to build Season 1 storyboards");
      const data = (await response.json()) as SeasonStoryboardBatchSummary;
      setSeasonBatch(data);
      setSeasonBatchStatus(data.ok ? "done" : "error");
      await loadRuns();
      await loadDoctor();
      await loadApprovedQueue();
      await loadSeasonBatch();
    } catch {
      setSeasonBatchStatus("error");
    }
  }

  async function approveSeasonStoryboards() {
    setSeasonApprovalStatus("saving");
    try {
      const response = await fetch("/api/video-agent/season-storyboards/approve", {
        method: "POST",
        headers: getAdminHeaders(),
      });
      const data = (await response.json()) as SeasonStoryboardBatchApproval;
      if (!response.ok) throw new Error("Unable to approve Season 1 storyboards");
      setSeasonApproval(data);
      setSeasonApprovalStatus(data.ok ? "saved" : "error");
      await loadRuns();
      await loadApprovedQueue();
      await loadDoctor();
    } catch {
      setSeasonApprovalStatus("error");
    }
  }

  async function saveApprovedQueueSchedule(mode: "off" | "mock" | "production") {
    setApprovedQueueScheduleStatus("saving");
    try {
      const productionClipProvider = productionDecision?.clipProvider;
      const body =
        mode === "off"
          ? { enabled: false }
          : {
              enabled: true,
              intervalMinutes: 30,
              maxRuns: 3,
              keyframeProvider: mode === "production" ? "openai" : "mock",
              clipProvider: mode === "production" ? productionClipProvider : "mock",
              voiceProvider: mode === "production" ? "openai" : "mock",
              storyboardFrameProvider: mode === "production" ? "openai" : "mock",
              waitForClip: mode === "production",
              confirmLiveSpend: mode === "production" && confirmLiveSpend,
              renderWidth: mode === "mock" ? 360 : undefined,
              renderHeight: mode === "mock" ? 640 : undefined,
              renderDurationFrames: mode === "mock" ? 60 : undefined,
            };
      const response = await fetch("/api/video-agent/approved-queue/schedule", {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Unable to update approved queue schedule");
      const data = (await response.json()) as ApprovedQueueScheduleStatus;
      setApprovedQueueSchedule(data);
      setApprovedQueueScheduleStatus("saved");
    } catch {
      setApprovedQueueScheduleStatus("error");
    }
  }

  async function runSmokeTest(provider: ProviderSmokeTestRecord["provider"], confirmLiveSpend = false) {
    setSmokeStatus("running");
    try {
      const response = await fetch("/api/video-agent/provider-smoke-tests", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ provider, confirmLiveSpend }),
      });
      if (!response.ok) throw new Error("Unable to run smoke test");
      setSmokeStatus("done");
      await loadSmokeTests();
      await loadProviderComparison();
      await loadReadiness();
      await loadDoctor();
    } catch {
      setSmokeStatus("error");
    }
  }

  async function runWorkflowSmokeTest(confirmLiveSpend = false) {
    setWorkflowSmokeStatus("running");
    try {
      const response = await fetch("/api/video-agent/provider-smoke-tests/storyboard-to-seedance", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirmLiveSpend }),
      });
      if (!response.ok) throw new Error("Unable to run storyboard-to-Seedance smoke test");
      setWorkflowSmokeStatus("done");
      await loadSmokeTests();
      await loadProviderComparison();
      await loadReadiness();
      await loadDoctor();
    } catch {
      setWorkflowSmokeStatus("error");
      await loadBakeoffPreflight();
      await loadProviderComparison();
    }
  }

  async function runProviderBakeoff(confirmLiveSpend = false) {
    setWorkflowSmokeStatus("running");
    try {
      const response = await fetch("/api/video-agent/provider-smoke-tests/bakeoff", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirmLiveSpend }),
      });
      if (!response.ok) throw new Error("Unable to run provider bakeoff");
      setWorkflowSmokeStatus("done");
      await loadSmokeTests();
      await loadProviderComparison();
      await loadReadiness();
      await loadDoctor();
    } catch {
      setWorkflowSmokeStatus("error");
    }
  }

  async function completeSmokeTest(id: string) {
    setCompletingSmokeId(id);
    try {
      const response = await fetch(`/api/video-agent/provider-smoke-tests/${id}/complete`, {
        method: "POST",
        headers: getAdminHeaders(),
      });
      if (!response.ok) throw new Error("Unable to complete smoke test");
      await loadSmokeTests();
      await loadProviderComparison();
      await loadReadiness();
      await loadDoctor();
    } catch {
      setSmokeStatus("error");
    } finally {
      setCompletingSmokeId("");
    }
  }

  async function completeQueuedSmokeTests() {
    setCompletingSmokeId("all");
    try {
      const response = await fetch("/api/video-agent/provider-smoke-tests/complete-queued", {
        method: "POST",
        headers: getAdminHeaders(),
      });
      if (!response.ok) throw new Error("Unable to complete queued smoke tests");
      await loadSmokeTests();
      await loadProviderComparison();
      await loadReadiness();
      await loadDoctor();
    } catch {
      setSmokeStatus("error");
    } finally {
      setCompletingSmokeId("");
    }
  }

  async function scoreSmokeTest(id: string, score: number) {
    try {
      const response = await fetch(`/api/video-agent/provider-smoke-tests/${id}/review`, {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          characterConsistency: score,
          motionQuality: score,
          artifactControl: score,
          storyClarity: score,
          costScore: score,
          speedScore: score,
          note: `Quick ${score}/10 operator score`,
        }),
      });
      if (!response.ok) throw new Error("Unable to score smoke test");
      await loadSmokeTests();
      await loadProviderComparison();
    } catch {
      setSmokeStatus("error");
    }
  }

  async function applyProductionWinner() {
    setDecisionStatus("saving");
    try {
      const response = await fetch("/api/video-agent/production-decision/apply-winner", {
        method: "POST",
        headers: getAdminHeaders(),
      });
      if (!response.ok) throw new Error("Unable to apply production winner");
      const data = (await response.json()) as VideoProductionDecision;
      setProductionDecision(data);
      setDecisionStatus("saved");
      await loadProviderComparison();
      await loadApprovedQueueSchedule();
    } catch {
      setDecisionStatus("error");
    }
  }

  async function saveSchedule(mode: "off" | "mock" | "production") {
    setScheduleStatus("saving");
    try {
      const lockedCharacterIds = characters.filter((character) => character.status === "locked" && character.image).map((character) => character.id);
      const body =
        mode === "off"
          ? { enabled: false }
          : {
              enabled: true,
              times: ["09:00", "19:00"],
              timezone: "server-local",
              characterIds: lockedCharacterIds,
              keyframeProvider: mode === "production" ? "openai" : "mock",
              clipProvider: mode === "production" ? "seedance" : "mock",
              voiceProvider: mode === "production" ? "elevenlabs" : "mock",
              storyboardDirectorProvider: "local",
              storyboardFrameProvider: mode === "production" ? "openai" : "mock",
              storyboardOnly: true,
              waitForClip: mode === "production",
              requireLlm: mode === "production",
            };
      const response = await fetch("/api/video-agent/schedule", {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Unable to update schedule");
      const data = (await response.json()) as VideoAgentScheduleStatus;
      setSchedule(data);
      setScheduleStatus("saved");
      await loadDoctor();
    } catch {
      setScheduleStatus("error");
    }
  }

  const latestRun = runs[0];
  const latestRunIsVideo = Boolean(latestRun?.publicVideoPath || latestRun?.outputPath);
  const selectedStudioFrame =
    episodeStudio?.frames.find((frame) => frame.panelId === selectedStudioPanelId) ?? episodeStudio?.frames[0];
  const studioClipCount = episodeStudio?.frames.filter((frame) => frame.clipStatus === "ready").length ?? 0;
  const studioArtCount = episodeStudio?.frames.filter((frame) => Boolean(frame.imagePath)).length ?? 0;

  return (
    <div className="view-grid book-room">
      <section className="panel start-here-panel">
        <PanelHeader icon={Clapperboard} title="Start Here" action="Storyboard and video builder" />
        <div className="book-hero">
          <div>
            <span className="signal">Simple production path</span>
            <h2>Pick a character, build a storyboard, then make a test video.</h2>
            <p>
              Use these buttons first. They use safe mock providers, so they create packets and test videos without
              spending on OpenAI, Seedance, or voice credits. Use the advanced controls below only after the test looks right.
            </p>
          </div>
          <div className="book-metrics">
            {[
              { label: "Step 1", value: "Character", detail: characters.find((character) => character.id === videoCharacterId)?.shortName ?? videoCharacterId },
              { label: "Step 2", value: "Storyboard", detail: "Creates shot list, panels, prompts, QC" },
              { label: "Step 3", value: "Test MP4", detail: "Renders a small proof video" },
              { label: "Live", value: "Later", detail: "Enable paid providers after review" },
            ].map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="public-actions builder-actions">
          <label className="agent-control">
            <span>Character</span>
            <select value={videoCharacterId} onChange={(event) => setVideoCharacterId(event.target.value)}>
              {characters
                .filter((character) => character.image)
                .map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.shortName}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-action"
            onClick={() => runSimpleBuilder("storyboard")}
            disabled={simpleBuilderStatus === "storyboard" || simpleBuilderStatus === "video"}
          >
            <Layers3 size={18} />
            {simpleBuilderStatus === "storyboard" ? "Building Storyboard" : "1. Build Storyboard"}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => runSimpleBuilder("video")}
            disabled={simpleBuilderStatus === "storyboard" || simpleBuilderStatus === "video"}
          >
            <Play size={18} />
            {simpleBuilderStatus === "video" ? "Making Test Video" : "2. Make Test Video"}
          </button>
          <button type="button" className="ghost-action" onClick={refreshBuilderResults}>
            <RefreshCw size={18} />
            3. Refresh Results
          </button>
        </div>
        {simpleBuilderStatus === "done" && (
          <p className="agent-output">Builder started. The live job status below updates automatically while the storyboard or video renders.</p>
        )}
        {simpleBuilderStatus === "error" && (
          <p className="gate-error">The simple builder could not start. The API may need a restart or the session may need login again.</p>
        )}
        {activeVideoJob ? (
          <div className="workflow-decision latest-builder-result">
            <article>
              <span className={`agent-state ${activeVideoJob.status === "failed" ? "blocked" : activeVideoJob.status === "completed" ? "online" : "building"}`}>
                Job {activeVideoJob.status}
              </span>
              <h3>{activeVideoJob.options.storyboardOnly ? "Storyboard build" : "Test video render"}</h3>
              <p>
                {activeVideoJob.status === "completed"
                  ? "The background job finished. The latest result below should now show the storyboard or video."
                  : activeVideoJob.status === "failed"
                    ? activeVideoJob.error ?? "The job stopped before finishing. The log below shows the last output."
                    : "The agent is running in the background. Video renders can take a minute or two on this machine."}
              </p>
              <small>
                Job {activeVideoJob.id}
                {activeVideoJob.pid ? ` / PID ${activeVideoJob.pid}` : ""} / {formatBlogDate(activeVideoJob.updatedAt)}
              </small>
            </article>
            <article>
              <span className="agent-state building">Live log</span>
              <h3>Render output</h3>
              <pre className="job-log-preview">
                {activeVideoJob.logTail
                  ? activeVideoJob.logTail.split("\n").slice(-8).join("\n")
                  : "Waiting for the first renderer log line..."}
              </pre>
            </article>
          </div>
        ) : null}
        {latestRun ? (
          <div className="workflow-decision latest-builder-result">
            <article>
              <span className={`agent-state ${latestRun.status === "rendered" ? "online" : "building"}`}>
                Latest result
              </span>
              <h3>{latestRun.title}</h3>
              <p>{latestRun.characterName ?? "Selected character"} / {latestRun.status}</p>
              <small>
                {latestRunIsVideo
                  ? "Video file is ready."
                  : "Storyboard packet is ready. Use the review panel below to inspect panels and prompts."}
              </small>
              <div className="review-actions">
                <button type="button" className="ghost-action" onClick={() => loadRunArtifacts(latestRun.id)}>
                  <Layers3 size={16} />
                  Show Storyboard
                </button>
                {latestRun.publicVideoPath ? (
                  <a className="primary-action" href={latestRun.publicVideoPath} target="_blank" rel="noreferrer">
                    <Play size={16} />
                    Open Video
                  </a>
                ) : null}
              </div>
            </article>
            <article>
              <span className="agent-state online">What happened</span>
              <h3>{latestRun.status === "rendered" ? "Test video made" : "Storyboard built"}</h3>
              <p>
                {latestRun.status === "rendered"
                  ? "The renderer created a small proof MP4 with mock providers."
                  : "The system created story, storyboard shots, panel sheet, contact sheet, QC, and Seedance prompts."}
              </p>
              <small>{formatBlogDate(latestRun.createdAt)}</small>
            </article>
          </div>
        ) : null}
      </section>

      <section className="panel episode-studio-panel">
        <PanelHeader icon={Zap} title="Power Teaser Studio" action="Audio-action first" />
        {!powerTeaserStudio ? (
          <div className="empty-state">
            <strong>Power teaser studio is loading.</strong>
            <span>Refresh results if the API was just restarted.</span>
          </div>
        ) : (
          <>
            <div className="studio-command-strip">
              <article>
                <span className="agent-state online">Vertical launch format</span>
                <h2>{powerTeaserStudio.title}</h2>
                <p>{powerTeaserStudio.summary}</p>
                <p className="studio-lockline">
                  Teasers: {powerTeaserStudio.firstFormat.teaserRuntimeSec}s / Episodes: {powerTeaserStudio.firstFormat.episodeRuntimeSec}s.{" "}
                  {powerTeaserStudio.firstFormat.compilationGoal}
                </p>
              </article>
              <div className="studio-command-metrics">
                <span>
                  <strong>{powerTeaserStudio.firstFormat.teaserRuntimeSec}s</strong>
                  Power teaser
                </span>
                <span>
                  <strong>{powerTeaserStudio.firstFormat.episodeRuntimeSec}s</strong>
                  Vertical episode
                </span>
                <span>
                  <strong>0.25s</strong>
                  Teaser sync gate
                </span>
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => buildPowerTeaserDryRun("kairo")}
                  disabled={powerTeaserStatus === "building"}
                >
                  <Zap size={16} />
                  {powerTeaserStatus === "building" ? "Building Kai Grid" : "Build Kai Dry Run"}
                </button>
              </div>
            </div>
            {powerTeaserStatus === "done" ? (
              <p className="agent-output">Kai power teaser dry run is ready for review. No paid animation was generated.</p>
            ) : null}
            {powerTeaserStatus === "error" ? <p className="gate-error">Power teaser dry run could not start. Log in again or restart the API.</p> : null}

            <div className="reference-lock-panel">
              <div>
                <span className="signal">Launch characters</span>
                <h3>One teaser per power set</h3>
                <p>Start with character-power showcases before longer episodes so style, action, and audience hooks are locked.</p>
              </div>
              <div className="reference-lock-grid">
                {powerTeaserStudio.launchCharacters.map((character) => (
                  <article key={character.id}>
                    <img src={character.referencePath} alt={`${character.shortName} approved character sheet`} />
                    <div>
                      <strong>{character.shortName}</strong>
                      <span>{character.power} / {character.weapon}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {powerTeaserStudio.activePackage ? (
              <>
                <div className="studio-stage-rail">
                  {powerTeaserStudio.workflow.map((stage, index) => (
                    <article key={stage} className={`studio-stage-card ${index < 4 ? "passed" : "waiting"}`}>
                      <span>Agent {index + 1}</span>
                      <strong>{index < 4 ? "ready" : "next"}</strong>
                      <p>{stage}</p>
                    </article>
                  ))}
                </div>
                <div className="episode-studio-layout">
                  <article className="episode-preview-card">
                    <div className="episode-preview-top">
                      <span className={`agent-state ${powerTeaserStudio.activePackage.qc.status === "passed" ? "online" : "blocked"}`}>
                        QC {powerTeaserStudio.activePackage.qc.status}
                      </span>
                      <span>{powerTeaserStudio.activePackage.status.replace(/_/g, " ")}</span>
                    </div>
                    <img
                      className="episode-selected-image"
                      src={powerTeaserStudio.activePackage.character.referencePath}
                      alt={`${powerTeaserStudio.activePackage.character.shortName} approved bible sheet`}
                    />
                    <h3>{powerTeaserStudio.activePackage.character.shortName} Power Teaser</h3>
                    <p>{powerTeaserStudio.activePackage.styleLock.summary}</p>
                    <small>
                      Planned {powerTeaserStudio.activePackage.runtimeTargetSec.planned}s / target{" "}
                      {powerTeaserStudio.activePackage.runtimeTargetSec.min}-{powerTeaserStudio.activePackage.runtimeTargetSec.max}s
                    </small>
                  </article>
                  <article className="episode-qc-card">
                    <span className="signal">Audio-action rule</span>
                    <h3>Voice must follow the fight</h3>
                    <p>{powerTeaserStudio.activePackage.audioActionRules.rule}</p>
                    <div className="editor-status-list">
                      <span>{powerTeaserStudio.activePackage.audioActionRules.maxDriftSec}s max drift</span>
                      <span>{powerTeaserStudio.activePackage.voiceLines.length} voice lines</span>
                      <span>{powerTeaserStudio.activePackage.beats.length} action beats</span>
                    </div>
                    <ol>
                      {powerTeaserStudio.activePackage.voiceLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  </article>
                  <article className="episode-qc-card">
                    <span className={`agent-state ${powerTeaserStudio.activePackage.qc.status === "passed" ? "online" : "blocked"}`}>
                      style lock
                    </span>
                    <h3>Before Animation QC</h3>
                    <ul className="memory-list">
                      {powerTeaserStudio.activePackage.qc.checks.map((check) => (
                        <li key={check.id}>
                          <CheckCircle2 size={16} />
                          <span>{check.message}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="forbidden-grid">
                      {powerTeaserStudio.activePackage.styleLock.forbidden.slice(0, 6).map((rule) => (
                        <span key={rule}>{rule}</span>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="episode-media-section">
                  <div className="episode-media-header">
                    <h3>Audio-Action Beat Sheet</h3>
                    <span>Voice, SFX, music, and impact frames locked before animation.</span>
                  </div>
                  <div className="episode-clip-grid">
                    {powerTeaserStudio.activePackage.beats.map((beat) => (
                      <article key={beat.beatId} className="episode-clip-card">
                        <div className="empty-state">
                          {beat.startSec}s - {beat.endSec}s
                        </div>
                        <div>
                          <span className="agent-state online">{beat.beatId} / {beat.durationSec}s</span>
                          <h4>{beat.label}</h4>
                          <small>{beat.visualAction}</small>
                          <small>Camera: {beat.cameraMove}</small>
                          <small>SFX: {beat.sfx}</small>
                          <small>Music: {beat.musicHit}</small>
                          {beat.voiceLine ? <small>Voice {beat.voicePlacement}: {beat.voiceLine}</small> : <small>No voice line; action carries this beat.</small>}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="episode-media-section">
                  <div className="episode-media-header">
                    <h3>Storyboard Pose Prompts</h3>
                    <span>Start, impact, and end poses for Seedance reference animation.</span>
                  </div>
                  <div className="episode-frame-grid">
                    {powerTeaserStudio.activePackage.storyboardPanels.slice(0, 9).map((panel) => (
                      <article key={panel.panelId} className="episode-frame-card">
                        <div className="empty-state">{panel.poseType}</div>
                        <div>
                          <span className="agent-state building">{panel.panelId}</span>
                          <h4>{panel.seedanceRole}</h4>
                          <small>{panel.prompt}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <strong>No power teaser dry run yet.</strong>
                <span>Click Build Kai Dry Run to create the first audio-action package.</span>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel episode-studio-panel">
        <PanelHeader icon={Clapperboard} title="Episode 1 Storyboard Studio" action="Production desk" />
        {!episodeStudio ? (
          <div className="empty-state">
            <strong>Studio is loading.</strong>
            <span>Refresh results if the API was just restarted.</span>
          </div>
        ) : (
          <>
            <div className="studio-command-strip">
              <article>
                <span className={`agent-state ${episodeStudio.qc.status === "failed" ? "blocked" : "online"}`}>
                  {episodeStudio.qc.status === "failed" ? "Do Not Publish" : episodeStudio.status}
                </span>
                <h2>{episodeStudio.title}</h2>
                <p>{episodeStudio.qc.summary}</p>
                <p className="studio-lockline">
                  Style lock: {episodeStudio.package.styleLock}
                  {" "}
                  Editor: {episodeStudio.editor.status === "ready_for_review" ? "AI editor built" : "waiting for clips"}.
                </p>
              </article>
              <div className="studio-command-metrics">
                <span>
                  <strong>{studioArtCount}/{episodeStudio.frames.length}</strong>
                  Artwork
                </span>
                <span>
                  <strong>{studioClipCount}/{episodeStudio.frames.length}</strong>
                  Clips
                </span>
                <span>
                  <strong>{episodeStudio.package.aspectRatio}</strong>
                  Format
                </span>
                <button type="button" className="ghost-action" onClick={refreshBuilderResults}>
                  <RefreshCw size={16} />
                  Refresh Studio
                </button>
              </div>
            </div>

            <div className="studio-stage-rail">
              {episodeStudio.stageFlow.map((stage) => (
                <article key={stage.id} className={`studio-stage-card ${stage.status}`}>
                  <span>{stage.label}</span>
                  <strong>{stage.count ?? stage.status}</strong>
                  <p>{stage.summary}</p>
                </article>
              ))}
            </div>

            <div className="episode-studio-layout">
              <article className="episode-preview-card">
                <div className="episode-preview-top">
                  <span className={`agent-state ${selectedStudioFrame?.clipStatus === "ready" ? "online" : episodeStudio.qc.status === "failed" ? "blocked" : "building"}`}>
                    {selectedStudioFrame ? `${selectedStudioFrame.panelId} / ${selectedStudioFrame.clipStatus}` : "Preview"}
                  </span>
                  <span>{episodeStudio.providerMode ?? "studio"} / {episodeStudio.package.providerTarget}</span>
                </div>
                {selectedStudioFrame?.clipPath ? (
                  <video src={selectedStudioFrame.clipPath} controls preload="metadata" />
                ) : selectedStudioFrame?.imagePath ? (
                  <img className="episode-selected-image" src={selectedStudioFrame.imagePath} alt={`${selectedStudioFrame.panelId} selected storyboard`} />
                ) : episodeStudio.finalVideo?.publicPath ? (
                  <video src={episodeStudio.finalVideo.publicPath} controls preload="metadata" />
                ) : (
                  <div className="empty-state">No assembled video preview yet.</div>
                )}
                <h3>{selectedStudioFrame?.title ?? episodeStudio.title}</h3>
                {selectedStudioFrame ? (
                  <div className="selected-shot-notes">
                    <p>{selectedStudioFrame.motion}</p>
                    <dl>
                      <div>
                        <dt>Camera</dt>
                        <dd>{selectedStudioFrame.camera ?? "Motion note only"}</dd>
                      </div>
                      <div>
                        <dt>Start</dt>
                        <dd>{selectedStudioFrame.actionStart ?? "Needs action-pair board"}</dd>
                      </div>
                      <div>
                        <dt>Impact</dt>
                        <dd>{selectedStudioFrame.actionImpact ?? "Needs action-pair board"}</dd>
                      </div>
                      <div>
                        <dt>End</dt>
                        <dd>{selectedStudioFrame.actionEnd ?? "Needs action-pair board"}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
                <small>
                  {episodeStudio.finalVideo?.probe
                    ? `${Math.round(episodeStudio.finalVideo.probe.duration)}s / ${episodeStudio.finalVideo.probe.width}x${episodeStudio.finalVideo.probe.height}`
                    : "Waiting for video probe"}
                  {episodeStudio.updatedAt ? ` / ${formatBlogDate(episodeStudio.updatedAt)}` : ""}
                </small>
              </article>
              <article className="episode-qc-card">
                <span className="signal">QC gate</span>
                <h3>{episodeStudio.qc.status === "pending" ? "Ready For Human Review" : "Blocked Before Animation"}</h3>
                <p>{episodeStudio.qc.gate}</p>
                <ul className="memory-list">
                  {episodeStudio.qc.blockers.map((blocker) => (
                    <li key={blocker}>
                      <CheckCircle2 size={16} />
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
                <div className="forbidden-grid">
                  {episodeStudio.qc.forbidden.slice(0, 8).map((rule) => (
                    <span key={rule}>{rule}</span>
                  ))}
                </div>
                {episodeStudio.voice ? (
                  <div className="voice-qc">
                    <strong>Voice: {episodeStudio.voice.quality}</strong>
                    <span>{episodeStudio.voice.note}</span>
                    {episodeStudio.voice.path ? <audio src={episodeStudio.voice.path} controls preload="metadata" /> : null}
                  </div>
                ) : null}
              </article>
              {episodeStudio.timing ? (
                <article className="episode-qc-card">
                  <span className={`agent-state ${episodeStudio.timing.qcStatus === "timing_failed" ? "blocked" : "online"}`}>
                    timing {episodeStudio.timing.qcStatus}
                  </span>
                  <h3>Narration Timing Sheet</h3>
                  <p>
                    {episodeStudio.timing.targetWpm} WPM / {Math.round(episodeStudio.timing.totalDurationSec)}s planned
                    {episodeStudio.timing.audioDurationSec ? ` / ${Math.round(episodeStudio.timing.audioDurationSec)}s audio` : ""}
                    {episodeStudio.timing.driftSec !== undefined ? ` / ${episodeStudio.timing.driftSec.toFixed(2)}s drift` : ""}
                  </p>
                  <div className="editor-status-list">
                    <span>{episodeStudio.timing.panels.length} timed panels</span>
                    <span>max drift {episodeStudio.timing.maxAudioVideoDriftSec}s</span>
                    <span>{episodeStudio.timing.status.replace("_", " ")}</span>
                  </div>
                  <ul className="memory-list">
                    {episodeStudio.timing.panels.slice(0, 4).map((panel) => (
                      <li key={`timing-${panel.panelId}`}>
                        <Clock3 size={16} />
                        <span>
                          {panel.panelId}: {panel.finalClipDurationSec}s / {panel.wordCount} words
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </div>

            <div className="reference-lock-panel">
              <div>
                <span className="signal">Reference lock</span>
                <h3>{episodeStudio.references.styleSource}</h3>
                <p>{episodeStudio.references.globalStyleLock}</p>
              </div>
              <div className="reference-lock-grid">
                {episodeStudio.references.characters.map((character) => (
                  <article key={character.id}>
                    <img src={character.referencePath} alt={`${character.name} approved model sheet`} />
                    <div>
                      <strong>{character.name}</strong>
                      <span>{character.locks.slice(0, 4).join(" / ")}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="episode-fix-grid">
              {episodeStudio.qc.nextFixes.map((fix) => (
                <article key={fix}>
                  <Sparkles size={17} />
                  <span>{fix}</span>
                </article>
              ))}
            </div>
            <div className="episode-media-section">
              <div className="episode-media-header">
                <h3>Storyboard Artwork</h3>
                <span>{episodeStudio.package.referenceRule}</span>
              </div>
              <div className="episode-frame-grid">
                {episodeStudio.frames.map((frame) => (
                  <article
                    key={`art-${frame.panelId}`}
                    className={`episode-frame-card ${selectedStudioFrame?.panelId === frame.panelId ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedStudioPanelId(frame.panelId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedStudioPanelId(frame.panelId);
                    }}
                  >
                    {frame.imagePath ? <img src={frame.imagePath} alt={`${frame.panelId} storyboard frame`} /> : <div className="empty-state">Missing art</div>}
                    <div>
                      <span className={`agent-state ${frame.clipStatus === "ready" ? "online" : frame.clipStatus === "error" ? "blocked" : "building"}`}>
                        {frame.panelId} / {frame.clipStatus}
                      </span>
                      <h4>{frame.title}</h4>
                      <small>{frame.characters.join(", ") || "No character tag"}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="episode-media-section">
              <div className="episode-media-header">
                <h3>Animation Clips</h3>
                <span>{episodeStudio.package.nextStep}</span>
              </div>
              <div className="episode-clip-grid">
                {episodeStudio.frames.map((frame) => (
                  <article
                    key={`clip-${frame.panelId}`}
                    className={`episode-clip-card ${selectedStudioFrame?.panelId === frame.panelId ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedStudioPanelId(frame.panelId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedStudioPanelId(frame.panelId);
                    }}
                  >
                    {frame.clipPath ? <video src={frame.clipPath} controls preload="metadata" /> : <div className="empty-state">Clip not ready</div>}
                    <div>
                      <span className={`agent-state ${frame.clipStatus === "ready" ? "online" : frame.clipStatus === "error" ? "blocked" : "building"}`}>
                        {frame.imageRef} / {frame.clipStatus}
                      </span>
                      <h4>{frame.title}</h4>
                      <small>{frame.durationSec ? `${frame.durationSec}s / ` : ""}{frame.emotion ?? frame.fx ?? "Motion note ready"}</small>
                      {frame.error ? <small>{frame.error}</small> : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="studio-editor-grid">
              <article>
                <span className={`agent-state ${episodeStudio.editor.status === "ready_for_review" ? "online" : "building"}`}>
                  AI editor {episodeStudio.editor.status === "ready_for_review" ? "built" : "waiting"}
                </span>
                <h3>Clip Assembly + Audio</h3>
                <p>{episodeStudio.editor.note}</p>
                <div className="editor-status-list">
                  <span>{episodeStudio.editor.clipsAssembled}/{episodeStudio.editor.totalClips} clips assembled</span>
                  <span>{episodeStudio.editor.audioAttached ? "Audio attached" : "Audio missing"}</span>
                  <span>{episodeStudio.editor.finalVideoPath ? "Preview exported" : "No export yet"}</span>
                </div>
              </article>
              <article>
                <span className="signal">Clean text layer</span>
                <h3>Remotion Edit Layer</h3>
                <p>{episodeStudio.editor.remotionLayer}</p>
                <p>
                  Storyboard frames stay text-free. Captions, CTA, title, and thumbnail copy belong in the editor layer
                  after artwork QC passes.
                </p>
              </article>
              <article>
                <span className="signal">Voice map</span>
                <h3>Performance Direction</h3>
                <ol>
                  {episodeStudio.package.voiceover.slice(0, 4).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </article>
              <article>
                <span className="signal">Workflow sources</span>
                <h3>Modeled Flow</h3>
                <div className="source-link-list">
                  {episodeStudio.sourceLinks.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
              </article>
            </div>
          </>
        )}
      </section>

      <section className="panel content-storage-panel">
        <PanelHeader icon={Archive} title="Content Storage" action="Videos, boards, clips, audio" />
        {contentStorage.length === 0 ? (
          <div className="empty-state">
            <strong>No stored content yet.</strong>
            <span>The next rebuild will register its final video, frames, clips, audio, and manifest here.</span>
          </div>
        ) : (
          <div className="content-storage-grid">
            {contentStorage.slice(0, 6).map((item) => {
              const videoAsset = item.assets.find((asset) => asset.type === "video" && asset.publicPath);
              const previewAsset = item.assets.find((asset) => (asset.type === "image" || asset.type === "clip") && asset.publicPath);
              return (
                <article key={item.id} className="content-storage-card">
                  <div className="content-storage-preview">
                    {videoAsset?.publicPath ? (
                      <video src={videoAsset.publicPath} controls preload="metadata" />
                    ) : previewAsset?.type === "image" && previewAsset.publicPath ? (
                      <img src={previewAsset.publicPath} alt={`${item.title} preview`} />
                    ) : previewAsset?.publicPath ? (
                      <video src={previewAsset.publicPath} controls preload="metadata" />
                    ) : (
                      <div className="empty-state">No preview</div>
                    )}
                  </div>
                  <div className="content-storage-body">
                    <span className={`agent-state ${item.status === "approved" ? "online" : item.status === "rejected" ? "blocked" : "building"}`}>
                      {item.status.replace("_", " ")}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.style}</p>
                    <small>
                      {item.assets.length} assets / {formatBlogDate(item.updatedAt)}
                    </small>
                    <div className="content-asset-links">
                      {item.assets
                        .filter((asset) => asset.publicPath)
                        .slice(0, 5)
                        .map((asset) => (
                          <a key={`${item.id}-${asset.label}-${asset.publicPath}`} href={asset.publicPath} target="_blank" rel="noreferrer">
                            {asset.type}: {asset.label}
                          </a>
                        ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <PanelHeader icon={Brain} title="Workflow Decision" action="Qwen-led multi-LLM" />
        <div className="workflow-decision">
          <article>
            <span className="agent-state online">Use now</span>
            <h3>Qwen brain</h3>
            <p>Local Qwen plans the story, agent tasks, storyboard action, QC summaries, social copy, and memory updates.</p>
          </article>
          <article>
            <span className="agent-state building">Escalate only</span>
            <h3>Cloud polish</h3>
            <p>OpenAI or OpenRouter repairs weak JSON, handles style audits, and tightens final prompts when production mode needs it.</p>
          </article>
          <article>
            <span className="agent-state online">Reference</span>
            <h3>Provider split</h3>
            <p>GPT Image creates storyboard frames, Seedance animates the ordered boards, voice renders narration, and Remotion exports.</p>
          </article>
        </div>
        <div className="workflow-path">
          {["Qwen", "Schema QC", "Cloud polish", "GPT Image", "Seedance", "Remotion", "Memory"].map((step) => (
            <span key={step}>
              <ArrowRight size={15} />
              {step}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={ServerCog} title="Qwen Production Room" action="Goose + Paperclip agents" />
        <div className="book-hero">
          <div>
            <span className="signal">Default brain: {modelRouter?.defaultBrain ?? "qwen-local"}</span>
            <h2>Build story, storyboard movement, QC, memory, and provider handoff from one Qwen-led run.</h2>
            <p>
              This creates a production packet without spending on media providers. Qwen writes the story and storyboard
              structure; schema checks block weak output; Hybrid and Production modes can escalate prompt repair or polish.
            </p>
          </div>
          <div className="book-metrics">
            {[
              { label: "Qwen model", value: modelRouter?.qwen.model ?? "qwen3", detail: modelRouter?.qwen.baseUrl ?? "http://localhost:11434" },
              { label: "Escalation", value: modelRouter?.escalationProvider ?? "openrouter", detail: modelRouter?.escalationModel ?? "configured model" },
              { label: "Runs", value: String(productionRuns.length), detail: productionRuns[0] ? formatBlogDate(productionRuns[0].createdAt) : "No production packet yet" },
              { label: "Memory", value: String(productionMemory?.events.length ?? 0), detail: `${productionMemory?.modelPerformance.length ?? 0} model records` },
            ].map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="public-actions">
          <label className="agent-control">
            <span>Mode</span>
            <select value={productionMode} onChange={(event) => setProductionMode(event.target.value as ProductionMode)}>
              <option value="local-qwen">Local Qwen</option>
              <option value="hybrid">Hybrid</option>
              <option value="production">Production</option>
            </select>
          </label>
          <button
            type="button"
            className="primary-action"
            onClick={startProductionRun}
            disabled={productionRunStatus === "running" || (productionMode === "production" && !confirmLiveSpend)}
          >
            <Brain size={18} />
            {productionRunStatus === "running" ? "Building" : "Build Qwen Packet"}
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => {
              loadProductionRuns();
              loadProductionMemory();
              loadModelRouter();
            }}
          >
            <RefreshCw size={18} />
            Refresh Qwen Room
          </button>
        </div>
        {productionRunStatus === "done" && <p className="agent-output">Qwen production packet created. Review the newest run below.</p>}
        {productionRunStatus === "error" && <p className="gate-error">Qwen production run failed. Check local Qwen, schema output, or escalation provider settings.</p>}
        {productionRuns.length ? (
          <div className="episode-product-grid storyboard-review-grid">
            {productionRuns.slice(0, 4).map((run) => (
              <article key={run.id}>
                <span className={`agent-state ${run.status === "storyboard-ready" ? "online" : "building"}`}>
                  {run.mode}
                </span>
                <h3>{run.title}</h3>
                <p>{run.characterName}</p>
                <small>QC {run.qcScore}/100 / {run.status}</small>
                <small>{run.nextAction}</small>
              </article>
            ))}
          </div>
        ) : null}
        {productionMemory?.events.length ? (
          <div className="agent-output">
            {productionMemory.events.slice(0, 5).map((event) => (
              <span key={event.id}>{event.type}: {event.summary}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <PanelHeader icon={Clapperboard} title="Video Agent" action="Auto-build anime shorts" />
        <div className="book-hero">
          <div>
            <span className="signal">Hybrid media pipeline</span>
            <h2>Plan, keyframe, generate clips, voice, edit, QC, and export from one packet.</h2>
            <p>
              The agent uses local-model planning, optional OpenAI keyframes, Seedance/Sora clip providers,
              controlled voiceover, and Remotion assembly. Each run writes a packet folder and a final MP4.
            </p>
          </div>
          <div className="book-metrics">
            {[
              { label: "Cadence", value: "2/day", detail: "Cron-ready social shorts" },
              { label: "Format", value: "9:16", detail: "1080x1920 Remotion export" },
              { label: "Packet", value: "10 files", detail: "Story, prompts, clips, captions, publish copy" },
              {
                label: "Approved",
                value: String(approvedQueue?.counts.eligible ?? 0),
                detail: `${approvedQueue?.counts.rendered ?? 0} rendered / ${approvedQueue?.counts.blocked ?? 0} blocked`,
              },
              {
                label: "Schedule",
                value: schedule?.enabled ? "On" : "Off",
                detail: schedule?.nextRunAt ? `Next ${formatBlogDate(schedule.nextRunAt)}` : "Manual until enabled on server",
              },
              {
                label: "Season batch",
                value: seasonBatch ? `${seasonBatch.ready}/${seasonBatch.count}` : "None",
                detail: seasonBatch ? `${seasonBatch.failed} failed / ${formatBlogDate(seasonBatch.generatedAt)}` : "Build full cast storyboards",
              },
            ].map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="public-actions">
          <label className="agent-control">
            <span>Character</span>
            <select value={videoCharacterId} onChange={(event) => setVideoCharacterId(event.target.value)}>
              {characters
                .filter((character) => character.image)
                .map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.shortName}
                  </option>
                ))}
            </select>
          </label>
          <label className="agent-control">
            <span>Storyboard</span>
            <select
              value={storyboardDirectorProvider}
              onChange={(event) => setStoryboardDirectorProvider(event.target.value)}
            >
              <option value="local">Local</option>
              <option value="openai">ChatGPT/OpenAI</option>
            </select>
          </label>
          <label className="agent-control">
            <span>Frames</span>
            <select value={storyboardFrameProvider} onChange={(event) => setStoryboardFrameProvider(event.target.value)}>
              <option value="mock">Prompt only</option>
              <option value="openai">GPT Image</option>
            </select>
          </label>
          <label className="agent-control">
            <span>Keyframe</span>
            <select value={keyframeProvider} onChange={(event) => setKeyframeProvider(event.target.value)}>
              <option value="mock">Mock</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="agent-control">
            <span>Clip</span>
            <select value={clipProvider} onChange={(event) => setClipProvider(event.target.value)}>
              <option value="mock">Mock</option>
              <option value="seedance">Seedance</option>
              <option value="fal">fal</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="agent-control">
            <span>Voice</span>
            <select value={voiceProvider} onChange={(event) => setVoiceProvider(event.target.value)}>
              <option value="mock">Mock</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="agent-toggle">
            <input type="checkbox" checked={storyboardOnly} onChange={(event) => setStoryboardOnly(event.target.checked)} />
            <span>Storyboard draft only</span>
          </label>
          <label className="agent-toggle">
            <input type="checkbox" checked={waitForClip} onChange={(event) => setWaitForClip(event.target.checked)} />
            <span>Wait for generated clip</span>
          </label>
          <button
            type="button"
            className="primary-action"
            onClick={startRun}
            disabled={
              startStatus === "starting" ||
              (!confirmLiveSpend && [keyframeProvider, clipProvider, voiceProvider, storyboardFrameProvider].some((provider) => provider !== "mock")) ||
              (!storyboardOnly && clipProvider !== "mock" && !productionDecision)
            }
          >
            <Play size={18} />
            {startStatus === "starting" ? "Starting" : "Run Video Agent"}
          </button>
          <button type="button" className="ghost-action" onClick={loadRuns}>
            <RefreshCw size={18} />
            Refresh Runs
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={buildSeasonStoryboards}
            disabled={seasonBatchStatus === "running"}
          >
            <Layers3 size={18} />
            {seasonBatchStatus === "running" ? "Building Season" : "Build Season Storyboards"}
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={approveSeasonStoryboards}
            disabled={!seasonBatch?.ready || seasonApprovalStatus === "saving"}
          >
            <CheckCircle2 size={18} />
            {seasonApprovalStatus === "saving" ? "Approving Batch" : "Approve Season Batch"}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={processApprovedQueue}
            disabled={
              approvedQueueStatus === "queued" ||
              (!confirmLiveSpend && [keyframeProvider, clipProvider, voiceProvider, storyboardFrameProvider].some((provider) => provider !== "mock")) ||
              (confirmLiveSpend &&
                [keyframeProvider, clipProvider, voiceProvider, storyboardFrameProvider].some((provider) => provider !== "mock") &&
                !productionDecision)
            }
          >
            <FolderKanban size={18} />
            Build Approved Queue
          </button>
        </div>
        {startStatus === "queued" && <p className="agent-output">Video agent queued. Refresh in a minute to see the render.</p>}
        {startStatus === "error" && <p className="gate-error">Unable to start the video agent from the API.</p>}
        {renderStatus === "queued" && <p className="agent-output">Storyboard render queued from the approved packet.</p>}
        {renderStatus === "error" && <p className="gate-error">Unable to queue storyboard render.</p>}
        {approvedQueueStatus === "queued" && <p className="agent-output">Approved storyboard queue started.</p>}
        {approvedQueueStatus === "error" && <p className="gate-error">Unable to start approved storyboard queue.</p>}
        {seasonBatchStatus === "done" && seasonBatch ? (
          <p className="agent-output">Season storyboard batch complete: {seasonBatch.ready}/{seasonBatch.count} packets ready.</p>
        ) : null}
        {seasonBatchStatus === "error" && (
          <p className="gate-error">
            Season storyboard batch failed{seasonBatch ? `: ${seasonBatch.ready}/${seasonBatch.count} packets ready.` : "."}
          </p>
        )}
        {seasonApprovalStatus === "saved" && seasonApproval ? (
          <p className="agent-output">Season batch approved: {seasonApproval.approved.length} packets moved to the approved queue.</p>
        ) : null}
        {seasonApprovalStatus === "error" && (
          <p className="gate-error">
            Unable to approve the Season batch{seasonApproval?.skipped.length ? `: ${seasonApproval.skipped[0].reason}` : "."}
          </p>
        )}
      </section>

      <section className="panel">
        <PanelHeader icon={CheckCircle2} title="Pipeline Doctor" action="Artifact proof" />
        <div className="doctor-grid">
          <article>
            <span>Stack</span>
            <strong>{doctor?.ok ? "Healthy" : "Needs check"}</strong>
            <small>{doctor?.liveGenerationVerified ? "Live providers verified" : "Live provider generation pending"}</small>
          </article>
          <article>
            <span>Latest MP4</span>
            <strong>{doctor?.runs.latestRendered?.probe?.valid ? "Valid" : "Unknown"}</strong>
            <small>
              {doctor?.runs.latestRendered?.probe
                ? `${doctor.runs.latestRendered.probe.width}x${doctor.runs.latestRendered.probe.height} / ${doctor.runs.latestRendered.probe.duration}s`
                : "No probe data"}
            </small>
          </article>
          <article>
            <span>Latest storyboard</span>
            <strong>{doctor?.runs.latestStoryboard?.packetReady ? "Packet ready" : doctor?.runs.latestStoryboard?.ready ? "Needs packet QC" : "Pending"}</strong>
            <small>{doctor?.runs.latestStoryboard ? `${doctor.runs.latestStoryboard.title} / ${doctor.runs.latestStoryboard.characterName ?? "character locked"}` : "No storyboard package"}</small>
          </article>
          <article>
            <span>Smoke tests</span>
            <strong>{doctor?.smokeTests.total ?? 0}</strong>
            <small>{doctor?.smokeTests.latest ? `${doctor.smokeTests.latest.provider} / ${doctor.smokeTests.latest.status}` : "None"}</small>
          </article>
          <article>
            <span>Latest bakeoff</span>
            <strong>{doctor?.latestBakeoffPacket?.stage ?? "None"}</strong>
            <small>
              {doctor?.latestBakeoffPacket
                ? `${doctor.latestBakeoffPacket.ok ? "ok" : "not ready"} / ${doctor.latestBakeoffPacket.liveSpendConfirmed ? "live" : "config"}`
                : "No bakeoff packet"}
            </small>
          </article>
        </div>
        {doctor?.runs.latestStoryboard?.packetChecks?.some((check) => !check.ok) ? (
          <div className="agent-output">
            {doctor.runs.latestStoryboard.packetChecks
              .filter((check) => !check.ok)
              .slice(0, 3)
              .map((check) => (
                <span key={check.id}>{check.reason}</span>
              ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <PanelHeader icon={FolderKanban} title="Approved Queue" action="Ready storyboard builds" />
        <div className="schedule-strip">
          <article>
            <span>Eligible</span>
            <strong>{approvedQueue?.counts.eligible ?? 0}</strong>
            <small>Approved and not rendered yet</small>
          </article>
          <article>
            <span>Rendered</span>
            <strong>{approvedQueue?.counts.rendered ?? 0}</strong>
            <small>Already built from source storyboard</small>
          </article>
          <article>
            <span>Blocked</span>
            <strong>{approvedQueue?.counts.blocked ?? 0}</strong>
            <small>QC, packet, or path issue</small>
          </article>
          <article>
            <span>Auto-build</span>
            <strong>{approvedQueueSchedule?.enabled ? "On" : "Off"}</strong>
            <small>
              {approvedQueueSchedule?.nextRunAt
                ? `Next ${formatBlogDate(approvedQueueSchedule.nextRunAt)}`
                : `${approvedQueueSchedule?.intervalMinutes ?? 30} min interval`}
            </small>
          </article>
        </div>
        {approvedQueue?.eligible.length ? (
          <div className="agent-output">
            {approvedQueue.eligible.slice(0, 4).map((run) => (
              <span key={run.id}>{run.title} / {run.characterName ?? "character locked"}</span>
            ))}
          </div>
        ) : null}
        {approvedQueue?.blocked.length ? (
          <div className="agent-output">
            {approvedQueue.blocked.slice(0, 4).map((run) => (
              <span key={run.id}>{run.title}: {run.reason}</span>
            ))}
          </div>
        ) : null}
        <div className="public-actions">
          <button
            type="button"
            className="ghost-action"
            onClick={() => saveApprovedQueueSchedule("mock")}
            disabled={approvedQueueScheduleStatus === "saving"}
          >
            <CalendarDays size={18} />
            Auto-Build Mock
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => saveApprovedQueueSchedule("production")}
            disabled={!confirmLiveSpend || !productionDecision || approvedQueueScheduleStatus === "saving"}
          >
            <Sparkles size={18} />
            Auto-Build Production
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => saveApprovedQueueSchedule("off")}
            disabled={approvedQueueScheduleStatus === "saving"}
          >
            <Trash2 size={18} />
            Stop Auto-Build
          </button>
        </div>
        {approvedQueueScheduleStatus === "saved" && <p className="agent-output">Approved queue schedule updated.</p>}
        {approvedQueueScheduleStatus === "error" && <p className="gate-error">Unable to update approved queue schedule. Apply a reviewed bakeoff winner before production auto-build.</p>}
      </section>

      <section className="panel">
        <PanelHeader icon={Gauge} title="Provider Readiness" action="Live stack gate" />
        <div className="schedule-strip">
          <article>
            <span>Scheduler</span>
            <strong>{schedule?.enabled ? "Enabled" : "Disabled"}</strong>
            <small>{schedule?.times.join(", ") || "09:00, 19:00"} / {schedule?.timezone ?? "server-local"}</small>
          </article>
          <article>
            <span>Next run</span>
            <strong>{schedule?.nextRunAt ? formatBlogDate(schedule.nextRunAt) : "Manual"}</strong>
            <small>{schedule?.lastRunAt ? `Last ${formatBlogDate(schedule.lastRunAt)}` : "No scheduled run recorded"}</small>
          </article>
          <article>
            <span>Characters</span>
            <strong>{schedule?.nextCharacterId ?? schedule?.characterId ?? "Rotation"}</strong>
            <small>{schedule?.characterIds?.join(", ") || characters.filter((character) => character.status === "locked").map((character) => character.id).join(", ")}</small>
          </article>
        </div>
        <div className="readiness-grid">
          {(readiness?.providers ?? []).map((provider) => (
            <article key={provider.id} className="readiness-card">
              <span className={`agent-state ${provider.status === "ready" ? "online" : "building"}`}>
                {provider.status.replace("_", " ")}
              </span>
              <h3>{provider.label}</h3>
              <small>{provider.mode}</small>
              <p>{provider.recommendation}</p>
            </article>
          ))}
        </div>
        {readiness?.blockers.length ? (
          <div className="agent-output">
            {readiness.blockers.map((blocker) => (
              <span key={blocker}>{blocker}</span>
            ))}
          </div>
        ) : null}
        {readiness?.verificationNote ? <p className="agent-output">{readiness.verificationNote}</p> : null}
        {providerComparison ? (
          <div className="agent-output">
            <span>Decision gate: {providerComparison.decisionGate.replace(/_/g, " ")}</span>
            {providerComparison.winner ? <span>Current winner: {providerComparison.winner}</span> : null}
            {providerComparison.decisionQuality ? (
              <span>
                Quality gate: {providerComparison.decisionQuality.bestScore}/100 best, margin{" "}
                {providerComparison.decisionQuality.margin} / needs {providerComparison.decisionQuality.minimumScore}+ and{" "}
                {providerComparison.decisionQuality.minimumMargin}+ margin
              </span>
            ) : null}
            {productionDecision ? (
              <span>
                Applied: {productionDecision.clipProvider} on {formatBlogDate(productionDecision.appliedAt)}
              </span>
            ) : null}
          </div>
        ) : null}
        {bakeoffPreflight ? (
          <div className="agent-output">
            <span>Live bakeoff preflight: {bakeoffPreflight.ok ? "ready" : "blocked"}</span>
            {bakeoffPreflight.checks.map((check) => (
              <span key={check.id}>
                {check.ok ? "OK" : "Fix"}: {check.label} - {check.detail}
              </span>
            ))}
          </div>
        ) : null}
        {providerComparison ? (
          <div className="workflow-decision">
            {providerComparison.providers.map((provider) => (
              <article key={provider.id}>
                <span className={`agent-state ${provider.status === "completed" ? "online" : "building"}`}>
                  {provider.status}
                </span>
                <h3>{provider.label}</h3>
                <p>
                  {provider.score}/100 / {provider.liveTested ? "live tested" : "config only"} /{" "}
                  {provider.artifactReady ? "artifact ready" : "artifact pending"}
                </p>
                {provider.artifactProbe?.valid ? (
                  <small>
                    {provider.artifactProbe.width}x{provider.artifactProbe.height} /{" "}
                    {provider.artifactProbe.duration.toFixed(1)}s
                  </small>
                ) : null}
                {provider.artifactPath ? (
                  <a href={provider.artifactPath} target="_blank" rel="noreferrer">
                    Open artifact
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
        {providerComparison ? <p className="agent-output">{providerComparison.recommendation} {providerComparison.nextStep}</p> : null}
        {workflowResearch ? (
          <div className="workflow-decision">
            <article>
              <span className="agent-state online">researched</span>
              <h3>Best current stack</h3>
              <p>{workflowResearch.currentAnswer}</p>
              <small>
                Default: {workflowResearch.providerDecision.defaultProvider} / Challenger:{" "}
                {workflowResearch.providerDecision.challengerProvider}
              </small>
            </article>
            <article>
              <span className="agent-state building">gate</span>
              <h3>Provider decision</h3>
              <p>{workflowResearch.providerDecision.reason}</p>
              <small>{workflowResearch.providerDecision.gate}</small>
            </article>
          </div>
        ) : null}
        {workflowResearch ? (
          <div className="agent-output">
            {workflowResearch.workflow.slice(0, 6).map((item) => (
              <span key={item.step}>
                {item.step}: {item.output}
              </span>
            ))}
          </div>
        ) : null}
        {workflowResearch ? (
          <div className="agent-output">
            {workflowResearch.references.slice(0, 6).map((reference) => (
              <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">
                {reference.label}: {reference.use}
              </a>
            ))}
          </div>
        ) : null}
        <div className="public-actions">
          <button
            type="button"
            className="ghost-action"
            onClick={() => saveSchedule("mock")}
            disabled={scheduleStatus === "saving"}
          >
            <CalendarDays size={18} />
            Enable Mock Schedule
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => saveSchedule("production")}
            disabled={!confirmLiveSpend || scheduleStatus === "saving"}
          >
            <Sparkles size={18} />
            Enable Production Schedule
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => saveSchedule("off")}
            disabled={scheduleStatus === "saving"}
          >
            <Trash2 size={18} />
            Disable Schedule
          </button>
          <label className="agent-toggle live-spend-toggle">
            <input
              type="checkbox"
              checked={confirmLiveSpend}
              onChange={(event) => setConfirmLiveSpend(event.target.checked)}
            />
            <span>Enable live provider spend</span>
          </label>
          <button
            type="button"
            className="ghost-action"
            onClick={() => runSmokeTest("openai-storyboard-frame")}
            disabled={smokeStatus === "running"}
          >
            <Image size={18} />
            Check GPT Frame
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => runSmokeTest("seedance-reference-clip")}
            disabled={smokeStatus === "running"}
          >
            <Clapperboard size={18} />
            Check Seedance Ref
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => runSmokeTest("openai-sora-reference-clip")}
            disabled={smokeStatus === "running"}
          >
            <Clapperboard size={18} />
            Check Sora Ref
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => runWorkflowSmokeTest(false)}
            disabled={workflowSmokeStatus === "running"}
          >
            <Sparkles size={18} />
            Check Full Handoff
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => runProviderBakeoff(false)}
            disabled={workflowSmokeStatus === "running"}
          >
            <Sparkles size={18} />
            Check Bakeoff
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={loadBakeoffPreflight}
            disabled={preflightStatus === "checking"}
          >
            <Gauge size={18} />
            Preflight
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => runSmokeTest("openai-storyboard-frame", true)}
            disabled={!confirmLiveSpend || smokeStatus === "running"}
          >
            <Image size={18} />
            Live GPT Frame
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => runSmokeTest("seedance-reference-clip", true)}
            disabled={!confirmLiveSpend || smokeStatus === "running"}
          >
            <Clapperboard size={18} />
            Live Seedance Ref
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => runSmokeTest("openai-sora-reference-clip", true)}
            disabled={!confirmLiveSpend || smokeStatus === "running"}
          >
            <Clapperboard size={18} />
            Live Sora Ref
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => runWorkflowSmokeTest(true)}
            disabled={!confirmLiveSpend || workflowSmokeStatus === "running"}
          >
            <Sparkles size={18} />
            Live Full Handoff
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => runProviderBakeoff(true)}
            disabled={!confirmLiveSpend || workflowSmokeStatus === "running" || bakeoffPreflight?.ok === false}
          >
            <Sparkles size={18} />
            Live Bakeoff
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={applyProductionWinner}
            disabled={providerComparison?.decisionGate !== "ready" || decisionStatus === "saving"}
          >
            <CheckCircle2 size={18} />
            Apply Winner
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={completeQueuedSmokeTests}
            disabled={!smokeTests.some((test) => test.status === "queued") || completingSmokeId === "all"}
          >
            <RefreshCw size={18} />
            Fetch Queued
          </button>
        </div>
        {scheduleStatus === "saved" && <p className="agent-output">Video schedule updated.</p>}
        {scheduleStatus === "error" && <p className="gate-error">Unable to update video schedule.</p>}
        {smokeStatus === "done" && <p className="agent-output">Provider check recorded.</p>}
        {smokeStatus === "error" && <p className="gate-error">Provider check failed.</p>}
        {workflowSmokeStatus === "done" && <p className="agent-output">Storyboard-to-Seedance handoff check recorded.</p>}
        {workflowSmokeStatus === "error" && <p className="gate-error">Storyboard-to-Seedance handoff check failed.</p>}
        {decisionStatus === "saved" && <p className="agent-output">Production provider winner applied to the approved storyboard queue.</p>}
        {decisionStatus === "error" && <p className="gate-error">Winner can be applied only after the live bakeoff is completed and reviewed.</p>}
        {smokeTests.length > 0 && (
          <div className="smoke-test-list">
            {smokeTests.slice(0, 4).map((test) => (
              <article key={test.id}>
                <span className={`agent-state ${["created", "completed", "configured"].includes(test.status) ? "online" : "building"}`}>
                  {test.status}
                </span>
                <strong>{test.provider}</strong>
                <small>{formatBlogDate(test.createdAt)} / {test.liveSpendConfirmed ? "live" : "config only"}</small>
                {test.review ? <small>Review {Math.round(((test.review.characterConsistency + test.review.motionQuality + test.review.artifactControl + test.review.storyClarity + test.review.costScore + test.review.speedScore) / 60) * 100)}/100</small> : null}
                {test.status === "queued" ? (
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => completeSmokeTest(test.id)}
                    disabled={completingSmokeId === test.id || completingSmokeId === "all"}
                  >
                    <RefreshCw size={16} />
                    Fetch
                  </button>
                ) : null}
                {test.publicPath ? (
                  <a href={test.publicPath} target="_blank" rel="noreferrer">
                    Open output
                  </a>
                ) : null}
                {test.publicPath ? (
                  <div className="review-actions">
                    {[6, 8, 10].map((score) => (
                      <button key={score} type="button" className="ghost-action" onClick={() => scoreSmokeTest(test.id, score)}>
                        Score {score}
                      </button>
                    ))}
                  </div>
                ) : null}
                {test.error ? <p>{test.error}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <PanelHeader icon={Layers3} title="Storyboard Review" action="Project and scene manifest" />
        {artifactStatus === "loading" && <div className="empty-state">Loading storyboard package...</div>}
        {artifactStatus === "error" && <div className="empty-state">No storyboard package found for this run yet.</div>}
        {artifacts?.sceneManifest ? (
          <>
            <div className="schedule-strip">
              <article>
                <span>Project</span>
                <strong>{artifacts.project?.concept ?? artifacts.title}</strong>
                <small>{artifacts.project?.status ?? "storyboard-ready"}</small>
              </article>
              <article>
                <span>Character</span>
                <strong>{artifacts.characterName ?? artifacts.project?.characterName ?? "Locked character"}</strong>
                <small>{artifacts.characterId ?? "from run packet"}</small>
              </article>
          <article>
            <span>Seedance</span>
            <strong>{artifacts.sceneManifest.seedance?.styleLock ? "Style locked" : "Pending"}</strong>
            <small>{artifacts.sceneManifest.seedance?.model ?? "mock"}</small>
          </article>
          <article>
            <span>Storyboard QC</span>
            <strong>{artifacts.storyboardQc?.ok ? "Pass" : "Needs review"}</strong>
            <small>
              {typeof artifacts.storyboardQc?.score === "number"
                ? `${artifacts.storyboardQc.score}/100`
                : "QC report pending"}
            </small>
          </article>
          <article>
            <span>Panels</span>
            <strong>{artifacts.storyboardPanels?.panelCount ?? "Pending"}</strong>
            <small>{artifacts.storyboardPanels ? `${artifacts.storyboardPanels.runtimeSeconds}s artwork board` : "Panel agent pending"}</small>
          </article>
          <article>
            <span>Schedule stack</span>
            <strong>{schedule?.storyboardDirectorProvider ?? "local"} / {schedule?.storyboardFrameProvider ?? "mock"}</strong>
            <small>{schedule?.keyframeProvider ?? "mock"} / {schedule?.clipProvider ?? "mock"} / {schedule?.voiceProvider ?? "mock"}</small>
          </article>
        </div>
            {artifacts.storyboardQc?.checks?.some((check) => !check.ok) ? (
              <div className="agent-output">
                {artifacts.storyboardQc.checks
                  .filter((check) => !check.ok)
                  .slice(0, 4)
                  .map((check) => (
                    <span key={`${check.id}-${check.shotNumber ?? "all"}`}>
                      {check.severity}: {check.message}
                    </span>
                  ))}
              </div>
            ) : null}
            {artifacts.referencePack ? (
              <div className="agent-output">
                <span>Reference pack: {artifacts.referencePack.name}</span>
                <span>{artifacts.referencePack.identityLock}</span>
                <span>Motion: {artifacts.referencePack.motionLanguage.slice(0, 2).join(" ")}</span>
                <span>Do not drift: {artifacts.referencePack.forbiddenDrift.slice(0, 2).join(" ")}</span>
              </div>
            ) : null}
            {artifacts.storyboardPanels?.panels?.length ? (
              <div className="episode-product-grid storyboard-review-grid">
                {artifacts.storyboardPanels.panels.slice(0, 9).map((panel) => (
                  <article key={panel.panelId}>
                    <span className="agent-state online">Panel {panel.panelId}</span>
                    <h3>{panel.action}</h3>
                    <small>{panel.timecode} / {panel.camera}</small>
                    <small>{panel.emotion} / {panel.fx}</small>
                    <p>{panel.animationPrompt}</p>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="episode-product-grid storyboard-review-grid">
              {artifacts.sceneManifest.storyboard.slice(0, 7).map((scene) => {
                const frame = artifacts.storyboardFrames?.find((candidate) => candidate.shotNumber === Number(scene.sceneId.replace("s", "")));
                return (
                  <article key={scene.sceneId}>
                    <span className={`agent-state ${frame?.status === "created" ? "online" : "building"}`}>
                      {scene.sceneId} / {frame?.status ?? "prompt"}
                    </span>
                    <h3>{scene.goal}</h3>
                    <small>{scene.startSec}s-{scene.startSec + scene.durationSec}s / {scene.camera}</small>
                    {scene.motionArc ? <small>Motion arc: {scene.motionArc}</small> : null}
                    <p>{scene.videoPrompt}</p>
                    {scene.inputImage ? (
                      <a href={scene.inputImage} target="_blank" rel="noreferrer">
                        Open frame
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <PanelHeader icon={Archive} title="Latest Runs" action="Packets and exports" />
        {status === "loading" && <div className="empty-state">Loading video runs...</div>}
        {status === "error" && <div className="empty-state">Unable to load video runs.</div>}
        {status === "ready" && runs.length === 0 && (
          <div className="empty-state">
            <strong>No video runs yet.</strong>
            <span>Start the agent to create the first automated Opaija short.</span>
          </div>
        )}
        {runs.length > 0 && (
          <div className="video-run-grid">
            {runs.slice(0, 8).map((run) => (
              <article key={run.id} className="video-run-card">
                {run.publicVideoPath ? <video src={run.publicVideoPath} controls preload="metadata" /> : null}
                <div>
                  <span className={`agent-state ${run.status === "rendered" ? "online" : "building"}`}>{run.status}</span>
                  <h3>{run.title}</h3>
                  {run.characterName ? <small>{run.characterName}</small> : null}
                  {run.sourceRunId ? <small>Built from {run.sourceRunId}</small> : null}
                  <p>{run.socialCaption}</p>
                  <small>{formatBlogDate(run.createdAt)} / {run.category}</small>
                  <div className="hero-mini-list">
                    {run.hashtags.slice(0, 4).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="review-actions">
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => loadRunArtifacts(run.id)}
                    >
                      <Layers3 size={16} />
                      Storyboard
                    </button>
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => reviewRun(run.id, "approved")}
                      disabled={reviewingId === run.id}
                    >
                      <Check size={16} />
                      Approve
                    </button>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => renderRun(run.id)}
                      disabled={
                        renderingId === run.id ||
                        (!confirmLiveSpend && [keyframeProvider, clipProvider, voiceProvider, storyboardFrameProvider].some((provider) => provider !== "mock")) ||
                        (clipProvider !== "mock" && !productionDecision)
                      }
                    >
                      <Play size={16} />
                      Build Video
                    </button>
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => reviewRun(run.id, "rejected")}
                      disabled={reviewingId === run.id}
                    >
                      <Trash2 size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MerchView() {
  return (
    <div className="view-grid book-room">
      <section className="panel">
        <PanelHeader icon={Shirt} title="Merch and Store Engine" action="Print-on-demand plus Opaija website" />
        <div className="book-hero merch-hero">
          <div>
            <span className="signal">Brand products from every episode</span>
            <h2>Approved artwork becomes tees, hoodies, posters, stickers, books, and storefront drops.</h2>
            <p>
              Printful and Printify both expose APIs. The engine creates draft products first, generates mockups,
              and only publishes after approval so the brand stays tight.
            </p>
          </div>
          <div className="book-metrics">
            {merchMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="agent-grid">
          {merchAgents.map((agent) => {
            const Icon = agent.icon;
            return (
              <article key={agent.name} className="agent-card">
                <div className="agent-topline">
                  <span className="agent-state building">building</span>
                  <Icon size={22} />
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.role}</p>
                <InfoList title="Owns" items={agent.owns} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <PanelHeader icon={Shirt} title="First Drops" action="Product ideas" />
          <div className="target-list">
            {merchProducts.map((product) => (
              <article key={product.name}>
                <strong>{product.status === "needs-cutout" ? "PNG" : "SKU"}</strong>
                <div>
                  <span>{product.name}</span>
                  <small>
                    {product.character} / {product.type} / {product.providerFit}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={FolderKanban} title="POD Pipeline" action="Draft before publish" />
          <ul className="memory-list">
            {merchPipeline.map((step) => (
              <li key={step}>
                <ChevronRight size={16} />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Archive} title="Opaija Website" action="Domain-ready structure" />
        <div className="episode-product-grid">
          {storeSections.map((section) => (
            <article key={section}>
              <h3>{section.split(":")[0]}</h3>
              <p>{section}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Command;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PanelHeader({ icon: Icon, title, action }: { icon: typeof Command; title: string; action: string }) {
  return (
    <div className="panel-header">
      <div>
        <Icon size={20} />
        <h2>{title}</h2>
      </div>
      <span>{action}</span>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
