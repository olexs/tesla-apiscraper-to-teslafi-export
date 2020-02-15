@echo off

if not exist "teslafi-csv" mkdir "teslafi-csv"

echo Building the converter Docker app
docker build -t tesla-apiscraper-teslafi-converter ./converter/

echo Docker build complete, running...
docker run -v "%cd%/influxdb-csv:/opt/csv" -v "%cd%/teslafi-csv:/opt/output" --rm -it tesla-apiscraper-teslafi-converter

echo All done.
