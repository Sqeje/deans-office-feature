const url = process.argv[2];
if (!url) throw new Error('Provide a health-check URL');
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (response.ok) process.exit(0);
  } catch { /* Retry until the fixed deadline. */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
throw new Error(`Health check did not succeed: ${url}`);
