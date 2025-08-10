const cron = require('node-cron');
const mongoose = require('mongoose');
const axios = require('axios');
const Index = require('../models/indice.model');
const indexSources = require('../scripts/indicesIndex');
const NodeCache = require('node-cache');

const indexCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

const MAX_WAIT_MS = 10000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000;
const REQUEST_DELAY = 1000;
const USER_AGENT = 'MarketsAPI/1.0 (+https://yourdomain.com/contact)';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (
  fn,
  retries = MAX_RETRIES,
  delayMs = BASE_RETRY_DELAY
) => {
  try {
    return await fn();
  } catch (error) {
    const status = error.response?.status;
    if (status === 429) {
      console.warn('⚠️  Received 429 Too Many Requests from API');
    }
    if (retries <= 0) throw error;

    let retryAfter = error.response?.headers?.['retry-after']
      ? parseInt(error.response.headers['retry-after']) * 1000
      : delayMs;

    const jitter = Math.floor(Math.random() * 1000);
    retryAfter += jitter;

    console.warn(
      `⏳ Retrying in ${(retryAfter / 1000).toFixed(
        2
      )}s... (${retries} attempts left)`
    );
    await delay(retryAfter);
    return withRetry(fn, retries - 1, delayMs * 2);
  }
};

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`⏱️ Timeout: ${label}`)), timeoutMs)
    ),
  ]);

const cachedRequest = async (url, params = {}) => {
  const cacheKey = `${url}:${JSON.stringify(params)}`;
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;

  await delay(REQUEST_DELAY);
  const response = await withRetry(() =>
    axios.get(url, {
      params,
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })
  );

  indexCache.set(cacheKey, response.data);
  return response.data;
};

const processIndexUpdate = async (data) => {
  const start = Date.now();
  try {
    const existing = await Index.findOne({ code: data.code }).lean();

    if (!existing) {
      await Index.create({
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

    await Index.updateOne(
      { code: data.code },
      {
        $set: {
          currentPrice: data.currentPrice,
          value_change: data.value_change,
          percentage_change: data.percentage_change,
          monthly_change: data.monthly_change,
          yearly_change: data.yearly_change,
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [
              {
                date: new Date(),
                price: existing.currentPrice,
              },
            ],
            $position: 0,
            $slice: 1000,
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
    return { code: data.code || 'unknown', error: error.message };
  }
};

const indexUpdateJob = cron.schedule(
  '*/15 * * * *',
  async () => {
    const runId = Date.now();
    console.log(
      `\n📈 --- INDEX CRON STARTED (${runId}) --- ${new Date().toISOString()}`
    );

    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB not connected. Skipping index update.');
      return;
    }

    const startTime = Date.now();

    try {
      const scrapers = Array.isArray(indexSources)
        ? indexSources
        : Object.values(indexSources);

      const scrapedData = await Promise.all(
        scrapers.filter(Boolean).map((scraper) =>
          withTimeout(
            scraper(),
            MAX_WAIT_MS,
            scraper.name || 'anonymous'
          ).catch((err) => ({
            error: err.message,
          }))
        )
      );

      const validData = scrapedData.filter((d) => d?.code && !d.error);
      const errors = scrapedData.filter((d) => d?.error);

      if (errors.length) {
        console.warn(`⚠️  ${errors.length} index scrapers failed:`);
        errors.forEach((err) => console.warn(`🔴 ${err.error}`));
      }

      console.log(`📊 Processing ${validData.length} index assets...`);

      const results = await Promise.all(validData.map(processIndexUpdate));
      const success = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);

      success.forEach((result) => {
        console.log(
          `✅ ${result.code.padEnd(10)} ${result.action.padEnd(8)} in ${
            result.duration
          }ms` +
            (result.action === 'updated'
              ? ` 📈 (${result.oldPrice} → ${result.newPrice})`
              : '')
        );
      });

      if (failed.length) {
        console.warn(`❌ ${failed.length} index updates failed:`);
        failed.forEach((f) => console.warn(`🔴 ${f.code}: ${f.error}`));
      }

      console.log(
        `\n🎯 Index update done in ${((Date.now() - startTime) / 1000).toFixed(
          2
        )}s | ✅ Success: ${success.length} ❌ Failed: ${
          failed.length + errors.length
        }`
      );
    } catch (error) {
      console.error('🔥 Index update failed:', error.message);
    } finally {
      console.log(`✅ --- INDEX CRON COMPLETED (${runId}) ---`);
    }
  },
  {
    scheduled: true,
    timezone: 'UTC',
  }
);

process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down...');
  indexUpdateJob.stop();
  await mongoose.disconnect();
  process.exit(0);
});

module.exports = indexUpdateJob;
