import dotenv from "dotenv";
import { getProviderBakeoffPreflight } from "./providerBakeoffPreflight.js";

dotenv.config();

console.log(JSON.stringify(await getProviderBakeoffPreflight(), null, 2));
