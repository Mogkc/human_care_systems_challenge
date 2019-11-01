const assert = require("chai").assert;
const fs = require("fs"), path = require("path");
const MongoClient = require('mongodb').MongoClient;

const client = new MongoClient("mongodb://localhost", { useUnifiedTopology: true });
const FLAT_ENTRIES = new Promise((resolve, reject) => {
    fs.readFile(
        path.join(__dirname, "../flat_file.txt"),
        'utf-8',
        (err, data) => {
            if (err) throw (err);
            const flatEntries = data.toString().split(/\r?\n/); // The optional \r covers windows files
            for (let i = 0; i < flatEntries.length; i++) {
                if (flatEntries[i] == '') {
                    flatEntries.splice(i, 1);
                    continue;
                }
                flatEntries[i] = flatEntries[i].split("|");
            }
            resolve(flatEntries);
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

    it("should have one document per patient", async () => {
        const flat = await FLAT_ENTRIES;
        const numPatients = await patients.countDocuments({})
        assert.equal(numPatients, flat.filter(e => e != '').length - 1, "The number of patients isn't the same in database vs flat file");
    });

    it("should have no documents missing a first name", async () => {
        const noNames = await patients.find(
            {
                "First Name": null
            },
            { "Member ID": 1 })
            .toArray();
        const shouldBeEmpty = noNames.reduce(
            (acc, curr) => acc += curr["Member ID"] + " is missing their first name. ",
            ""
        );
        assert.equal(shouldBeEmpty, "");
    });

    it("should have an email for every member who has consent", async () => {
        const consentButNoEmail = await patients.find(
            {
                "CONSENT": true,
                "Email Address": null
            },
            { "Member ID": 1 }
        ).toArray();
        const shouldBeEmpty = consentButNoEmail.reduce(
            (acc, curr) => acc += curr["Member ID"] + " has consent but no email ",
            ""
        );
        assert.equal(shouldBeEmpty, "");
    });


    it("should match the flat file's contents", async () => {
        const flat = await FLAT_ENTRIES;
        for (let i = 1; i < flat.length; i++) {
            const membersWithThisID = patients
                .find(
                    { "Member ID": parseInt(flat[i][3]) }
                ).sort(
                    { "_id": -1 }
                );
            let patient = await membersWithThisID.next();
            for (let keyIndex = 0; keyIndex < flat[0].length; keyIndex++) {
                const key = flat[0][keyIndex];
                assert.equal(patient[key], interpret(flat[i][keyIndex]), `Flat file line ${i} doesn't match mongo data`);
            }
        }

        function interpret(val) {
            if (val == '') return undefined;
            if (val == 'Y') return true;
            if (val == 'N') return false;
            if (!isNaN(Number(val))) return Number(val);
            return val;
        }
    });
});

describe("Emails collection", () => {
    let emails, patients;

    before(done => {
        emails = client.db("hcs_challenge_mogk").collection("Emails");
        patients = client.db("hcs_challenge_mogk").collection("Patients");
        done();
    });

    it("should always be to someone", async () => {
        const numEmailsWOutAddress = await emails.countDocuments({ "To": null });
        assert.equal(numEmailsWOutAddress, 0, "There are emails to no one");
    });

    it("should contain emails for everyone who has consent Y", async () => {
        const consenters = await patients.find({ "Consent": true }, { "Member ID": 1 });
        while (consenter = await consenters.next()) {
            const id = consenter["Member ID"];
            assert.isAbove(
                await emails.find(
                    { To: { $ref: "Patients", "Member ID": id } }
                ).countDocuments(),
                0,
                `Member ${id} consented but recieved no emails. There may be others.`
            );
        }
    });

    describe("Subject lines", () => {
        it("should consist of 'Day X'", async () => {
            const wrongSubjectCount = await emails.countDocuments({ "Subject": { $not: /Day \d+/ } });
            assert.isBelow(wrongSubjectCount, 1, "There's at least one email with the wrong subject");
        });

        // it("should be in the right order", async () => {
        //     const randomPerson = await emails.aggregate([
        //         // Since we're getting emails, only select people who've consent
        //         { $match: { "CONSENT": true } },
        //         { $sample: { size: 2 } }
        //     ]).toArray();
        //     console.log(randomPerson);
        //     const orderedByDate = await emails.find(
        //         { To: { $ref: "Patients", "Member ID": randomPerson["Member ID"] } }
        //     ).sort({ "Date": 1 });
        //     while (orderedByDate.hasNext()) {
        //         let prev = current || null;
        //         // Get the first number from the subject line
        //         let current = parseInt(orderedByDate.next()["Subject"].match(/\d+/)[0]);
        //         if (prev != null) {
        //             assert.isAtLeast(current, prev, `Member ${randomPerson["Member ID"]}'s emails are out of order`)
        //         }
        //     }
        // });
    });
});
