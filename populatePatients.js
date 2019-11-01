const fs = require("fs"), path = require("path");
const MongoClient = require('mongodb').MongoClient;

const client = new MongoClient("mongodb://localhost", { useUnifiedTopology: true });

client.connect(function (err) {
    if (err) throw err;
    populatePatientsFromLocalFile("flat_file.txt");
});

function populatePatientsFromLocalFile(relativePath) {
    const patients = client.db("hcs_challenge_mogk").collection("Patients");
    fs.readFile(
        path.join(__dirname, relativePath),
        'utf-8',
        (err, data) => {
            if (err) throw (err);
            const entries = data.toString().split(/\r?\n/); // The optional \r covers windows files
            const keys = pullOutFirstRow(entries).split("|");
            for (let entry of entries) {
                if(entry == "") continue; // Skip lines with no data
                const jsonEntry = convertFlatEntryToJSON(keys, entry);
                patients.insertOne(jsonEntry);
            }
            client.close();
        }
    );
}

// Helper functions below

function pullOutFirstRow(array) {
    const firstRow = array[0];
    array.shift();
    return firstRow;
}

function convertFlatEntryToJSON(keys, stringOfValues) {
    const json = {};
    const values = stringOfValues.split("|");
    for (let i = 0; i < keys.length; i++) {
        let value = values[i];
        if (value == "") continue; // Skip empty values
        value = coerceType(value);
        json[keys[i]] = value;
    }
    return json;
}

function coerceType(value) {
    if (!isNaN(Number(value))) {
        return Number(value);
    } else if (value == "Y") {
        return true;
    } else if (value == "N") {
        return false;
    } else return value;
}