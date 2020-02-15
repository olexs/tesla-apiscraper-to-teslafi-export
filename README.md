# tesla-apiscraper to TeslaFi CSV exporter

This is a toolkit to export your data from [tesla-apiscraper](https://github.com/lephisto/tesla-apiscraper) InfluxDB backend, convert it to TeslaFi CSV format, and fix up some typical data glitches the scraper produces. You can then import this data into TeslaFi or other Tesla API trackers that support TeslaFi import (such as [TeslaMate](https://github.com/adriankumpf/teslamate)).

## Requirements

- A copy of the data stored by `tesla-apiscraper` - specifically the `/opt/apiscraper/influxdb` folder mounted in the standard apiscraper Docker configuration. **Create a backup of this** before attempting the export and conversion, just in case.

- A system running Docker with sufficient RAM for InfluxDB to perform the CSV export. This does **not** need to be the same machine where API Scraper and/or TeslaMate was/is running - you can do the export and conversion on your PC/Mac. The important thing is to give the Docker machine more than 2GB of RAM, otherwise the InfluxDB export may fail.

- **CREATE A [BACKUP](../maintenance/backup_restore.html) OF YOUR DATA** before attempting to import anything into TeslaMate. This is all highly experimental and has only been successfuly done once :)

## Instructions

### Part 1: Exporting the API Scraper InfluxDB data into CSV

1. Download or clone the [tesla-api-scraper-to-teslafi-export](https://github.com/olexs/tesla-api-scraper-to-teslafi-export) repository into a folder on your machine.

2. Place the `tesla-apiscraper` data folder *contents* (*data*, *meta* and *wal* folders) into the `influxdb-data` folder, next to the `influxdb-export.sh` file. The folder structure must look like this:

   ```console
   .
   ├── influxdb-export.sh
   └── influxdb-data
       ├── README.md
       ├── data
       ├── meta
       └── wal
   ```

3. Run the `influxdb-export.sh` script (or `influxdb-export.bat` if you're on Windows):

   `$ ./influxdb-export.sh`

   You may need to `sudo` it / run it in an Administrator command line prompt if your Docker install needs root.

   It will do the following:

   - Create the `influxdb-csv` output folder, if it doesn't exist yet
   - Start an InfluxDB Docker container with the `influxdb-data` and `influxdb-csv` folders mounted (on Windows, you may need to allow your Docker to access the drive you are working on for the mounts to work)
   - Wait for the container to report as *healthy*
   - Execute the export commands for all data stored by apiscraper, putting the CSV files inside the `influxdb-csv` folder
   - Stop and delete the InfluxDB container

   This may take a little while. After the process has finished, if there are no errors reported, continue with the next part of the instructions.

### Part 2: Converting exported CSV to TeslaFi CSV and fixing up the data
