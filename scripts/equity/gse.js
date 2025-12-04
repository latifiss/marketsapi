const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const scrapeGSEWithPuppeteer = async () => {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to https://gsemarketwatch.com/');
    await page.goto('https://gsemarketwatch.com/', {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    console.log('Waiting for stock data to load...');

    await page
      .waitForFunction(
        () => {
          const html = document.body.innerHTML;
          return (
            html.includes('GLC') ||
            html.includes('MTNGH') ||
            html.includes('GOIL') ||
            html.includes('SCB')
          );
        },
        { timeout: 30000 }
      )
      .catch(() => {
        console.log('Did not find stock symbols via waitForFunction');
      });

    await page
      .waitForSelector('.owl-item .item table.symbols-table', {
        timeout: 20000,
      })
      .catch(() =>
        console.log('Direct selector timeout, trying alternatives...')
      );

    // *** THE FIXED LINE - REPLACES waitForTimeout ***
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds

    const html = await page.content();
    console.log('Rendered HTML length:', html.length, 'characters');

    if (html.includes('GLC') || html.includes('MTNGH')) {
      console.log('✓ Stock data found in rendered HTML');
    } else {
      console.log('✗ No stock data found even after rendering');
      console.log('Checking for JavaScript errors...');
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log('Screenshot saved as debug-screenshot.png');
      await browser.close();
      return [];
    }

    console.log('Extracting stock data...');
    const stockData = await page.evaluate(() => {
      const stocks = [];
      const tables = document.querySelectorAll('table.symbols-table');
      tables.forEach((table) => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 14) return;
          const stock = {};
          cells.forEach((cell) => {
            const dataTitle = cell.getAttribute('data-title');
            if (dataTitle) {
              let value = cell.textContent.trim();
              if (
                dataTitle === 'net_change' ||
                dataTitle === 'percent_change'
              ) {
                const tdValue = cell.querySelector('.td-value');
                if (tdValue) {
                  value = tdValue.textContent.trim();
                }
              }
              if (value && !isNaN(value.replace(/,/g, ''))) {
                stock[dataTitle] = parseFloat(value.replace(/,/g, ''));
              } else {
                stock[dataTitle] = value;
              }
            }
          });
          if (stock.symbol) {
            stocks.push(stock);
          }
        });
      });
      return stocks;
    });

    console.log(`✓ Extracted ${stockData.length} stock records`);

    const uniqueStocks = [];
    const seenSymbols = new Set();
    stockData.forEach((stock) => {
      if (!seenSymbols.has(stock.symbol)) {
        seenSymbols.add(stock.symbol);
        uniqueStocks.push(stock);
      }
    });

    console.log(`✓ ${uniqueStocks.length} unique stocks after deduplication`);

    const formattedData = uniqueStocks.map((stock) => ({
      symbol: stock.symbol,
      bid_size: stock.bid_volume,
      bid_price: stock.bid_price,
      ask_size: stock.ask_volume,
      ask_price: stock.ask_price,
      last_price: stock.last_trade_price,
      last_volume: stock.last_trade_volume,
      total_volume: stock.total_trade_volume,
      total_value: stock.total_trade_value,
      open: stock.open_price,
      high: stock.high_price,
      low: stock.low_price,
      close: stock.close_price,
      change: stock.net_change,
      percent_change: stock.percent_change,
    }));

    return formattedData;
  } catch (error) {
    console.error('Error with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
};

// Run the scraper
scrapeGSEWithPuppeteer()
  .then((data) => {
    console.log('\n=== SCRAPING COMPLETE ===');
    console.log(`Total unique stocks: ${data.length}`);
    if (data.length > 0) {
      console.log('\nSample stocks (first 3):');
      console.log(JSON.stringify(data.slice(0, 3), null, 2));
      console.log('\nAll stock symbols:');
      console.log(data.map((stock) => stock.symbol).join(', '));
    }
  })
  .catch((err) => {
    console.error('\n=== SCRAPING FAILED ===');
    console.error('Error:', err.message);
  });

// Make the function exportable if needed
module.exports = { scrapeGSEWithPuppeteer };
