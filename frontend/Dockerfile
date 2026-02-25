FROM node:18-alpine
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Build production bundle
RUN npm run build

# Serve with a lightweight server
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "build"]
