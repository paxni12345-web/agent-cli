# OpenClaw sandbox. Pinned to 2026.9.9 (audited). Needs Node 24 per the audit.
# NOT yet built/run.
FROM node:24-bookworm
RUN npm install -g openclaw@2026.9.9 \
 && useradd -m -s /bin/bash user \
 && mkdir -p /home/user/workspace /home/user/oc-state && chown -R user:user /home/user
USER user
WORKDIR /home/user
