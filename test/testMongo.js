const assert = require("chai").assert;
const fs = require("fs"), path = require("path");
const MongoClient = require('mongodb').MongoClient;

const client = new MongoClient("mongodb://localhost", { useUnifiedTopology: true });
const FLAT_ENTRIES = new Promise(resolve => {
    fs.readFile(
        path.join(__dirname, "../flat_file.txt"),
        'utf-8',
        (err, data) => {
            if (err) throw (err);
            const flatEntries = data.toString().split(/\r?\n/); // The optional \r covers windows files
            for (let i = 0; i < flatEntries.length; i++) {
                flatEntries[i] = flatEntries[i].split("|");
            }
            return flatEntries;
        }
    );
});

before(function (done) {
    client.connect()
    done();
});

after(done => client.close(done));

describe("Patients collection", () => {
    let patients;

    before(done => {
        patients = client.db("hcs_challenge_mogk").collection("Patients");
        done();
    });

    it("should have one document per patient", done => {
        patients.countDocuments({}).then(numPatients => {
            assert.equal(numPatients, FLAT_ENTRIES.length - 1, "The number of patients isn't the same in database vs flat file");
            done();
        });
    });

    it("should have no documents missing a first name", async done => {
        const consentButNoEmail = await patients.find({
            "CONSENT": true,
            "Email Address": null
        }).project("Member ID").toArray();
        assert.deepEqual(noNames, [], "These members are missing their first name");
    });

    it("should have an email for every member who has consent", async done => {
        const noNames = await patients.find({
            "First Name": null
        }).project("Member ID").toArray();
        assert.deepEqual(noNames, [], "These members are missing their first name");
    });

    for (let i = 1; i < FLAT_ENTRIES.length; i++) {
        it("should match the flat file's contents", async done => {
            const membersWithThisID = patients.find({ "Member ID": FLAT_ENTRIES[i][3] });
            const patient = membersWithThisID.next();
            if (membersWithThisID.hasNext()) {
                assert.isTrue(false, "Multiple members have the same id");
            }
            for (let keyIndex = 0; keyIndex < FLAT_ENTRIES[0].length; keyIndex++) {
                const key = FLAT_ENTRIES[0][keyIndex];
                assert.equal(patient[key], flatVersion[keyIndex], `Flat file line ${i} doesn't match mongo data`);
            }
            done();
        });
    }
});
