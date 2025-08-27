import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register ts-node's ESM loader for TypeScript at runtime (Node 20+ compatible)
register("ts-node/esm", pathToFileURL("./"));
