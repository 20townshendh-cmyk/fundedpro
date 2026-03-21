export function getMaxContractsForBalance(balance: number) {
  if (balance >= 600000) return 60;
  if (balance >= 150000) return 15;
  if (balance >= 100000) return 10;
  if (balance >= 50000) return 5;
  return Math.max(1, Math.floor(balance / 10000));
}
