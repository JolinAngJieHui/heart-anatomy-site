// Server callers choose models. Request schemas never accept a model name.
export function tutorModels() {
  const read = (key: string, fallback: string) => {
    const value = process.env[key]?.trim() || fallback;
    if (!/^[a-zA-Z0-9._-]{1,120}$/.test(value)) throw new Error(`Invalid ${key}`);
    return value;
  };
  return { tutor: read("OPENAI_TUTOR_MODEL", "gpt-6.1-sol"), navigation: read("OPENAI_NAVIGATION_MODEL", "gpt-6-luna") };
}
