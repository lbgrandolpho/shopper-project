FROM node:20-alpine as builder

RUN apk add bash

WORKDIR /backend
COPY ./utils/ utils/

# ------------------------------------------------------------------------------

FROM builder as runtime

ENTRYPOINT [ "/backend/utils/entrypoint.sh" ]
