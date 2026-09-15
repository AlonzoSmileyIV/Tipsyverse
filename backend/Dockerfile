# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install MongoDB Database Tools so the backup job has mongodump.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL \
     https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-100.18.0.deb \
     -o /tmp/mongodb-database-tools.deb \
  && apt-get install -y /tmp/mongodb-database-tools.deb \
  && mongodump --version \
  && rm -f /tmp/mongodb-database-tools.deb \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 tipsyverse \
  && useradd --system --uid 10001 --gid tipsyverse --create-home tipsyverse

COPY --from=dependencies --chown=tipsyverse:tipsyverse /app/node_modules ./node_modules
COPY --chown=tipsyverse:tipsyverse . .

USER tipsyverse
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+(process.env.API_URL||'/api/v1')+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]