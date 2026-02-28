FROM node:20-alpine
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the backend code
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]