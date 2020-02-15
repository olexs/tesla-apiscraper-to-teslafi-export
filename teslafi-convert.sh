#!/bin/bash

mkdir -p teslafi-csv

echo "Building the converter Docker app"
docker build -t tesla-apiscraper-teslafi-converter ./converter/

echo "Docker build complete, running..."
docker run -v "$(pwd)/influxdb-csv:/opt/csv" -v "$(pwd)/teslafi-csv:/opt/output" --rm -it tesla-apiscraper-teslafi-converter

echo "All done."
