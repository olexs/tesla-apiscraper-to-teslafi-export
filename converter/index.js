const ReadLines = require('n-readlines');
const csv = require('csvtojson');
const transformToTeslaFi = require('./transform');
const fs = require('fs');
const readlineSync = require('readline-sync');

function clean(obj) {
    for (var propName in obj) { 
        if (obj[propName] === '' || obj[propName] === null || obj[propName] === undefined) {
            delete obj[propName];
        }
    }
}  

function calculateDistance(lat1, lon1, lat2, lon2) {
	if ((lat1 == lat2) && (lon1 == lon2)) {
		return 0;
	}
	else {
		var radlat1 = Math.PI * lat1/180;
		var radlat2 = Math.PI * lat2/180;
		var theta = lon1-lon2;
		var radtheta = Math.PI * theta/180;
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
		if (dist > 1) {
			dist = 1;
		}
		dist = Math.acos(dist);
		dist = dist * 180/Math.PI;
		dist = dist * 60 * 1.1515;
		dist = dist * 1.609344;
		return dist;
	}
}

class CsvFile {
    constructor(filename, name) {
        this.lineReader = new ReadLines(filename);
        this.name = name;
        this.eof = false;
        this.linesRead = 0;
    }

    async initHeaders() {
        const headerLineBuffer = this.lineReader.next();
        const headerCsvRows = await csv({ noheader: true, output: "csv" }).fromString(headerLineBuffer.toString('utf-8'));
        this.headers = headerCsvRows[0];
    }

    async readNextLine() {
        const line = this.lineReader.next();
        if (!line)
            this.eof = true;
        else {
            const dataCsvRows = await csv({ noheader: true, headers: this.headers }).fromString(line.toString('utf-8'));
            this.data = dataCsvRows[0];
            clean(this.data);
            this.linesRead++;
        }
    }
}

