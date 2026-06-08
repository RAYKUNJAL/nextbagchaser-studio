import dotenv from "dotenv";
import { getVideoAgentDoctor } from "./videoAgentDoctorCore.js";

dotenv.config();

console.log(JSON.stringify(await getVideoAgentDoctor(), null, 2));
