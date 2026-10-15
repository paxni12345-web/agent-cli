# Hermes sandbox. Pin to the commit from the audit (f925b017).
# NOT yet built/run. Fill HERMES_REPO + install steps from audit-hermes.md before building;
# the audit also noted Hermes does a GitHub update check on startup that has no off switch,
# so build with egress allowing github.com or accept the failed check.
FROM python:3.12-bookworm
ARG HERMES_REPO
ARG HERMES_COMMIT=f925b017
RUN test -n "$HERMES_REPO" || (echo "set --build-arg HERMES_REPO=<git url>" && exit 1)
RUN git clone "$HERMES_REPO" /opt/hermes && cd /opt/hermes && git checkout "$HERMES_COMMIT" \
 && pip install --no-cache-dir /opt/hermes \
 && useradd -m -s /bin/bash user && mkdir -p /home/user/workspace /tmp/hh && chown -R user:user /home/user /tmp/hh
USER user
WORKDIR /home/user