async function main() {

    const vehicleId = readlineSync.question("Please enter your vehicle ID (10-/11-digit number): ");

    const chargeStateInput = new CsvFile("/opt/csv/charge_state.csv", "Charge");
    await chargeStateInput.initHeaders();
    await chargeStateInput.readNextLine();

    const climateStateInput = new CsvFile("/opt/csv/climate_state.csv", "Climate");
    await climateStateInput.initHeaders();
    await climateStateInput.readNextLine();

    const driveStateInput = new CsvFile("/opt/csv/drive_state.csv", "Drive");
    await driveStateInput.initHeaders();
    await driveStateInput.readNextLine();

    const vehicleStateInput = new CsvFile("/opt/csv/vehicle_state.csv", "Vehicle");
    await vehicleStateInput.initHeaders();
    await vehicleStateInput.readNextLine();

    console.log("Initialized. Beginning processing...");

    // init CSV output file
    const outputFolder = '/opt/output/';
    let outputStream = false; 
    let outputStreamInitDate = new Date(2000, 01, 01);
 
    const inputs = [chargeStateInput, climateStateInput, driveStateInput, vehicleStateInput];

    function getNextTime() {
        return Math.min(...inputs.map((i) => i.data.time));
    }

    const dataFrame = { 
        id: 1, 
        data: [{}, {}, {}, {}],
        nextTime: `${getNextTime()}`
    };

    let lastTeslaFiString = "";
    let lastTime = "";

    let bufferedData = false;
    let appliedDriveBreakups = 0;

    function isDriving(data) {
        return data.shift_state == "D" || data.shift_state == "N" || data.shift_state == "R";
    }

    function isChargingOnAC(data) {
        return data.charging_state != "Disconnected" &&
               (data.charger_actual_current > "0" ||
                data.charger_voltage > "0");
    }

    function applyCorrections(bufferedData, currentData, dataFrame) {
        // if we're charging, 
        // or <1km driven in >15min, 
        // or just a time break of >1h,
        // or <50m driven in >6min without climate running (not sitting in traffic)
        // mark both states as "P" to prevent "stretched" drives in data
        if (isDriving(bufferedData) && isDriving(currentData)) {
            const distanceKm = calculateDistance(parseFloat(bufferedData.latitude), 
                                                 parseFloat(bufferedData.longitude), 
                                                 parseFloat(currentData.latitude), 
                                                 parseFloat(currentData.longitude));
            const timespanHrs = (new Date(currentData.Date.substr(1, 19)) - 
                                 new Date(bufferedData.Date.substr(1, 19))) / 3600000;
            if (currentData.charging_state != "Disconnected" || 
                timespanHrs > 1 || 
                (distanceKm < 5 && timespanHrs > 0.25)|| 
                (distanceKm < 0.05 && timespanHrs > 0.1 && currentData.fan_status == "0")) {

                bufferedData.state = "online";
                bufferedData.shift_state = "P";

                currentData.state = "online";
                currentData.shift_state = "P";

                appliedDriveBreakups++;
            }
        }

        // always reset phases to None when charging DC (no voltage or current reported)
        if (!isChargingOnAC(currentData)) {
            currentData.charger_phases = "None";
        }
    }

    function writeDataPoint(teslaFiData) {
        // check if a new file needs to be opened
        const dataFrameDate = new Date(teslaFiData.Date.substr(1, 10));
        if (!outputStream || 
            dataFrameDate.getFullYear() > outputStreamInitDate.getFullYear() || 
            dataFrameDate.getMonth() > outputStreamInitDate.getMonth()) {
            
            if (outputStream) outputStream.close();
    
            const outputFilename = outputFolder + `TeslaFi${dataFrameDate.getMonth()+1}${dataFrameDate.getFullYear()}.csv`;
            fs.copyFileSync('template.csv', outputFilename);
            outputStream = fs.createWriteStream(outputFilename, {flags: 'a'});
    
            outputStreamInitDate = dataFrameDate;
            console.log(" ")
            console.log("Starting new file: " + outputFilename)
        }
    
        if (dataFrame.id % 100 == 0) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Processing data frame at ${teslaFiData.Date}. Corrected "drive" data frames: ${appliedDriveBreakups}`);
        }
    
        const line = Object.entries(teslaFiData).map((x) => x[1]).join(",");
        outputStream.write(line + "\n");
    }

    while (inputs.filter((i) => i.eof == true).length == 0) {
        
        // advance all inputs whose next time is <= dataFrame.nextTime
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];

            if (input.data.time <= dataFrame.nextTime) {
                //console.log(`Adding data from input ${i}, line ${input.linesRead}, time ${input.data.time}`);
                dataFrame.data[i] = Object.assign(dataFrame.data[i], input.data);
                await input.readNextLine();
            }
        }

        // advance next time
        dataFrame.nextTime = getNextTime();

        // if data frame is complete...
        if (dataFrame.data[0].time && dataFrame.data[1].time && dataFrame.data[2].time && dataFrame.data[3].time) {
            // generate teslafi object and compare to previous one, ignoring ID and time(s)
            const teslaFiData = transformToTeslaFi(dataFrame, vehicleId);
            
            const newTeslaFiData = Object.assign({}, teslaFiData);
            newTeslaFiData.data_id = '';
            newTeslaFiData.Date = '';
            newTeslaFiData.gps_as_of = '';
            const newTeslaFiString = JSON.stringify(newTeslaFiData);

            if (lastTeslaFiString != newTeslaFiString/* && lastTime != teslaFiData.Date*/) {
                lastTeslaFiString = newTeslaFiString;
                lastTime = teslaFiData.Date;

                // if data has changed, increment id, transform and output it to result csv
                dataFrame.id++;

                // do corrections between last (buffered) and this data
                applyCorrections(bufferedData, teslaFiData, dataFrame);
                
                // write last (buffered) data, buffer current
                if (bufferedData) writeDataPoint(bufferedData);
                bufferedData = teslaFiData;
            }
        }
    }
    
    console.log(" ")
    console.log("Finished.");
    if (outputStream) outputStream.end();
}

main();