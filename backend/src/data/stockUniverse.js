/**
 * Curated stock universe — S&P 500 major constituents + NASDAQ 100 additions.
 * ~420 liquid, well-analyst-covered tickers.  Universe sync runs nightly to
 * ensure all of these have fresh expectation scores regardless of user watchlists.
 */

const raw = [
  // ── Information Technology ──────────────────────────────────────────────────
  'AAPL', 'MSFT', 'NVDA', 'AVGO',
  // Enterprise software / cloud
  'ORCL', 'CRM', 'ADBE', 'NOW', 'INTU', 'WDAY', 'TEAM', 'ANSS', 'CTSH', 'TYL', 'GDDY', 'CDW',
  // Security / SaaS
  'PANW', 'CRWD', 'FTNT', 'ZS', 'OKTA', 'NET', 'DDOG', 'SNOW', 'PLTR', 'SHOP',
  // Semiconductors
  'AMD', 'QCOM', 'TXN', 'INTC', 'MU', 'AMAT', 'LRCX', 'KLAC', 'MRVL', 'ADI',
  'SNPS', 'CDNS', 'NXPI', 'MCHP', 'ON', 'MPWR', 'SWKS', 'KEYS', 'TEL', 'GLW',
  // Hardware / networking / storage
  'CSCO', 'ANET', 'IBM', 'DELL', 'HPE', 'HPQ', 'WDC', 'STX', 'NTAP', 'ZBRA',
  // Payments / fintech
  'V', 'MA', 'PYPL', 'SQ', 'FIS', 'FISV', 'NDAQ', 'COIN',

  // ── Communication Services ──────────────────────────────────────────────────
  'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR',
  'EA', 'TTWO', 'RBLX', 'LYV', 'SPOT', 'SNAP', 'PINS', 'MTCH',
  'IPG', 'OMC', 'PARA', 'WBD',

  // ── Consumer Discretionary ──────────────────────────────────────────────────
  'AMZN', 'TSLA',
  // Retail
  'HD', 'TGT', 'LOW', 'TJX', 'ROST', 'ORLY', 'AZO', 'GPC', 'LKQ',
  // Restaurants / leisure
  'MCD', 'SBUX', 'CMG', 'DPZ', 'YUM', 'QSR', 'DRI', 'WING', 'TXRH',
  // Travel / hospitality
  'BKNG', 'ABNB', 'EXPE', 'HLT', 'MAR', 'H', 'CCL', 'RCL', 'NCLH',
  // Auto
  'F', 'GM', 'APTV', 'BWA',
  // Homebuilding
  'PHM', 'DHI', 'LEN', 'NVR', 'TOL',
  // Apparel / beauty
  'NKE', 'EL', 'ULTA', 'RL', 'TPR',

  // ── Consumer Staples ────────────────────────────────────────────────────────
  'WMT', 'COST', 'PG', 'KO', 'PEP', 'PM', 'MO', 'MDLZ', 'CL', 'KMB',
  'CHD', 'CLX', 'HRL', 'CPB', 'K', 'GIS', 'CAG', 'MKC', 'HSY',
  'LW', 'ADM', 'BG', 'TSN', 'TAP', 'STZ', 'WBA',

  // ── Healthcare ──────────────────────────────────────────────────────────────
  // Pharma / biotech
  'JNJ', 'LLY', 'PFE', 'ABBV', 'MRK', 'AMGN', 'GILD', 'BMY',
  'VRTX', 'REGN', 'BIIB', 'ILMN', 'MRNA', 'BNTX',
  // Managed care
  'UNH', 'CI', 'HUM', 'ELV', 'CNC', 'HCA',
  // Medical devices
  'TMO', 'DHR', 'ABT', 'ISRG', 'EW', 'BSX', 'MDT', 'SYK', 'BDX',
  'ZBH', 'BAX', 'IDXX', 'ALGN', 'DXCM', 'PODD', 'HOLX', 'RMD',
  // Distributors / services
  'MCK', 'CAH', 'ABC', 'GEHC',

  // ── Financials ──────────────────────────────────────────────────────────────
  // Banking
  'BRK-B', 'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP',
  'USB', 'TFC', 'PNC', 'RF', 'CFG', 'HBAN', 'KEY', 'MTB', 'ZION',
  'BK', 'STT', 'NTRS', 'RJF',
  // Insurance
  'AIG', 'MET', 'PRU', 'ALL', 'TRV', 'PGR', 'CB', 'AFL', 'MMC', 'AON', 'WTW', 'BRO',
  // Exchanges / asset managers
  'BLK', 'SCHW', 'SPGI', 'MCO', 'ICE', 'CME', 'CBOE', 'MSCI', 'FDS',
  // Cards / consumer finance
  'COF', 'DFS',

  // ── Industrials ─────────────────────────────────────────────────────────────
  // Defense / aerospace
  'LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX', 'TDG', 'HEI', 'AXON',
  'LDOS', 'SAIC', 'BAH', 'KTOS',
  // Diversified industrials / automation
  'GE', 'HON', 'MMM', 'ETN', 'EMR', 'PH', 'ROK', 'AME', 'ITW', 'DOV', 'GNRC', 'TT', 'JCI', 'A',
  // Transportation
  'UNP', 'CSX', 'NSC', 'FDX', 'UPS', 'JBHT', 'CHRW',
  // Construction / equipment
  'CAT', 'DE', 'URI', 'PWR', 'AECOM',
  // Business services
  'ADP', 'PAYX', 'GWW', 'FAST', 'RHI',

  // ── Energy ──────────────────────────────────────────────────────────────────
  'XOM', 'CVX', 'COP', 'EOG', 'OXY', 'DVN', 'FANG', 'HES', 'APA', 'MRO',
  'MPC', 'VLO', 'PSX', 'SLB', 'HAL', 'BKR',
  'OKE', 'WMB', 'KMI', 'ET',

  // ── Materials ───────────────────────────────────────────────────────────────
  'LIN', 'APD', 'ECL', 'SHW', 'PPG', 'NEM', 'GOLD', 'FCX',
  'NUE', 'STLD', 'RS', 'MLM', 'VMC', 'CF', 'MOS', 'ALB',
  'DOW', 'DD', 'LYB', 'CE', 'IP', 'PKG',

  // ── Real Estate ─────────────────────────────────────────────────────────────
  'AMT', 'PLD', 'EQIX', 'CCI', 'DLR', 'SPG', 'O', 'PSA', 'WELL',
  'VTR', 'EQR', 'AVB', 'SBAC', 'VICI', 'BXP', 'KIM', 'IRM', 'SBA',

  // ── Utilities ───────────────────────────────────────────────────────────────
  'NEE', 'DUK', 'SO', 'D', 'SRE', 'EXC', 'AEP', 'XEL',
  'WEC', 'AEE', 'PPL', 'ES', 'ETR', 'FE', 'AWK', 'CMS', 'DTE',

  // ── Global ADRs ─────────────────────────────────────────────────────────────
  'TSM', 'ASML', 'NVO', 'SAP', 'TTE', 'SHEL', 'BP',
  'BABA', 'JD', 'PDD', 'BIDU', 'NIO',
  'SONY', 'TM', 'HMC', 'HSBC', 'UBS',
];

module.exports = [...new Set(raw)];
