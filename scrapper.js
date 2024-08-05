require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { parse } = require("json2csv");
const fs = require("fs");
const path = require("path");

const app = express();

// Use CORS middleware
app.use(cors());
app.use(express.json());

const options = new chrome.Options();
options.addArguments("--start-maximized");

async function scrapeLinkedIn(searchQuery) {
  let driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "LinkedIn credentials are not set in the environment variables"
      );
    }

    await driver.get("https://www.linkedin.com/login");
    await driver.findElement(By.id("username")).sendKeys(email);
    await driver.findElement(By.id("password")).sendKeys(password, Key.RETURN);
    await driver.wait(until.urlContains("/feed"), 20000);

    await driver.get(
      `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        searchQuery
      )}`
    );
    await driver.wait(
      until.elementLocated(By.css(".reusable-search__result-container")),
      20000
    );

    let userCount = 0;
    const desiredUserCount = 40;
    let currentPage = 1;
    let data = [];

    while (userCount < desiredUserCount) {
      console.log(`Scraping page ${currentPage}...`);

      let results = await driver.findElements(
        By.css(".reusable-search__result-container")
      );

      for (let result of results) {
        if (userCount >= desiredUserCount) break;

        try {
          let name = await result
            .findElement(By.css(".entity-result__title-text a"))
            .getText();
          let title = await result
            .findElement(By.css(".entity-result__primary-subtitle"))
            .getText();
          let location = await result
            .findElement(By.css(".entity-result__secondary-subtitle"))
            .getText();

          console.log(`Name: ${name}`);
          console.log(`Title: ${title}`);
          console.log(`Location: ${location}`);
          console.log("---");

          data.push({ name, title, location });
          userCount++;
        } catch (err) {
          console.error("Error extracting information:", err);
          // Add empty entry for users whose data could not be fetched
          data.push({ name: "", title: "", location: "" });
        }
      }

      await driver.executeScript(
        "window.scrollTo(0, document.body.scrollHeight);"
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        let nextButton = await driver.findElement(
          By.css("li.artdeco-pagination__indicator--number:not(.active) button")
        );
        await nextButton.click();
      } catch (err) {
        console.log("No more pages available or pagination button not found.");
        break;
      }

      await driver.wait(
        until.elementLocated(By.css(".reusable-search__result-container")),
        20000
      );
      currentPage++;
    }

    // Convert data to CSV and save to file
    const csv = parse(data);
    const filePath = path.join(__dirname, "scraped_data.csv");
    fs.writeFileSync(filePath, csv);

    console.log(`Data saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  } finally {
    await driver.quit();
  }
}

app.post("/scrape", async (req, res) => {
  const searchQuery = req.body.searchQuery;
  if (!searchQuery) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    const filePath = await scrapeLinkedIn(searchQuery);
    res.json({ message: "Scraping completed", filePath });
  } catch (error) {
    res.status(500).json({ error: "Failed to scrape LinkedIn" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
