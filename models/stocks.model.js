const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// ===== 1. PROFILE MODEL =====
const aboutSchema = new Schema(
  {
    company_name: { type: String, required: true },
    slug: { type: String, required: true },
    year_founded: { type: String, required: true },
    industry: { type: String, required: true },
    isin_symbol: { type: String },
    website: { type: String },
    headquaters: { type: String, required: true },
    exchange_symbol: { type: String, required: true, default: 'GSE' },
    ticker_symbol: { type: String, required: true },
    unique_symbol: { type: String, required: true },
    company_description: { type: String, required: true },
    number_of_employees: { type: String },
    country: { type: String, required: truem, default: 'Ghana' },
    currency: { type: String, required: true, default: 'GHS' },
    chief_executive_officer: { type: String },
  },
  { _id: false }
);

const ProfileSchema = new Schema(
  {
    company_id: { type: String, required: true, index: true },
    about: aboutSchema,
    shares: {
      exchange_listed_name: { type: String },
      exchange_code: { type: String },
      exchange_slug: { type: String },
      date_listed: { type: String },
      authorized_shares: { type: String },
      issued_shares: { type: String },
    },
  },
  { timestamps: true }
);

// ===== 2. STATISTICS MODEL =====
const keyStatsSchema = new Schema(
  {
    market_capitalization: { type: String },
    price_earning_ratio: { type: Number },
    volume: { type: Number },
    revenue: { type: String },
    revenue_currency: { type: String, default: 'GHS' },
    netIncome: { type: String },
    netIncome_currency: { type: String, default: 'GHS' },
    dividend_yield: { type: Number },
    dividend_per_share: { type: Number },
    earnings_per_share: { type: Number },
    shares_outstanding: { type: String },
    fifty_two_week_high: { type: Number },
    fifty_two_week_high_date: { type: String },
    fifty_two_week_low: { type: Number },
    fifty_two_week_low_date: { type: String },
    bid_size: { type: String },
    bid_price: { type: String },
    ask_size: { type: String },
    ask_price: { type: String },
    last_trade_price: { type: String },
    last_trade_volume: { type: String },
    trade_value: { type: String },
    open: { type: Number },
    close: { type: Number },
    high: { type: Number },
    low: { type: Number },
    percentage_change: { type: Number },
    currency: { type: String, required: true, default: 'GHS' },
    current_price: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'suspended', 'closed'],
      default: 'open',
    },
    status_message: {
      type: String,
      default: function () {
        switch (this.status) {
          case 'open':
            return 'Market open';
          case 'suspended':
            return 'Market suspended';
          case 'closed':
            return 'Market closed';
          default:
            return 'Market open';
        }
      },
    },
  },
  { _id: false }
);

const returnsSchema = new Schema(
  {
    five_days_returns: { type: Number },
    one_month_returns: { type: Number },
    three_months_returns: { type: Number },
    one_year_returns: { type: Number },
  },
  { _id: false }
);

const StatisticsSchema = new Schema(
  {
    company_id: { type: String, required: true, index: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true, index: true },
    key_statistics: keyStatsSchema,
    returns: returnsSchema,
    // For your GSE scraping: valuation data from Growth & Valuation table
    growth_valuation: {
      earnings_per_share: { type: Number },
      price_earning_ratio: { type: Number },
      dividend_per_share: { type: Number },
      dividend_yield: { type: String }, // Percentage as string to preserve "%"
      shares_outstanding: { type: String }, // Could be "97.9M"
      market_capitalization: { type: String }, // Could be "41.1M"
    },
    // Add other statistical data here as needed
  },
  { timestamps: true }
);

// ===== 3. DIVIDENDS MODEL =====
const dividendHistorySchema = new Schema(
  {
    payment_date: { type: Date, required: true },
    declaration_date: { type: Date },
    record_date: { type: Date },
    ex_dividend_date: { type: Date },
    amount: { type: Number, required: true },
    amount_currency: { type: String, required: true },
    dividend_type: {
      type: String,
      enum: ['regular', 'special', 'extra'],
      default: 'regular',
    },
    fiscal_year: { type: Number },
  },
  { _id: false }
);

const DividendsSchema = new Schema(
  {
    company_id: { type: String, required: true, index: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true, index: true },
    events: {
      next_dividend_pay_date: { type: Date },
      last_dividend_pay_date: { type: Date },
      dividend_growth: { type: String }, // Could be percentage or trend description
    },
    dividend_history: [dividendHistorySchema],
    summary: {
      annual_dividend: { type: Number },
      dividend_frequency: {
        type: String,
        enum: ['quarterly', 'semi-annual', 'annual', 'monthly', 'irregular'],
      },
      years_consecutive_increase: { type: Number },
      average_yield_5yr: { type: Number },
    },
  },
  { timestamps: true }
);

