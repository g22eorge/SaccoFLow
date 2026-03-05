export const formatMoney = (
  value: string | number | null | undefined,
): string => {
  if (value === null || value === undefined) {
    return "-";
  }

  const raw = String(value).trim();
  if (raw.length === 0) {
    return "-";
  }

  const normalized = raw.replaceAll(",", "");
  if (!/^-?\d*(\.\d+)?$/.test(normalized) || normalized === "" || normalized === "-") {
    return raw;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return raw;
  }

  const rounded = Math.round(parsed * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  const [integerPart, fractionPart = "00"] = Math.abs(rounded)
    .toFixed(2)
    .split(".");

  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${withCommas}.${fractionPart}`;
};
