import dotenv from "dotenv";
import { applyVideoProductionWinner } from "./videoProductionDecision.js";

dotenv.config();

try {
  console.log(JSON.stringify(await applyVideoProductionWinner(), null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to apply production winner.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
