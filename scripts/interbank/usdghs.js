const axios = require('axios');
const cheerio = require('cheerio');

const url =
  'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/';

(async () => {
  try {
    const { data } = await axios.get(url);

    const $ = cheerio.load(data);

    let results = [];

    $('table tbody tr').each((_, row) => {
      const tds = $(row).find('td');

      if (tds.length >= 6) {
        const date = $(tds[0]).text().trim();
        const currencyPair = $(tds[2]).text().trim();
        const buyingRate = $(tds[3]).text().trim();
        const sellingRate = $(tds[4]).text().trim();
        const midRate = $(tds[5]).text().trim();

        if (currencyPair === 'USDGHS') {
          results.push({
            date,
            currency_pair: currencyPair,
            buying_rate: parseFloat(buyingRate),
            selling_rate: parseFloat(sellingRate),
            mid_rate: parseFloat(midRate),
          });
        }
      }
    });

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error fetching data:', error.message);
  }
})();
