'use strict';

const SECTORS = {
  // Technology
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  META: 'Technology', NVDA: 'Technology', AMD: 'Technology', INTC: 'Technology',
  CSCO: 'Technology', ORCL: 'Technology', ADBE: 'Technology', CRM: 'Technology',
  NFLX: 'Technology', TSLA: 'Technology', PLTR: 'Technology', SNOW: 'Technology',
  UBER: 'Technology', LYFT: 'Technology', TWLO: 'Technology', SQ: 'Technology',
  SHOP: 'Technology', ROKU: 'Technology', SPOT: 'Technology', ZM: 'Technology',
  NET: 'Technology', DDOG: 'Technology', MDB: 'Technology', CRWD: 'Technology',
  ZS: 'Technology', OKTA: 'Technology', PANW: 'Technology', FTNT: 'Technology',
  NOW: 'Technology', WDAY: 'Technology', VEEV: 'Technology', HUBS: 'Technology',
  BILL: 'Technology', DOCN: 'Technology', AMZN: 'Technology', DELL: 'Technology',
  HPQ: 'Technology', IBM: 'Technology', AMAT: 'Technology', LRCX: 'Technology',
  KLAC: 'Technology', MRVL: 'Technology', QCOM: 'Technology', TXN: 'Technology',
  AVGO: 'Technology', ARM: 'Technology', SMCI: 'Technology', ANET: 'Technology',
  MSFT: 'Technology', NTNX: 'Technology', PSTG: 'Technology', UI: 'Technology',

  // Finance
  JPM: 'Finance', BAC: 'Finance', WFC: 'Finance', C: 'Finance',
  GS: 'Finance', MS: 'Finance', AXP: 'Finance', V: 'Finance',
  MA: 'Finance', PYPL: 'Finance', 'BRK.B': 'Finance', 'BRK.A': 'Finance',
  BLK: 'Finance', SCHW: 'Finance', USB: 'Finance', TFC: 'Finance',
  PNC: 'Finance', COF: 'Finance', DFS: 'Finance', ICE: 'Finance',
  CME: 'Finance', SPGI: 'Finance', MCO: 'Finance', FIS: 'Finance',
  FISV: 'Finance', GPN: 'Finance', NDAQ: 'Finance', HOOD: 'Finance',
  KKR: 'Finance', APO: 'Finance', BX: 'Finance', ARES: 'Finance',

  // Healthcare
  JNJ: 'Healthcare', PFE: 'Healthcare', ABBV: 'Healthcare', MRK: 'Healthcare',
  LLY: 'Healthcare', BMY: 'Healthcare', GILD: 'Healthcare', AMGN: 'Healthcare',
  BIIB: 'Healthcare', REGN: 'Healthcare', MRNA: 'Healthcare', BNTX: 'Healthcare',
  CVS: 'Healthcare', UNH: 'Healthcare', HUM: 'Healthcare', CI: 'Healthcare',
  ISRG: 'Healthcare', MDT: 'Healthcare', SYK: 'Healthcare', BSX: 'Healthcare',
  TMO: 'Healthcare', DHR: 'Healthcare', ILMN: 'Healthcare', IQV: 'Healthcare',
  DXCM: 'Healthcare', IDXX: 'Healthcare', VRTX: 'Healthcare', ALNY: 'Healthcare',
  INCY: 'Healthcare', SGEN: 'Healthcare', EXAS: 'Healthcare',

  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy',
  HAL: 'Energy', OXY: 'Energy', PSX: 'Energy', VLO: 'Energy',
  MPC: 'Energy', KMI: 'Energy', WMB: 'Energy', EOG: 'Energy',
  DVN: 'Energy', PXD: 'Energy', APA: 'Energy', MRO: 'Energy',
  HES: 'Energy', BKR: 'Energy', FANG: 'Energy', BP: 'Energy',

  // Consumer
  WMT: 'Consumer', TGT: 'Consumer', COST: 'Consumer', HD: 'Consumer',
  LOW: 'Consumer', MCD: 'Consumer', SBUX: 'Consumer', NKE: 'Consumer',
  DIS: 'Consumer', CMCSA: 'Consumer', PG: 'Consumer', KO: 'Consumer',
  PEP: 'Consumer', PM: 'Consumer', MO: 'Consumer', CL: 'Consumer',
  EL: 'Consumer', BKNG: 'Consumer', ABNB: 'Consumer', MAR: 'Consumer',
  HLT: 'Consumer', YUM: 'Consumer', CMG: 'Consumer', DKNG: 'Consumer',
  EBAY: 'Consumer', ETSY: 'Consumer', CHWY: 'Consumer', W: 'Consumer',

  // Industrials
  CAT: 'Industrials', DE: 'Industrials', BA: 'Industrials', RTX: 'Industrials',
  LMT: 'Industrials', NOC: 'Industrials', GD: 'Industrials', GE: 'Industrials',
  HON: 'Industrials', MMM: 'Industrials', UPS: 'Industrials', FDX: 'Industrials',
  CSX: 'Industrials', NSC: 'Industrials', UNP: 'Industrials', EMR: 'Industrials',
  ETN: 'Industrials', PH: 'Industrials', ROK: 'Industrials', DOV: 'Industrials',
  ITW: 'Industrials', SWK: 'Industrials', FAST: 'Industrials', GWW: 'Industrials',

  // Real Estate
  AMT: 'Real Estate', CCI: 'Real Estate', PLD: 'Real Estate', EQIX: 'Real Estate',
  O: 'Real Estate', SPG: 'Real Estate', VICI: 'Real Estate', WELL: 'Real Estate',
  DLR: 'Real Estate', PSA: 'Real Estate', EQR: 'Real Estate',

  // Materials
  LIN: 'Materials', APD: 'Materials', FCX: 'Materials', NEM: 'Materials',
  GOLD: 'Materials', DD: 'Materials', DOW: 'Materials', NUE: 'Materials',
  CF: 'Materials', MOS: 'Materials', ALB: 'Materials', MP: 'Materials',

  // Utilities
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AEP: 'Utilities', EXC: 'Utilities', SRE: 'Utilities', PCG: 'Utilities',
  ED: 'Utilities', XEL: 'Utilities', AWK: 'Utilities',

  // Crypto-related equities
  MSTR: 'Crypto', MARA: 'Crypto', RIOT: 'Crypto', COIN: 'Crypto',
  HUT: 'Crypto', BTBT: 'Crypto', CLSK: 'Crypto', BITF: 'Crypto',
  CIFR: 'Crypto', WGMI: 'Crypto',

  // ETFs / Indices
  SPY: 'ETF', QQQ: 'ETF', DIA: 'ETF', IWM: 'ETF',
  VTI: 'ETF', GLD: 'ETF', SLV: 'ETF', TLT: 'ETF',
  HYG: 'ETF', LQD: 'ETF', XLK: 'ETF', XLF: 'ETF',
  XLE: 'ETF', XLV: 'ETF', XLI: 'ETF', ARKK: 'ETF',
  TQQQ: 'ETF', SQQQ: 'ETF', VXX: 'ETF', UVXY: 'ETF',
  SOXX: 'ETF', SMH: 'ETF', IBB: 'ETF', GDX: 'ETF',
};

function getSector(symbol) {
  if (!symbol) return 'Other';
  return SECTORS[symbol.toUpperCase()] || 'Other';
}

function getAllSectors() {
  return [
    'Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer',
    'Industrials', 'Real Estate', 'Materials', 'Utilities', 'Crypto', 'ETF', 'Other',
  ];
}

module.exports = { getSector, getAllSectors };
