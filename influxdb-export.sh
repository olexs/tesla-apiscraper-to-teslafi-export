#!/bin/bash

mkdir -p influxdb-csv

echo "Starting InfluxDB container"

docker run -td -v "$(pwd)/influxdb-data:/var/lib/influxdb" -v "$(pwd)/influxdb-csv:/opt/csv" -e INFLUXDB_DB="tesla" --rm --name apiscraper-export-influxdb influxdb:1.8

until [ "`docker inspect -f {{.State.Status}} apiscraper-export-influxdb`"=="running" ]; do
    sleep 0.1;
done;

echo "Waiting for InfluxDB to start up in the container"

for i in {30..0}; do
    if docker exec -t apiscraper-export-influxdb curl -s -i -XHEAD http://127.0.0.1:8086/ping > /dev/null; then
        break
    fi
    sleep 1
done

echo "Beginning data export"

echo "Exporting 1/5: charge state data"
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from charge_state' -format csv > /opt/csv/charge_state.csv"

echo "Exporting 2/5: climate state data"
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from climate_state' -format csv > /opt/csv/climate_state.csv"

echo "Exporting 3/5: drive state data"
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from drive_state' -format csv > /opt/csv/drive_state.csv"

echo "Exporting 4/5: vehicle state data (this is the big one)"
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from vehicle_state' -format csv > /opt/csv/vehicle_state.csv"

echo "Exporting 5/5: GUI settings data"
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from gui_settings' -format csv > /opt/csv/gui_settings.csv"

echo "Stopping and removing InfluxDB container"
docker stop apiscraper-export-influxdb

echo "Export finished."
