FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

# Install a minimal set of user-facing utilities useful for learning/testing.
# Keep image small by avoiding recommended packages and cleaning apt lists.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    curl \
    less \
    vim-tiny \
    iputils-ping \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Create unprivileged user 'sandbox' and set as default user.
RUN useradd -m -s /bin/bash sandbox \
 && mkdir -p /home/sandbox/.cache \
 && chown -R sandbox:sandbox /home/sandbox

USER sandbox
ENV HOME=/home/sandbox
WORKDIR /home/sandbox

ENTRYPOINT ["/bin/bash"]
