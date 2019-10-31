const fs = require("fs"), path = require("path");
const MongoClient = require('mongodb').MongoClient;

const client = new MongoClient("mongodb://localhost", { useUnifiedTopology: true });

client.connect(function (err) {
    if (err) throw err;
    populateEmails();
});

async function populateEmails() {
    const patients = client.db("hcs_challenge_mogk").collection("Patients");
    // Get the id's and email addresses of eveyone who's being emailed
    const isBeingEmailed = patients.find(
        {
            "CONSENT": true,
            "Email Address": { $exists: true }
        },
        {
            _id: 1,
        }
    )
    while(patient = await isBeingEmailed.next()) {
        generateEmails(patient._id);
    }
    isBeingEmailed.forEach(patient => {
        generateEmails(patient);
    });
}

function generateEmails(target_id) {
    const emails = client.db("hcs_challenge_mogk").collection("Emails");
    const today = new Date().getDate;
    const sent = [];
    for (let i = 1; i < 5; i++) {
        // Sent 4, 3, 2, or 1 days ago
        const daySent = new Date().setDate(today - (5 + i))
        sent.push(
            {
                "To": { "$ref": "Patients", "$id": target_id },
                "Date": daySent,
                "Subject": `Day ${i}`,
                "Body": `Thank you for consenting to daily emails ${i} days ago!`
            }
        )
    }
    emails.insertMany(sent);
}