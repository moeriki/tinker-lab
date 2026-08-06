# Node 26 to match development exactly -- see docs/adr/sqlite-via-node-sqlite.md. Alpine is
# safe here precisely because node:sqlite is built into Node: nothing is compiled at build time,
# so musl never enters the picture.
FROM node:26-alpine

# Timestamps decide when the game ended and are read back on the showdown screen. Left at UTC the
# logs read two hours early, which is confusing at 01:00 while trying to fix something.
ENV TZ=Europe/Brussels
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

# Which commit is this? `.dockerignore` drops `.git/` on purpose -- the image stays small and the
# source of truth stays GitHub -- so the sha cannot be read at runtime and has to be handed in at
# build time. Deliberately last: `COPY . .` above already busts the cache on any source change, so
# rebuilding the same source under a new label only redoes this trivial layer.
#
# Unset is honest rather than fatal. A build nobody labelled reports "unknown", which is exactly
# what the site said before this existed -- it never claims to be a commit it is not.
# Which flavour is this image? `development` builds the dev harness in -- test team already
# logged in, every tile unlocked, /admin open, /dev/logout wired (see src/dev.js and #62).
# ANYTHING else, including unset, is the real site.
#
# Down here beside BUILD_COMMIT rather than up with TZ and PORT because nothing during the build
# reads it: this image has no install step, so NODE_ENV has no build-time meaning at all and only
# ever describes the process that CMD starts. Keeping it below `COPY . .` also means switching
# flavours reuses every source layer.
#
# `docker compose` passes it through: NODE_ENV=development docker compose up -d --build.
ARG NODE_ENV=production

# Same reason the BUILD_COMMIT RUN below exists: without a layer that consumes the ARG's VALUE,
# the cache does not key on it and a rebuild keeps whichever flavour it was first handed. That is
# the difference between "I rebuilt in dev mode" and an image that silently stayed production.
RUN echo "NODE_ENV=$NODE_ENV"

ENV NODE_ENV=$NODE_ENV

ARG BUILD_COMMIT=unknown

# The RUN is load-bearing, not decoration. With `ARG` + `ENV` and nothing between them the layer
# cache does not key on the arg's VALUE, so a rebuild keeps the first sha it was ever handed --
# measured, not assumed: passing a fresh --build-arg still produced the old label, and so did
# passing none. A RUN that consumes the arg keys the cache on the value and cascades to the ENV.
#
# That is not a theoretical case here. `.dockerignore` drops docs/, CONTEXT.md and MM-HANDOFF.md,
# so a documentation-only commit leaves the build context byte-identical, `COPY . .` cache-hits,
# and without this line the label would silently freeze on the previous commit -- a confident
# wrong answer, which is worse than the "unknown" this whole thing replaced.
#
# It earns its place twice: the label also lands in the build log, which is where you look when
# the deploy is the thing that went wrong.
RUN echo "BUILD_COMMIT=$BUILD_COMMIT"

ENV BUILD_COMMIT=$BUILD_COMMIT

EXPOSE 3040

# Same probe the host uses by hand before guests arrive.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3040) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
