require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

// Initialize Express app
const app = express();
app.use(cors()); // Enable CORS
app.use(bodyParser.json());

// Initialize Selenium WebDriver
async function initializeDriver() {
  const options = new chrome.Options();
  options.addArguments("--start-maximized");
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

// Function to scrape data from the current page
async function scrapeData(driver) {
  try {
    console.log("Starting data extraction...");

    // Wait for elements to be located using the updated class name
    await driver.wait(
      until.elementLocated(By.css(".jbnogtyEYgaMTxkRyDgtWfkxPjhSRgeClg")),
      20000
    );

    let results = await driver.findElements(
      By.css(".jbnogtyEYgaMTxkRyDgtWfkxPjhSRgeClg")
    );

    let data = [];

    for (let result of results) {
      try {
        let name = await result
          .findElement(By.css(".entity-result__title-text"))
          .getText();
        let title = await result
          .findElement(By.css(".entity-result__primary-subtitle"))
          .getText();
        let location = await result
          .findElement(By.css(".entity-result__secondary-subtitle"))
          .getText();

        data.push({ name, title, location });

        console.log(`Name: ${name}`);
        console.log(`Title: ${title}`);
        console.log(`Location: ${location}`);
        console.log("---");
      } catch (error) {
        console.error("Error extracting user info:", error);
      }
    }

    console.log("Data extraction completed.");
    return data;
  } catch (error) {
    console.error("Error during data extraction:", error);
    return [];
  }
}

// Route to handle scraping
app.post("/scrape", async (req, res) => {
  let driver = await initializeDriver();
  try {
    console.log("Navigate to LinkedIn manually and perform your search.");
    await new Promise((resolve) => {
      console.log(
        "Waiting for you to navigate to the page with the search results..."
      );
      process.stdin.once("data", resolve);
    });
    let data = await scrapeData(driver);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Scraping failed" });
  } finally {
    await driver.quit();
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
