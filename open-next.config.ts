// OpenNext adapter config for Cloudflare Workers.
// Every route is dynamic (per-user data), so no incremental cache is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
