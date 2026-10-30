// Every automated test starts with a hard network guard, even if a developer's
// shell contains valid credentials. Provider tests must inject a mock client.
const fetcher = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "api.openai.com" || url.hostname.endsWith(".openai.azure.com")) throw new Error("Live model API calls are prohibited in automated tests; inject a mocked client.");
  return fetcher(input, options);
};
