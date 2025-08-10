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

    const result = {
      code: 'goldbod',
      commodity: 'gold',
      price_per_gh_pound: priceText || null,
      discount_rate: discountText || null,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          code: 'goldbod',
          commodity: 'gold',
          error: error.message,
        },
        null,
        2
      )
    );
  }
}

scrapeGoldPrice();
