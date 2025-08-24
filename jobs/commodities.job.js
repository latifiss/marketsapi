const cron = require('node-cron');
const mongoose = require('mongoose');
const Commodity = require('../models/commodity.model');
const commoditySources = require('../scripts/commoditiesIndex');

const checkConnection = () => mongoose.connection.readyState === 1;
const MAX_WAIT_MS = 5 * 60 * 1000;

const getETHour = () => {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  ).getHours();
};
const getETDay = () => {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  ).getDay();
};

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs)
    ),
  ]);
};

const processCommodityUpdate = async (data) => {
  const start = Date.now();
  try {
    if (typeof data.currentPrice !== 'number' || isNaN(data.currentPrice)) {
      throw new Error(`Invalid currentPrice: ${data.currentPrice}`);
    }

    const existing = await Commodity.findOne({ code: data.code }).lean();

    if (!existing) {
      await Commodity.create({
        code: data.code,
        name: data.name,
        unit: data.unit,
        category: data.category,
        currentPrice: data.currentPrice,
        percentage_change: data.percentage_change,
        price_history: data.price_history || [],
        last_updated: new Date(),
      });
      return {
        code: data.code,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    const existingPrice = Number(existing.currentPrice);
    if (isNaN(existingPrice)) {
      throw new Error(`Existing price is invalid: ${existing.currentPrice}`);
    }

    await Commodity.updateOne(
      { code: data.code },
      {
        $set: {
          currentPrice: data.currentPrice,
          percentage_change: data.percentage_change,
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [{ date: new Date(), price: existingPrice }],
            $position: 0,
          },
        },
      }
    );

    return {
      code: data.code,
      action: 'updated',
      oldPrice: existingPrice,
      newPrice: data.currentPrice,
      duration: Date.now() - start,
    };
  } catch (error) {
    return { code: data.code, error: error.message };
  }
};

const commodityUpdateJob = cron.schedule(
  '0 * * * *',
  async () => {
    const runId = Date.now();
    const etHour = getETHour();
    const etDay = getETDay();

    if (etDay === 6 || etHour === 17) {
      console.log(`Skipping commodity update (market closed). RunId: ${runId}`);
      return;
    }

    console.log(
      `\n--- COMMODITY CRON JOB STARTED (${runId}) ---`,
      new Date().toISOString()
    );

    if (!checkConnection()) {
      console.error('MongoDB not connected, skipping commodity update');
      return;
    }

    const startTime = Date.now();

    try {
      const scrapers = Array.isArray(commoditySources)
        ? commoditySources
        : Object.values(commoditySources);

      const scrapedData = await Promise.all(
        scrapers.map((scraper) =>
          withTimeout(
            scraper(),
            MAX_WAIT_MS,
            scraper.name || 'anonymous'
          ).catch((error) => ({ error: error.message }))
        )
      );

      const validData = scrapedData.filter((data) => data?.code && !data.error);
      const errors = scrapedData.filter((data) => data?.error);

      if (errors.length) {
        console.warn(`${errors.length} scrapers failed:`);
        errors.forEach((err) => console.warn(`- ${err.error}`));
      }

      console.log(`Processing ${validData.length} valid commodities...`);

      const results = await Promise.all(validData.map(processCommodityUpdate));
      const success = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);

      success.forEach((result) => {
        console.log(
          `${result.code.padEnd(10)} ${result.action.padEnd(7)} in ${
            result.duration
          }ms` +
            (result.action === 'updated'
              ? ` (${result.oldPrice} → ${result.newPrice})`
              : '')
        );
      });

      if (failed.length) {
        console.warn(`${failed.length} updates failed:`);
        failed.forEach((f) => console.warn(`- ${f.code}: ${f.error}`));
      }

      console.log(
        `\nCommodity update completed in ${(
          (Date.now() - startTime) /
          1000
        ).toFixed(2)}s. Success: ${success.length}, Failed: ${
          failed.length + errors.length
        }`
      );
    } catch (error) {
      console.error('Commodity update failed:', error.message);
    } finally {
      console.log(`--- COMMODITY CRON JOB COMPLETED (${runId}) ---`);
    }
  },
  {
    scheduled: true,
    timezone: 'UTC',
  }
);

module.exports = commodityUpdateJob;
