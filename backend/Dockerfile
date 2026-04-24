FROM rustlang/rust:nightly AS builder

WORKDIR /usr/src/app
COPY . .

RUN cargo build --release

FROM rustlang/rust:nightly AS tester
WORKDIR /usr/src/app
RUN cargo install cargo-tarpaulin
COPY . .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl-dev ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/backend /usr/local/bin/backend

ENV RUST_LOG=info
CMD ["backend"]
