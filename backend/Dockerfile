# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 10001 tipsyverse \
  && useradd --system --uid 10001 --gid tipsyverse --create-home tipsyverse

COPY --from=dependencies --chown=tipsyverse:tipsyverse /app/node_modules ./node_modules
COPY --chown=tipsyverse:tipsyverse . .

USER tipsyverse
EXPOSE 3001

# PORT and API_URL are deployment inputs. The health check deliberately uses
# Node so the runtime image does not need curl or wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+(process.env.API_URL||'/api/v1')+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
