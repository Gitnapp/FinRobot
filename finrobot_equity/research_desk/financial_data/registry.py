"""Canonical annual metrics. Aliases and derived formulas are owned here."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Metric:
    unit: str = "currency"
    instant: bool = False
    sec: tuple[str, ...] = ()
    fmp: tuple[str, str] | None = None
    yahoo: tuple[str, str] | None = None


METRICS = {
    "revenue": Metric(
        sec=(
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "Revenues",
            "SalesRevenueNet",
            "ifrs-full:Revenue",
        ),
        fmp=("income", "revenue"),
        yahoo=("income", "TotalRevenue"),
    ),
    "cost_of_revenue": Metric(
        sec=("CostOfRevenue", "CostOfGoodsAndServicesSold", "ifrs-full:CostOfSales"),
        fmp=("income", "costOfRevenue"),
        yahoo=("income", "CostOfRevenue"),
    ),
    "operating_income": Metric(
        sec=("OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"),
        fmp=("income", "operatingIncome"),
        yahoo=("income", "OperatingIncome"),
    ),
    "net_income": Metric(
        sec=("NetIncomeLoss", "ProfitLoss", "ifrs-full:ProfitLoss"),
        fmp=("income", "netIncome"),
        yahoo=("income", "NetIncome"),
    ),
    "pretax_income": Metric(
        sec=(
            "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
            "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterest",
            "ifrs-full:ProfitLossBeforeTax",
        ),
        fmp=("income", "incomeBeforeTax"),
        yahoo=("income", "PretaxIncome"),
    ),
    "operating_cash_flow": Metric(
        sec=(
            "NetCashProvidedByUsedInOperatingActivities",
            "ifrs-full:CashFlowsFromUsedInOperatingActivities",
        ),
        fmp=("cash", "operatingCashFlow"),
        yahoo=("cash", "OperatingCashFlow"),
    ),
    "depreciation_amortization": Metric(
        sec=(
            "DepreciationDepletionAndAmortization",
            "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
            "DepreciationAmortizationAndAccretionNet",
            "ifrs-full:DepreciationAndAmortisationExpense",
        ),
        fmp=("cash", "depreciationAndAmortization"),
        yahoo=("cash", "DepreciationAndAmortization"),
    ),
    "other_depreciation_amortization": Metric(sec=("OtherDepreciationAndAmortization",)),
    "amortization_adjustment": Metric(sec=("AdjustmentForAmortization",)),
    "capex": Metric(
        sec=(
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "PaymentsToAcquireProductiveAssets",
            "ifrs-full:PurchaseOfPropertyPlantAndEquipment",
        ),
        fmp=("cash", "capitalExpenditure"),
        yahoo=("cash", "CapitalExpenditure"),
    ),
    "research_development": Metric(
        sec=("ResearchAndDevelopmentExpense", "ifrs-full:ResearchAndDevelopmentExpense"),
        fmp=("income", "researchAndDevelopmentExpenses"),
        yahoo=("income", "ResearchAndDevelopment"),
    ),
    "interest_expense": Metric(
        sec=("InterestExpenseNonOperating", "InterestExpense", "ifrs-full:InterestExpense"),
        fmp=("income", "interestExpense"),
        yahoo=("income", "InterestExpense"),
    ),
    "income_tax": Metric(
        sec=("IncomeTaxExpenseBenefit", "ifrs-full:IncomeTaxExpenseContinuingOperations"),
        fmp=("income", "incomeTaxExpense"),
        yahoo=("income", "TaxProvision"),
    ),
    "cash": Metric(
        instant=True,
        sec=("CashAndCashEquivalentsAtCarryingValue", "ifrs-full:CashAndCashEquivalents"),
        fmp=("balance", "cashAndCashEquivalents"),
        yahoo=("balance", "CashAndCashEquivalents"),
    ),
    "total_debt": Metric(
        instant=True,
        sec=("DebtAndCapitalLeaseObligations",),
        fmp=("balance", "totalDebt"),
        yahoo=("balance", "TotalDebt"),
    ),
    "long_term_debt": Metric(
        instant=True,
        sec=(
            "LongTermDebtNoncurrent",
            "LongTermDebt",
            "LongTermDebtAndCapitalLeaseObligations",
            "ifrs-full:NoncurrentBorrowings",
        ),
    ),
    "current_debt": Metric(
        instant=True,
        sec=(
            "DebtCurrent",
            "ShortTermBorrowings",
            "ShortTermDebtCurrent",
            "ifrs-full:CurrentBorrowings",
        ),
    ),
    "diluted_shares": Metric(
        unit="shares",
        sec=(
            "WeightedAverageNumberOfDilutedSharesOutstanding",
            "ifrs-full:WeightedAverageNumberOfDilutedSharesOutstanding",
        ),
        fmp=("income", "weightedAverageShsOutDil"),
        yahoo=("income", "DilutedAverageShares"),
    ),
    "working_capital_change": Metric(
        fmp=("cash", "changeInWorkingCapital"), yahoo=("cash", "ChangeInWorkingCapital")
    ),
    "gross_profit": Metric(),
    "ebitda": Metric(),
    "operating_expenses_ex_da": Metric(),
    "net_debt": Metric(instant=True),
    "free_cash_flow": Metric(),
    "gross_margin": Metric(unit="ratio"),
    "net_margin": Metric(unit="ratio"),
    "revenue_growth": Metric(unit="ratio"),
    "cash_conversion": Metric(unit="ratio"),
}

DERIVED = {
    "depreciation_amortization": (
        ("other_depreciation_amortization", "amortization_adjustment"),
        lambda other, amortization: other + amortization,
    ),
    "gross_profit": (("revenue", "cost_of_revenue"), lambda r, c: r - c),
    "ebitda": (("operating_income", "depreciation_amortization"), lambda e, d: e + d),
    "operating_expenses_ex_da": (
        ("revenue", "cost_of_revenue", "operating_income", "depreciation_amortization"),
        lambda r, c, e, d: r - c - e - d,
    ),
    "total_debt": (("long_term_debt", "current_debt"), lambda long, current: long + current),
    "net_debt": (("total_debt", "cash"), lambda d, c: d - c),
    "free_cash_flow": (("operating_cash_flow", "capex"), lambda c, p: c - p),
    "gross_margin": (("gross_profit", "revenue"), lambda g, r: g / r if r > 0 else None),
    "net_margin": (("net_income", "revenue"), lambda n, r: n / r if r > 0 else None),
    "cash_conversion": (
        ("operating_cash_flow", "net_income"),
        lambda c, n: c / n if n > 0 else None,
    ),
}
