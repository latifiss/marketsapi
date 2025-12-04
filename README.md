<p align="center">
  <img src="./public/android-chrome-192x192.png" alt="logo" width="150">
</p>

<h1 align="center">Markets API</h1>

A 🆓free lightweight, configurable API for market-data built with Node.js.  
Currently based on Express, MongoDB, job scheduling and modular architecture.

## 🚩 Table of Contents

- [📙Getting Started](#getting-started) 
- [🔧Prerequisites](#prerequisites)
- [🍞Installation](#installation)  
- [🛰Configuration](#configuration)  
- [🔗 Endpoints](#-endpoints)
  - [Get All Crypto](#get-all-cryto)
  - [Get Crypto By Symbol](#get-crypto-by-symbol)
  - [Get Commodity By Symbol](#get-commodity-by-symbol)
  - [Get All Forex](#get-all-forex)
  - [Get Forex By Exchange Symbol](#get-forex-by-exchange-symbol)
  - [Get Goldbold Price](#get-goldbod-price)
  - [Get All Stock Indexes](#get-all-stock-indexes)
  - [Get Stock Index By Symbol](#get-stock-index-by-symbol)
- [💬 Contributing](#-contributing)
- [🚀 Used By](#-used-by)
- [📜 License](#-license)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing.

## Prerequisites

- Node.js (v14+ recommended)  
- npm or Yarn  
- A running database (e.g., MongoDB) or any other DB configured in `db/`  
- Optional: Redis, message queue or scheduler if used by jobs  

## Installation

1. Clone the repo:  
   ```bash
   git clone https://github.com/latifiss/marketsapi.git
   cd marketsapi

2. Install dependencies:  
   ```bash
   npm install


3. Copy `.env.example` to '.env.` and fill in your values.:  
   ```bash
   cp .env.example .env


4. Start the server:  
   ```bash
   npm start


5. Open your browser or API client and access the endpoints (e.g., http://localhost:9000/api/...).:  
   ```bash
   npm start


## Configuration

Most configuration is done via environment variables. See the **Environment Variables** section below.

# Usage

- Access REST endpoints via `/api/...`
- Add your own controllers via `controllers/`
- Add your own routes via `routes/`
- Background tasks and cron jobs live in `jobs/` → configure frequency in the job definitions

# Folder Structure
| Folder/File       | Purpose                                                                 |
|-------------------|-------------------------------------------------------------------------|
| `/controllers`    | API logic                                                               |
| `/db`            | Database connection and models setup                                    |
| `/jobs`          | Scheduled/background tasks                                              |
| `/lib`           | Shared utility modules                                                  |
| `/models`        | Data models (ORM/ODM) definitions                                       |
| `/public`        | Static/public assets                                                    |
| `/routes`        | Route definitions mapping to controllers                                |
| `/scripts`       | Standalone utility scripts                                              |
| `app.js`         | Main application entry point                                            |
| `package.json`   | Project metadata and scripts                                            |


# Environment Variables

Add a `.env` file in the root with values similar to:

```bash
PORT=9000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=27017
DB_NAME=marketsdb
DB_USER=
DB_PASS=

REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_USERNAME=your_redis_user
REDIS_PASSWORD=your_redis_pass
```


## Endpoints

## Crypto 🪙

* **Get All Crypto**
    ```
    https://markets.21centurynews.com/api/crypto
    ```
* **Get Crypto By Symbol**
    ```
    https://markets.21centurynews.com/api/crypto/{symbol}
    ```

***

## Commodities and Precious Metals 🌟

* **Get Commodity By Symbol**
    ```
    https://markets.21centurynews.com/api/commodity/{symbol}
    ```
* **Get Goldbold Price**
    ```
    https://markets.21centurynews.com/api/goldbod
    ```

***

## Forex 💱

* **Get All Forex**
    ```
    https://markets.21centurynews.com/api/forex
    ```
* **Get Forex By Exchange Symbol**
    ```
    https://markets.21centurynews.com/api/forex/{symbol}
    ```

***

## Stock Indexes 📈

* **Get All Stock Indexes**
    ```
    https://markets.21centurynews.com/api/index
    ```
* **Get Stock Index By Symbol**
    ```
    https://markets.21centurynews.com/api/index/{symbol}
    ```

## Contributing

1. Fork the repository
2. Create your branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Open a Pull Request

Please follow best practices for code style, include tests if applicable, and document your additions.

## Used By
[TheGhanaianWeb](https://theghanaianweb.com/)

## License
`MIT`
