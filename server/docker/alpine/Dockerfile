FROM alpine:3.19
RUN apk add --no-cache curl less busybox-extras ca-certificates

# Create unprivileged user and use /home/sandbox on tmpfs at runtime
RUN adduser -D -s /bin/sh sandbox

USER sandbox
ENV HOME=/home/sandbox
WORKDIR /home/sandbox

CMD ["/bin/sh"]
