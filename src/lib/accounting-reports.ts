export type ReportPeriodType = "week" | "month" | "year";

export type AccountingTransaction = {
  id: string;
  transaction_date: string;
  total_amount: number;
  amount_paid?: number | null;
  status?: string | null;
  is_replacement_transaction?: boolean | null;
  original_return_id?: string | null;
};

export type AccountingTransactionItem = {
  transaction_id: string;
  product_id: string;
  quantity: number;
};

export type AccountingProduct = {
  id: string;
  cost?: number | null;
  quantity?: number | null;
};

export type AccountingExpense = {
  expense_date: string;
  category: string;
  amount: number;
};

export type AccountingSupplier = {
  due_amount?: number | null;
};

export type AccountingSupplierPayment = {
  payment_date: string;
  amount: number;
};

export type ReportRange = {
  start: Date;
  end: Date;
  label: string;
};

export type ProfitLossStatement = {
  salesRevenue: number;
  returnsRefunds: number;
  netSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
};

export type FinancialPositionStatement = {
  inventoryValue: number;
  periodCashReceived: number;
  supplierLiabilities: number;
  supplierPayments: number;
  totalAssets: number;
  totalLiabilities: number;
  currentPeriodProfit: number;
  netPosition: number;
};

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function getReportRange(periodType: ReportPeriodType, anchorValue: string): ReportRange {
  const anchor = parseDate(anchorValue) || new Date();
  const start = startOfDay(anchor);
  const end = endOfDay(anchor);

  if (periodType === "week") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    };
  }

  if (periodType === "year") {
    start.setMonth(0, 1);
    end.setFullYear(start.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: String(start.getFullYear()),
    };
  }

  start.setDate(1);
  end.setMonth(start.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}

export function isWithinRange(value: string, range: ReportRange) {
  const date = parseDate(value);
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function isCompleted(transaction: AccountingTransaction) {
  return !transaction.status || transaction.status === "completed";
}

function isReturnTransaction(transaction: AccountingTransaction) {
  return Boolean(transaction.original_return_id) && Number(transaction.total_amount || 0) < 0;
}

export function calculateProfitLoss(
  range: ReportRange,
  transactions: AccountingTransaction[],
  transactionItems: AccountingTransactionItem[],
  products: AccountingProduct[],
  expenses: AccountingExpense[]
): ProfitLossStatement {
  const productCosts = new Map(products.map((product) => [product.id, Number(product.cost || 0)]));
  const scopedTransactions = transactions.filter(
    (transaction) => isCompleted(transaction) && isWithinRange(transaction.transaction_date, range)
  );
  const scopedTransactionIds = new Set(scopedTransactions.map((transaction) => transaction.id));

  const salesRevenue = scopedTransactions
    .filter((transaction) => !isReturnTransaction(transaction) && Number(transaction.total_amount || 0) > 0)
    .reduce((sum, transaction) => sum + Number(transaction.total_amount || 0), 0);

  const returnsRefunds = Math.abs(
    scopedTransactions
      .filter(isReturnTransaction)
      .reduce((sum, transaction) => sum + Number(transaction.total_amount || 0), 0)
  );

  const costOfGoodsSold = transactionItems
    .filter((item) => scopedTransactionIds.has(item.transaction_id))
    .reduce((sum, item) => {
      const cost = productCosts.get(item.product_id) || 0;
      return sum + cost * Number(item.quantity || 0);
    }, 0);

  const expensesByCategory = expenses
    .filter((expense) => isWithinRange(expense.expense_date, range))
    .reduce((acc, expense) => {
      const key = expense.category || "other";
      acc[key] = (acc[key] || 0) + Number(expense.amount || 0);
      return acc;
    }, {} as Record<string, number>);

  const totalExpenses = Object.values(expensesByCategory).reduce((sum, value) => sum + value, 0);
  const netSales = salesRevenue - returnsRefunds;
  const grossProfit = netSales - costOfGoodsSold;

  return {
    salesRevenue: toMoney(salesRevenue),
    returnsRefunds: toMoney(returnsRefunds),
    netSales: toMoney(netSales),
    costOfGoodsSold: toMoney(costOfGoodsSold),
    grossProfit: toMoney(grossProfit),
    expensesByCategory,
    totalExpenses: toMoney(totalExpenses),
    netProfit: toMoney(grossProfit - totalExpenses),
  };
}

export function calculateFinancialPosition(
  range: ReportRange,
  transactions: AccountingTransaction[],
  products: AccountingProduct[],
  suppliers: AccountingSupplier[],
  supplierPayments: AccountingSupplierPayment[],
  currentPeriodProfit: number
): FinancialPositionStatement {
  const inventoryValue = products.reduce(
    (sum, product) => sum + Number(product.cost || 0) * Number(product.quantity || 0),
    0
  );
  const periodCashReceived = transactions
    .filter((transaction) => isCompleted(transaction) && isWithinRange(transaction.transaction_date, range))
    .reduce((sum, transaction) => {
      const paid = Number(transaction.amount_paid || 0);
      const fallback = Number(transaction.total_amount || 0);
      return sum + (paid > 0 ? paid : fallback);
    }, 0);
  const supplierLiabilities = suppliers.reduce(
    (sum, supplier) => sum + Math.max(0, Number(supplier.due_amount || 0)),
    0
  );
  const periodSupplierPayments = supplierPayments
    .filter((payment) => isWithinRange(payment.payment_date, range))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalAssets = inventoryValue + periodCashReceived;
  const totalLiabilities = supplierLiabilities;

  return {
    inventoryValue: toMoney(inventoryValue),
    periodCashReceived: toMoney(periodCashReceived),
    supplierLiabilities: toMoney(supplierLiabilities),
    supplierPayments: toMoney(periodSupplierPayments),
    totalAssets: toMoney(totalAssets),
    totalLiabilities: toMoney(totalLiabilities),
    currentPeriodProfit: toMoney(currentPeriodProfit),
    netPosition: toMoney(totalAssets - totalLiabilities),
  };
}

