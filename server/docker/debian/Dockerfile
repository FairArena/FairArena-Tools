FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    curl \
    less \
    vim-tiny \
    iputils-ping \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash sandbox \
 && mkdir -p /home/sandbox/.cache \
 && chown -R sandbox:sandbox /home/sandbox

USER sandbox
ENV HOME=/home/sandbox
WORKDIR /home/sandbox

CMD ["/bin/bash"]
