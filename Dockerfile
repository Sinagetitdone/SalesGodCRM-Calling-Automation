FROM node:22-alpine

WORKDIR /app

# Dev dependencies are kept on purpose: the server runs through tsx.
COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build && mkdir -p /app/data && chown -R node:node /app/data

ENV NODE_ENV=production \
    PORT=3000

USER node

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["npm", "run", "start"]
