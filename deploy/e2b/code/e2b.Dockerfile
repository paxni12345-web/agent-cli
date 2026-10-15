# OpenCode sandbox. Version pinned to the one the adapter was audited against.
# NOT yet built/run: build with `e2b template build` (see docs/GATEWAY_SETUP.md).
FROM e2bdev/code-interpreter:latest
RUN npm install -g opencode-ai@1.18.35 \
 && mkdir -p /home/user/workspace /home/user/oc-home
