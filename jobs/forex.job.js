const cron = require('node-cron');
const mongoose = require('mongoose');
const Forex = require('../models/forex.model');
const forexSources = require('../scripts/forexIndex');

const checkConnection = () => mongoose.connection.readyState === 1;
const MAX_WAIT_MS = 5 * 60 * 1000;

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs)
    ),
  ]);
};

const processForexUpdate = async (data) => {
  const start = Date.now();
  try {
    const existing = await Forex.findOne({ code: data.code }).lean();

    if (!existing) {
      await Forex.create({
        ...data,
        price_history: [],
        last_updated: new Date(),
      });
      return {
        code: data.code,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    await Forex.updateOne(
      { code: data.code },
      {
        $set: {
          currentPrice: Number(data.currentPrice),
          percentage_change: Number(data.percentage_change),
          monthly_change: Number(data.monthly_change),
          yearly_change: Number(data.yearly_change),
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [
              {
                date: new Date(),
                price: Number(existing.currentPrice),
                percentage_change: Number(existing.percentage_change),
              },
            ],
            $position: 0,
          },
        },
      }
    );

    return {
      code: data.code,
      action: 'updated',
      oldPrice: existing.currentPrice,
      newPrice: data.currentPrice,
      duration: Date.now() - start,
    };
  } catch (error) {
    return { code: data.code, error: error.message };
  }
};

const forexUpdateJob = cron.schedule(
  '0 * * * *',
  async () => {
    const runId = Date.now();
    console.log(
      `\n--- CRON JOB STARTED (${runId}) ---`,
      new Date().toISOString()
    );

    if (!checkConnection()) {
      console.error('MongoDB not connected, skipping forex update');
      return;
    }

    const now = new Date();
    const day = now.getUTCDay();
    if (day === 0 || day === 6) {
      console.log('⏸️ Forex market closed (weekend), skipping update.');
      return;
    }

    const startTime = Date.now();

    try {
      const scrapers = Array.isArray(forexSources)
        ? forexSources
        : Object.values(forexSources);

      const scrapedData = await Promise.all(
        scrapers
          .filter(Boolean)
          .map((scraper) =>
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

      console.log(`Processing ${validData.length} valid pairs...`);

      const results = await Promise.all(validData.map(processForexUpdate));
      const success = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);

      success.forEach((result) => {
        console.log(
          `${result.code.padEnd(8)} ${result.action.padEnd(7)} in ${
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
        `\nUpdate completed in ${((Date.now() - startTime) / 1000).toFixed(
          2
        )}s. ` +
          `Success: ${success.length}, Failed: ${failed.length + errors.length}`
      );
    } catch (error) {
      console.error('Forex update failed:', error.message);
    } finally {
      console.log(`--- CRON JOB COMPLETED (${runId}) ---`);
    }
  },
  {
    scheduled: true,
    timezone: 'UTC',
  }
);

module.exports = forexUpdateJob;
