const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://goldbod.gov.gh/';

async function scrapeGoldPrice() {
  try {
    const { data: html } = await axios.get(URL);
    const $ = cheerio.load(html);

    let priceText = null;

    $('h2.elementor-heading-title').each((_, el) => {
      const heading = $(el).text().trim();
      if (heading === 'Total Price Per Pound') {
        const price = $(el)
          .parent()
          .parent()
          .next()
          .find('h2.elementor-heading-title')
          .text()
          .trim()
          .replace(/^GHS\s*/, '');
        priceText = price;
      }
    });

    return {
      code: 'goldbod',
      commodity: 'gold',
      price_per_gh_pound: priceText || null,
      discount_rate: null,
    };
  } catch (error) {
    return {
      code: 'goldbod',
      error: error.message,
      commodity: 'gold',
      price_per_gh_pound: null,
      discount_rate: null,
    };
  }
}

module.exports = scrapeGoldPrice;

if (require.main === module) {
  scrapeGoldPrice().then(console.log).catch(console.error);
}
