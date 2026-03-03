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
  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = sign ? normalized.slice(1) : normalized;
  const [integerPart, fractionPart] = unsigned.split(".");

  if (!/^\d+$/.test(integerPart)) {
    return raw;
  }

  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractionPart !== undefined
    ? `${sign}${withCommas}.${fractionPart}`
    : `${sign}${withCommas}`;
};
