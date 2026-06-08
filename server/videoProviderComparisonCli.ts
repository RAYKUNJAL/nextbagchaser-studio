import dotenv from "dotenv";
import { getVideoProviderComparison } from "./videoProviderComparison.js";

dotenv.config();

console.log(JSON.stringify(await getVideoProviderComparison(), null, 2));
