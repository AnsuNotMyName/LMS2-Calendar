// scraper.js
const { chromium } = require('playwright');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const csv = require('csv-parser');
const { insertEvent } = require('./calendar'); // import calendar function
require('dotenv').config();
const path = require('path');

const folder = path.join(__dirname, 'db');

// Scraper main function
async function run(username, password) {
    // CSV writers per user
    const temp = createCsvWriter({
        path: path.join(folder, `temp${username}.csv`),
        header: [
            { id: 'evID', title: 'EventID' },
            { id: 'cID', title: 'CourseID' },
            { id: 'evTitle', title: 'Title' },
            { id: 'evType', title: 'EventType' },
            { id: 'opened', title: 'EventOpen' },
            { id: 'closes', title: 'EventClose' },
        ]
    });

    const check = createCsvWriter({
        path: path.join(folder, `check${username}.csv`),
        header: [
            { id: 'evID', title: 'EventID' },
            { id: 'cID', title: 'CourseID' },
            { id: 'evTitle', title: 'Title' },
            { id: 'evType', title: 'EventType' },
            { id: 'opened', title: 'EventOpen' },
            { id: 'closes', title: 'EventClose' },
        ]
    });

    // Utility: check duplicate per-user
    async function isDuplicate(evID) {
        const filePath = path.join(folder, `check${username}.csv`);
        if (!fs.existsSync(filePath)) return false;

        return new Promise((resolve, reject) => {
            const existingIDs = new Set();
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => existingIDs.add(row.EventID))
                .on('end', () => resolve(existingIDs.has(evID)))
                .on('error', reject);
        });
    }


    // Utility: write CSV
    async function write(writer, data) {
        if (!writer || typeof writer.writeRecords !== 'function') {
            console.error('❌ Invalid CSV writer provided');
            return;
        }
        try {
            await writer.writeRecords(data);
            console.log(`📁 CSV file ${writer.path} updated`);
        } catch (error) {
            console.error('❌ Error writing CSV:', error);
        }
    }

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://lms.psu.ac.th/calendar/view.php");

    // Login
    await page.type("input[name=username]", username, { delay: 10 });
    await page.type("input[name=password]", password, { delay: 10 });
    await page.click("button[id=loginbtn]");
    await page.waitForLoadState();

    // Count events
    const eventCount = await page.$$eval("div.event", (nodes) => nodes.length);
    console.log(`📌 Found ${eventCount} events`);

    let eventData = [];

    for (let i = 1; i <= eventCount; i++) {
        const selector = `div.event:nth-child(${i})`;
        const parent = await page.$(selector);

        if (!parent) {
            console.log(`⚠️ No event at index ${i}, skipping`);
            continue;
        }

        const evID = await parent.getAttribute("data-event-id");
        const cID = await parent.getAttribute("data-course-id");
        const evTitle = await parent.getAttribute("data-event-title");
        const evType = await parent.getAttribute("data-event-eventtype");

        // get the link before clicking
        const evLink = await page.$eval(
            `${selector} > div:nth-child(1) > div:nth-child(3) > a:nth-child(1)`,
            el => el.getAttribute("href")
        );

        // Open event
        await page.click(`${selector} > div:nth-child(1) > div:nth-child(3) > a:nth-child(1)`);
        await page.waitForLoadState("networkidle");

        let opened = (await page.textContent(".activity-dates > div:nth-child(1)")).trim();
        let closes = (await page.textContent(".activity-dates > div:nth-child(2)")).trim();

        if (opened.startsWith("Opens:") || opened.startsWith("Opened:")) {
            opened = opened.split(" ").slice(1).join(" ");
        }
        if (closes.startsWith("Closes:") || closes.startsWith("Due:")) {
            closes = closes.split(" ").slice(1).join(" ");
        }

        const evData = { evID, cID, evTitle, evType, opened, closes };
        eventData.push(evData);

        await page.goBack();
        await page.waitForLoadState("networkidle");

        const duplicate = await isDuplicate(evID);
        if (duplicate) {
            console.log(`⏩ EventID ${evID} already exists, skipping`);
            continue;
        }
        if (evType === "close") {
            console.log(`⏩ EventID ${evID} is closed, skipping`);
            continue;
        }

        // Write temp CSV for this event
        await write(temp, [evData]);

        // Map course name
        let Course = "Unknown Course";
        switch (cID) {
            case '830': Course = "สัตว์เลี้ยงเพื่อนรัก"; break;
            case '10052': Course = "Calculus Lecture"; break;
            case '1043': Course = "Chemical Lecture"; break;
            case '4590': Course = "Biology Lecture"; break;
            case '9952': Course = "Biology Labs"; break;
            case '1199': Course = "Physics Lecture"; break;
            case '1195': Course = "Physics Labs"; break;
            case '10207': Course = "Happy and Peaceful Life"; break;
            case '8050': Course = "Chemical Labs"; break;
            case '10019': Course = "Essentials English"; break;
            case '1182': Course = "Preparation course of faculty of science"; break;
            case '6134': Course = "Self learning English"; break;
        }

        console.log(`📖 Course ID ${cID} → ${Course}`);

        const glendar = {
            summary: evTitle,
            description: `วิชา ${Course}`,
            location: evLink,
            start: {
                dateTime: new Date(opened).toISOString(),
                timeZone: 'Asia/Bangkok',
            },
            end: {
                dateTime: new Date(closes).toISOString(),
                timeZone: 'Asia/Bangkok',
            },
            colorId: "6"
        };

        console.log("📅 Inserting event:", glendar.summary);
        await insertEvent(glendar, username);
    }

    // Write full check CSV
    await write(check, eventData);

    await browser.close();
    console.log("✅ Scraping finished for", username);
}

// Example test run

module.exports = { run };
