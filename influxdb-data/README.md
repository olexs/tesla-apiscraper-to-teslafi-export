# ./influxdb-data

Place your InfluxDB data folder *contents* (*data*, *meta* and *wal* folders) from `tesla-apiscraper` in here. In the default Docker config, they are stored under `/opt/apiscraper/influxdb`. The folder structure should look like this:

   ```console
   .
   ├── influxdb-export.sh
   └── influxdb-data
       ├── README.md (this file you're reading)
       ├── data
       ├── meta
       └── wal
   ```
