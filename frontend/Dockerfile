FROM node:18-alpine as builder

RUN apk add bash

WORKDIR /frontend
COPY ./utils/ utils/

# ------------------------------------------------------------------------------

FROM builder as runtime

ENTRYPOINT [ "/frontend/utils/entrypoint.sh" ]
