FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Em produção seria ideal dar npm run build, mas para desenvolvimento:
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
