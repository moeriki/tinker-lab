# Node 26 to match development exactly -- see docs/adr/sqlite-via-node-sqlite.md. Alpine is
# safe here precisely because node:sqlite is built into Node: nothing is compiled at build time,
# so musl never enters the picture.
FROM node:26-alpine

# Timestamps decide when the game ended and are read back on the showdown screen. Left at UTC the
# logs read two hours early, which is confusing at 01:00 while trying to fix something.
ENV TZ=Europe/Brussels
ENV NODE_ENV=production
ENV PORT=3040
ENV DATA_DIR=/data

WORKDIR /app

# This application has NO runtime dependencies, so there is no install step and no node_modules
# in the image. That is a real property, not an oversight -- and this guard makes sure it stays
# true. If a later ticket adds a dependency, the build fails here with instructions rather than
# producing an image that is silently missing it.
COPY package.json ./
RUN node -e "const p = require('./package.json'); \
  const deps = Object.keys(p.dependencies || {}); \
  if (deps.length) { \
    console.error('\\nBUILD STOPPED: package.json now declares dependencies: ' + deps.join(', ')); \
    console.error('The Dockerfile has no install step because there were none.'); \
    console.error('Add one (corepack enable && pnpm install --frozen-lockfile --prod)'); \
    console.error('and delete this guard.\\n'); \
    process.exit(1); \
  }"

COPY . .

# The image ships no data directory. /data is a bind mount owned by the host; see MM-HANDOFF.md
# for the chown it needs. Running as the unprivileged `node` user (uid 1000) that the base image
# already provides.
USER node

EXPOSE 3040

# Same probe the host uses by hand before guests arrive.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3040) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
