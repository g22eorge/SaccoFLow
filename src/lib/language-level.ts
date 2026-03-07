export type LanguageLevel = "PLAIN" | "PROFESSIONAL";

export const toLanguageLevel = (value: string | null | undefined): LanguageLevel =>
  value === "PROFESSIONAL" ? "PROFESSIONAL" : "PLAIN";

export const navTitleForLevel = (
  level: LanguageLevel,
  title: string,
  url: string,
) => {
  if (level === "PROFESSIONAL") {
    return title;
  }

  const plainByUrl: Record<string, string> = {
    "/dashboard": "Overview",
    "/dashboard/member": "My Overview",
    "/dashboard/members": "People",
    "/dashboard/member-requests": "Join Requests",
    "/dashboard/savings": "Save Money",
    "/dashboard/shares": "Ownership Shares",
    "/dashboard/loans": "Borrowing",
    "/dashboard/collections": "Late Payments",
    "/dashboard/external-capital": "Outside Funding",
    "/dashboard/ai-insights": "Helpful Insights",
    "/dashboard/reports": "Reports",
    "/dashboard/audit-logs": "Activity History",
    "/dashboard/billing": "Subscription",
    "/dashboard/settings": "Preferences",
    "/users": "Team Access",
  };

  return plainByUrl[url] ?? title;
};
