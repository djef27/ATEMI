/**
 * Content Engine feature flag (pure, no server imports — safe to unit test).
 *
 * The AI Content Engine is treated as WORK IN PROGRESS:
 * - no AI providers are registered yet (the router fails closed), but the
 *   OpenAI key IS configured, so image/text generation would incur real costs;
 * - the social publishing adapters are stubs that report fake "published"
 *   results.
 *
 * The whole surface is disabled by default. Set CONTENT_ENGINE_ENABLED=true
 * only once real providers and platform integrations are implemented and
 * verified (see PROGRESS.md).
 */
export function isContentEngineEnabled(): boolean {
  return process.env.CONTENT_ENGINE_ENABLED === 'true';
}