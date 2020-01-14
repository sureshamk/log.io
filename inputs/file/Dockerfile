# specify the node base image with your desired version node:<version>
FROM node:8-alpine
# replace this with your application's default port

EXPOSE 80
RUN npm config set unsafe-perm true
RUN npm install -g pm2
RUN mkdir -p /app
WORKDIR /app
COPY package*.json ./
RUN npm install
ADD . .
RUN npm run build
ENV MESSAGE_SERVER_HOST server
ENV MESSAGE_SERVER_PORT 6689
ENV EXCULDE_NAME hasvester
CMD ["pm2-runtime", "process.config.js"]