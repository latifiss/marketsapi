require('express-async-errors');
const { connectDB } = require('./db/index');
const express = require('express');
require('dotenv').config();
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const favicon = require('serve-favicon');

const forexJob = require('./jobs/forex.job');
const commoditiesJob = require('./jobs/commodities.job');
const cryptoJob = require('./jobs/crypto.job');
const indiceJob = require('./jobs/indice.job');
const goldbodJob = require('./jobs/goldbod.job');

const companyRoutes = require('./routes/company.routes');
const cryptoRoutes = require('./routes/crypto.routes');
const indexRoutes = require('./routes/index.routes');
const forexRoutes = require('./routes/forex.routes');
const forexInterbankRoutes = require('./routes/forexInterbank.routes');
const commodityRoutes = require('./routes/commodity.routes');
const goldbodRoutes = require('./routes/goldbod.routes');

const app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(morgan('dev'));

connectDB();

forexJob.start();
commoditiesJob.start();
cryptoJob.start();
indiceJob.start();
goldbodJob.start();

app.use('/api/company', companyRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/index', indexRoutes);
app.use('/api/forex', forexRoutes);
app.use('/api/forex-interbank-rates', forexInterbankRoutes);
app.use('/api/commodity', commodityRoutes);
app.use('/api/goldbod', goldbodRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 9000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
