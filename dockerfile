# ========================
# BASE IMAGE
# ========================
FROM node:22-bullseye-slim

# ========================
# SYSTEM DEPENDENCIES
# ========================
RUN apt-get update && apt-get install -y python3 python3-venv python3-pip ffmpeg bash curl git

# ========================
# CREATE PYTHON VENV
# ========================
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# ========================
# INSTALL PYTHON PACKAGES
# ========================
RUN pip install --no-cache-dir --upgrade pip yt-dlp
RUN which yt-dlp && yt-dlp --version
# ========================
# WORKDIR
# ========================
WORKDIR /app

# ========================
# COPY PROJECT FILES
# ========================
COPY package*.json ./
COPY prisma ./prisma/
COPY youtube_cookies.txt ./youtube_cookies.txt
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