// ===== 4. EARNINGS MODEL =====
const earningsHistorySchema = new Schema(
  {
    period: { type: String, required: true }, // e.g., "Q1 2024", "FY 2023"
    period_type: {
      type: String,
      enum: ['quarterly', 'annual'],
      required: true,
    },
    report_date: { type: Date, required: true },
    earnings_per_share: { type: Number },
    revenue: { type: Number },
    revenue_currency: { type: String },
    net_income: { type: Number },
    net_income_currency: { type: String },
    eps_estimate: { type: Number },
    revenue_estimate: { type: Number },
    surprise_percentage: { type: Number }, // EPS surprise percentage
  },
  { _id: false }
);

const EarningsSchema = new Schema(
  {
    company_id: { type: String, required: true, index: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true, index: true },
    events: {
      next_earnings_date: { type: Date },
      next_earnings_estimated_eps: { type: Number },
      next_earnings_estimated_revenue: { type: Number },
    },
    earnings_history: [earningsHistorySchema],
    // Your existing income history schemas
    annual_net_income_history: [
      {
        for_year: { type: Number, required: true },
        value: { type: Number, required: true },
        value_currency: { type: String, required: true },
      },
    ],
    quarterly_net_income_history: [
      {
        for_quater: { type: String, required: true },
        for_year: { type: Number, required: true },
        value: { type: Number, required: true },
        value_currency: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

// ===== 5. FINANCIAL MODEL =====
const financialStatementSchema = new Schema(
  {
    period: { type: String, required: true }, // "Q1 2024", "FY 2023"
    period_type: {
      type: String,
      enum: ['quarterly', 'annual'],
      required: true,
    },
    statement_date: { type: Date },

    // Income Statement
    revenue: { type: Number },
    cost_of_goods_sold: { type: Number },
    gross_profit: { type: Number },
    operating_expenses: { type: Number },
    operating_income: { type: Number },
    interest_expense: { type: Number },
    taxes: { type: Number },
    net_income: { type: Number },

    // Balance Sheet
    total_assets: { type: Number },
    total_liabilities: { type: Number },
    total_equity: { type: Number },
    cash_and_equivalents: { type: Number },

    // Cash Flow
    operating_cash_flow: { type: Number },
    investing_cash_flow: { type: Number },
    financing_cash_flow: { type: Number },
    free_cash_flow: { type: Number },

    // Ratios
    gross_margin: { type: Number },
    operating_margin: { type: Number },
    net_margin: { type: Number },
    current_ratio: { type: Number },
    debt_to_equity: { type: Number },

    currency: { type: String, required: true },
  },
  { _id: false }
);

const FinancialSchema = new Schema(
  {
    company_id: { type: String, required: true, index: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true, index: true },

    // Your existing financial schemas
    annual_revenue_history: [
      {
        for_year: { type: Number, required: true },
        value: { type: Number, required: true },
        value_currency: { type: String, required: true },
      },
    ],
    quarterly_revenue_history: [
      {
        for_quater: { type: String, required: true },
        for_year: { type: Number, required: true },
        value: { type: Number, required: true },
        value_currency: { type: String, required: true },
      },
    ],

    annual_net_margin_history: [
      {
        for_year: { type: Number, required: true },
        value: { type: Number, required: true },
      },
    ],
    quarterly_net_margin_history: [
      {
        for_quater: { type: String, required: true },
        for_year: { type: Number, required: true },
        value: { type: Number, required: true },
      },
    ],

    annual_revenue_breakdown: [
      {
        for_year: { type: Number },
        title: { type: String },
        title_value: { type: Number },
        value_currency: { type: String },
      },
    ],
    quarterly_revenue_breakdown: [
      {
        for_quater: { type: String },
        for_year: { type: Number },
        title: { type: String },
        title_value: { type: Number },
        value_currency: { type: String },
      },
    ],

    annual_revenue_to_profit_conversion: {
      revenue: { type: Number },
      cogs: { type: Number },
      gross_profit: { type: Number },
      operating_expenses: { type: Number },
      operating_income: { type: Number },
      non_operating_income_expenses: { type: Number },
      taxes_and_other: { type: Number },
      net_income: { type: Number },
    },
    quarterly_revenue_to_profit_conversion: {
      revenue: { type: Number },
      cogs: { type: Number },
      gross_profit: { type: Number },
      operating_expenses: { type: Number },
      operating_income: { type: Number },
      non_operating_income_expenses: { type: Number },
      taxes_and_other: { type: Number },
      net_income: { type: Number },
    },

    annual_debt_level_and_coverage: [
      {
        for_year: { type: Number },
        debt_value: { type: Number },
        free_cash_flow_value: { type: Number },
        cash_and_equivalents_value: { type: Number },
        value_currency: { type: String },
      },
    ],
    quarterly_debt_level_and_coverage: [
      {
        for_quater: { type: String },
        for_year: { type: Number },
        debt_value: { type: Number },
        free_cash_flow_value: { type: Number },
        cash_and_equivalents_value: { type: Number },
        value_currency: { type: String },
      },
    ],

    // New: Comprehensive financial statements
    financial_statements: [financialStatementSchema],

    // Summary metrics
    financial_summary: {
      latest_revenue: { type: Number },
      latest_net_income: { type: Number },
      total_assets: { type: Number },
      total_debt: { type: Number },
      profit_margin: { type: Number },
      roe: { type: Number }, // Return on Equity
      roa: { type: Number }, // Return on Assets
      as_of_date: { type: Date },
    },
  },
  { timestamps: true }
);

// ===== 6. HOLDERS MODEL =====
const shareholderSchema = new Schema(
  {
    holder_name: { type: String, required: true },
    holder_type: {
      type: String,
      enum: ['institution', 'insider', 'mutual_fund', 'etf', 'other'],
      required: true,
    },
    shares_held: { type: Number, required: true },
    shares_percent: { type: Number }, // Percentage of total shares
    date_reported: { type: Date, required: true },
    change: { type: Number }, // Change in shares from previous report
    change_percent: { type: Number }, // Percentage change
    market_value: { type: Number }, // Current market value of holdings
    market_value_currency: { type: String },
  },
  { _id: false }
);

const institutionalHolderSchema = new Schema(
  {
    institution_name: { type: String, required: true },
    shares_held: { type: Number, required: true },
    shares_percent: { type: Number },
    date_reported: { type: Date, required: true },
  },
  { _id: false }
);

const insiderTransactionSchema = new Schema(
  {
    insider_name: { type: String, required: true },
    position: { type: String },
    transaction_date: { type: Date, required: true },
    transaction_type: {
      type: String,
      enum: ['buy', 'sell', 'option_exercise', 'grant', 'other'],
      required: true,
    },
    shares: { type: Number, required: true },
    price_per_share: { type: Number },
    total_value: { type: Number },
  },
  { _id: false }
);

const HoldersSchema = new Schema(
  {
    company_id: { type: String, required: true, index: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true, index: true },

    // Ownership breakdown
    ownership_summary: {
      // EXISTING FIELDS (keep these as-is):
      percent_institutions: { type: Number },
      percent_insiders: { type: Number },
      percent_public: { type: Number },
      shares_float: { type: Number },
      shares_outstanding: { type: Number },
      as_of_date: { type: Date },

      // NEW FIELDS for Major Holders data:
      percent_shares_held_by_all_insiders: { type: Number }, // 3.20% - shares held by all insiders
      percent_shares_held_by_institutions: { type: Number }, // 74.58% - shares held by institutions
      percent_float_held_by_institutions: { type: Number }, // 77.04% - float held by institutions
      number_of_institutions: { type: Number }, // 1,822 - count of institutions

      // Optional calculated/derived fields for consistency:
      calculated_percent_public: {
        type: Number,
        default: function () {
          // Auto-calculate if not provided: 100% - (insiders + institutions)
          const insiders =
            this.percent_shares_held_by_all_insiders ||
            this.percent_insiders ||
            0;
          const institutions =
            this.percent_shares_held_by_institutions ||
            this.percent_institutions ||
            0;
          return Math.max(0, 100 - (insiders + institutions));
        },
      },

      // For backward compatibility, you can map the new fields to existing ones:
      // percent_institutions can be populated from percent_shares_held_by_institutions
      // percent_insiders can be populated from percent_shares_held_by_all_insiders
    },

    // Detailed holder information
    top_institutional_holders: [institutionalHolderSchema],
    top_mutual_fund_holders: [shareholderSchema],
    top_etf_holders: [shareholderSchema],
    top_insider_holders: [shareholderSchema],

    // Insider transactions
    recent_insider_transactions: [insiderTransactionSchema],

    // Historical ownership data
    institutional_ownership_history: [
      {
        date: { type: Date, required: true },
        percent_institutions: { type: Number },
        number_institutions: { type: Number },
        // Optionally add the new fields here too for historical tracking:
        percent_shares_held_by_all_insiders: { type: Number },
        percent_shares_held_by_institutions: { type: Number },
        percent_float_held_by_institutions: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

// Export all models
module.exports = {
  Profile: mongoose.model('Profile', ProfileSchema),
  Statistics: mongoose.model('Statistics', StatisticsSchema),
  Dividends: mongoose.model('Dividends', DividendsSchema),
  Earnings: mongoose.model('Earnings', EarningsSchema),
  Financial: mongoose.model('Financial', FinancialSchema),
  Holders: mongoose.model('Holders', HoldersSchema),
};
