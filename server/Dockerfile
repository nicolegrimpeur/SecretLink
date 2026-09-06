ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine

# L'image officielle fournit déjà un utilisateur `node` non privilégié (uid
# 1000). On lui donne /app AVANT toute copie, puis on abandonne les privilèges :
# installation, build et exécution se font sans root. Une évasion de conteneur
# depuis le processus applicatif n'atterrit donc plus sur un compte root.
#
# `COPY --chown` plutôt qu'un `chown -R` final : ce dernier recopierait tout
# node_modules dans une couche supplémentaire, soit des dizaines de Mo à tirer
# inutilement sur le Raspberry Pi à chaque version.
WORKDIR /app
RUN chown node:node /app
USER node

# Copy package files
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY --chown=node:node src ./src

# Build TypeScript
RUN npm run build

# Migrations et leur runner : ils ne sont pas compilés (SQL brut + .mjs), donc
# copiés tels quels.
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts ./scripts

# Remove development dependencies
RUN npm prune --production

# Expose port. Aucun privilège requis : 3000 est au-dessus de 1024, un port que
# seul root pourrait ouvrir aurait interdit ce changement.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health', r=>{ process.exit(r.statusCode===200?0:1) }).on('error', ()=>process.exit(1))"

# Run the application
CMD ["node", "dist/main.js"]
