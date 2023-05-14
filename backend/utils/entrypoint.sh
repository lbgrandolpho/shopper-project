#!/usr/bin/env bash

# Wait for our MySQL container to be ready
/backend/utils/wait-for-it.sh 172.17.0.1:3306

# Serve backend
npm --prefix /backend run dev
