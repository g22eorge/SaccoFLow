export const normalizeMemberNumber = (memberNumber: string) => {
  const raw = memberNumber.trim();
  const match = /^M-?\s*(\d+)$/i.exec(raw);
  if (!match) {
    return raw;
  }

  return `M-${match[1].padStart(4, "0")}`;
};

export const formatMemberLabel = (memberNumber: string, fullName: string) => {
  const normalizedMemberNumber = normalizeMemberNumber(memberNumber);
  const normalizedFullName = fullName
    .trim()
    .replace(/^M-?\s*\d+\s*-\s*/i, "")
    .trim();

  if (!normalizedMemberNumber) {
    return normalizedFullName;
  }

  return `${normalizedMemberNumber} - ${normalizedFullName}`;
};
