FROM docker.io/library/node:25-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY . .

EXPOSE 8080

CMD [ "node", "index.js" ]
