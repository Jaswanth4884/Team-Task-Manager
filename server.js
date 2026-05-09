// Lightweight wrapper to ensure the standalone server reads PORT and binds to 0.0.0.0
// Usage: `node server.js`
process.env.PORT = process.env.PORT || '3000';
process.env.HOST = process.env.HOST || '0.0.0.0';

try {
  // The standalone output exposes a server entry that will read process.env.PORT
  require('./.next/standalone/server.js');
} catch (err) {
  // Provide a clear message if standalone entrypoint is missing
  console.error('Failed to start standalone server. Did you run `next build`?');
  console.error(err);
  process.exit(1);
}
