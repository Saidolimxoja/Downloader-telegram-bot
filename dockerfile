# ========================
# BASE IMAGE
# ========================
FROM node:18-alpine

# ========================
# SYSTEM DEPENDENCIES
# ========================
RUN apk add --no-cache python3 py3-pip ffmpeg bash curl git

# ========================
# CREATE PYTHON VENV
# ========================
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# ========================
# INSTALL PYTHON PACKAGES
# ========================
RUN pip install --upgrade pip yt-dlp

# ========================
# WORKDIR
# ========================
WORKDIR /app

# ========================
# COPY PROJECT FILES
# ========================
COPY package*.json ./
COPY prisma ./prisma/
COPY wait-for-it.sh /wait-for-it.sh

# ========================
# INSTALL NODE DEPENDENCIES
# ========================
RUN npm ci

# ========================
# COPY REST OF PROJECT
# ========================
COPY . .

# ========================
# PRISMA GENERATE & BUILD
# ========================
RUN npx prisma generate
RUN npm run build



# ========================
# EXPOSE PORT
# ========================
EXPOSE 3000

# ========================
# START COMMAND
# ========================
CMD ["sh", "-c", "/wait-for-it.sh $POSTGRES_HOST:$POSTGRES_PORT -- npm run start:prod"]
