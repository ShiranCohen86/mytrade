class BaseProvider {
  async getCurrentQuote(_ticker) {
    throw new Error('Not implemented: getCurrentQuote');
  }

  // Returns Array<{ date, open, high, low, close, volume }> sorted ascending
  async getHistoricalData(_ticker, _days) {
    throw new Error('Not implemented: getHistoricalData');
  }

  // Returns { date: Date|null, confirmed: boolean }
  async getEarningsDate(_ticker) {
    throw new Error('Not implemented: getEarningsDate');
  }

  // Returns { name, sector, industry, peRatio, analystTargetPrice, beta }
  async getCompanyInfo(_ticker) {
    throw new Error('Not implemented: getCompanyInfo');
  }
}

module.exports = BaseProvider;
