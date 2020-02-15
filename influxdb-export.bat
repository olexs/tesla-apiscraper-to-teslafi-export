@echo off

if not exist "influxdb-csv" mkdir "influxdb-csv"

echo Starting InfluxDB container

docker run -td -v "%cd%/influxdb-data:/var/lib/influxdb" -v "%cd%/influxdb-csv:/opt/csv" -e INFLUXDB_DB="tesla" --rm --name apiscraper-export-influxdb influxdb:latest

echo Waiting for InfluxDB to start up in the container
:waitForInflux
sleep 1
docker exec -t apiscraper-export-influxdb curl -s -i -XHEAD http://127.0.0.1:8086/ping > /dev/null || goto :waitForInflux

echo Beginning data export

echo Exporting 1/5: charge state data
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from charge_state' -format csv > /opt/csv/charge_state.csv"

echo Exporting 2/5: climate state data
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from climate_state' -format csv > /opt/csv/climate_state.csv"

echo Exporting 3/5: drive state data
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from drive_state' -format csv > /opt/csv/drive_state.csv"

echo Exporting 4/5: vehicle state data (this is the big one)
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from vehicle_state' -format csv > /opt/csv/vehicle_state.csv"

echo Exporting 5/5: GUI settings data
docker exec -t apiscraper-export-influxdb sh -c "influx -database 'tesla' -execute 'select * from gui_settings' -format csv > /opt/csv/gui_settings.csv"

echo Stopping and removing InfluxDB container
docker stop apiscraper-export-influxdb

echo Export finished.
