FROM node:alpine
WORKDIR /app
COPY . .
RUN npm install
VOLUME [ "/opt/csv", "/opt/output" ]
CMD [ "node", "index.js" ]
