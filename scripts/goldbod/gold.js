const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://goldbod.gov.gh/';

async function scrapeGoldPrice() {
  try {
    const { data: html } = await axios.get(URL);
    const $ = cheerio.load(html);

    let priceText = null;
    let discountText = null;

    $('h2.elementor-heading-title').each((_, el) => {
      const heading = $(el).text().trim();

      if (heading === 'Price Per Ghana Pound') {
        const parent = $(el).closest('.elementor-widget-container').parent();
        const nextH2 = parent
          .next()
          .find('h2.elementor-heading-title')
          .text()
          .trim();
        priceText = nextH2;
      }

      if (heading === 'Discount Rate') {
        const parent = $(el).closest('.elementor-widget-container').parent();
        const nextH2 = parent
          .next()
          .find('h2.elementor-heading-title')
          .text()
          .trim();
        discountText = nextH2;
      }
    });

    // Ensure we always return an object with the expected structure
    return {
      code: 'goldbod',
      commodity: 'gold',
      price_per_gh_pound: priceText || 'GHS 0.00', // Default value if not found
      discount_rate: discountText || '0%', // Default value if not found
    };
  } catch (error) {
    // Return error information in the expected format
    return {
      code: 'goldbod',
      error: error.message,
      commodity: 'gold',
      price_per_gh_pound: null,
      discount_rate: null,
    };
  }
}

// Make sure to export the function
module.exports = scrapeGoldPrice;
