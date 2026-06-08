import dotenv from "dotenv";
import { runProviderBakeoffSmokeTest } from "./providerSmokeTests.js";
import { getProviderBakeoffPreflight } from "./providerBakeoffPreflight.js";

dotenv.config();

if (process.env.CONFIRM_LIVE_PROVIDER_SPEND !== "true") {
  console.log(
    JSON.stringify(
      {
        ok: false,
        refused: true,
        reason:
          "Set CONFIRM_LIVE_PROVIDER_SPEND=true to run paid OpenAI and Seedance provider smoke tests.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const preflight = await getProviderBakeoffPreflight();
if (!preflight.ok) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        refused: true,
        reason: "Live provider preflight failed.",
        preflight,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const result = await runProviderBakeoffSmokeTest({
  confirmLiveSpend: true,
  pollAttempts: Number(process.env.LIVE_PROVIDER_VERIFY_POLL_ATTEMPTS ?? 24),
  pollDelayMs: Number(process.env.LIVE_PROVIDER_VERIFY_POLL_DELAY_MS ?? 10000),
});

console.log(
  JSON.stringify(
    result,
    null,
    2,
  ),
);
