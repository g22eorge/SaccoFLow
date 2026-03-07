"use client"

import * as React from "react"
import type { Role } from "@prisma/client"
import {
  IconCurrencyDollar,
  IconDashboard,
  IconSettings,
  IconUsers,
  IconCash,
  IconReport,
  type Icon,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavDocuments } from "@/components/nav-documents"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { TenantSwitcher } from "@/src/ui/components/tenant-switcher"
import { navTitleForLevel, type LanguageLevel } from "@/src/lib/language-level"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarItem = {
  title: string
  url: string
  icon: Icon
  badge?: number
  roles?: Role[]
}

type QuickAccessItem = {
  name: string
  url: string
  icon: Icon
  roles?: Role[]
}

type ActionItem = {
  title: string
  url: string
  icon: Icon
  roles?: Role[]
}

const navMainItems: SidebarItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "BOARD_MEMBER", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
    },
    {
      title: "My Dashboard",
      url: "/dashboard/member",
      icon: IconDashboard,
      roles: ["MEMBER"],
    },
    {
      title: "Members",
      url: "/dashboard/members",
      icon: IconUsers,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
    },
    {
      title: "Member Requests",
      url: "/dashboard/member-requests",
      icon: IconUsers,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "BOARD_MEMBER"],
    },
    {
      title: "Savings",
      url: "/dashboard/savings",
      icon: IconCash,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "LOAN_OFFICER"],
    },
    {
      title: "Shares",
      url: "/dashboard/shares",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "LOAN_OFFICER"],
    },
    {
      title: "Loans",
      url: "/dashboard/loans",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
    },
    {
      title: "Collections",
      url: "/dashboard/collections",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
    },
    {
      title: "External Capital",
      url: "/dashboard/external-capital",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"],
    },
    {
      title: "AI Insights",
      url: "/dashboard/ai-insights",
      icon: IconReport,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "BOARD_MEMBER", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
    },
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: IconReport,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "BOARD_MEMBER", "TREASURER", "AUDITOR"],
    },
    {
      title: "Audit Logs",
      url: "/dashboard/audit-logs",
      icon: IconReport,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
    },
]

const navSecondaryItems: SidebarItem[] = [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: IconSettings,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
    },
    {
      title: "Users",
      url: "/users",
      icon: IconUsers,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"],
    },
    {
      title: "Billing",
      url: "/dashboard/billing",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"],
    },
]

const quickAccessItems: QuickAccessItem[] = [
    {
      name: "Approvals Queue",
      url: "/dashboard/loans?status=PENDING",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
    },
    {
      name: "Collections",
      url: "/dashboard/collections",
      icon: IconCurrencyDollar,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
    },
    {
      name: "Member Statements",
      url: "/dashboard/reports#member-statements",
      icon: IconReport,
      roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "BOARD_MEMBER", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
    },
]

const quickCreateItems: ActionItem[] = [
  {
    title: "New Member",
    url: "/dashboard/members",
    icon: IconUsers,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "LOAN_OFFICER"],
  },
  {
    title: "Savings Transaction",
    url: "/dashboard/savings",
    icon: IconCash,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER"],
  },
  {
    title: "Share Transaction",
    url: "/dashboard/shares",
    icon: IconCurrencyDollar,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER"],
  },
  {
    title: "Loan Application",
    url: "/dashboard/loans",
    icon: IconCurrencyDollar,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
  },
  {
    title: "Create User",
    url: "/users",
    icon: IconUsers,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"],
  },
]

const inboxItems: Array<{
  title: string
  detail: string
  url: string
  icon: Icon
  roles?: Role[]
}> = [
  {
    title: "Pending approvals",
    detail: "Review unapproved loan applications",
    url: "/dashboard/loans?status=PENDING",
    icon: IconCurrencyDollar,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
  },
  {
    title: "Collections",
    detail: "Follow up defaulted loans",
    url: "/dashboard/collections",
    icon: IconCurrencyDollar,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"],
  },
  {
    title: "Audit alerts",
    detail: "Review latest activity logs",
    url: "/dashboard/audit-logs",
    icon: IconReport,
    roles: ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "BOARD_MEMBER", "TREASURER", "AUDITOR", "LOAN_OFFICER"],
  },
]

const hasRole = (role: Role, allowed?: Role[]) =>
  !allowed || allowed.length === 0 || allowed.includes(role)

export function AppSidebar({
  role,
  user,
  tenant,
  languageLevel,
  badges,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role: Role
  user: { name: string; email: string }
  languageLevel?: LanguageLevel
  tenant?: {
    activeSaccoId: string
    options: Array<{
      saccoId: string
      saccoCode: string
      saccoName: string
      role: Role
    }>
  }
  badges?: {
    pendingLoanRequests?: number
    pendingMemberRequests?: number
    defaultedCollectionCases?: number
  }
}) {
  const [liveBadges, setLiveBadges] = React.useState({
    pendingLoanRequests: badges?.pendingLoanRequests ?? 0,
    pendingMemberRequests: badges?.pendingMemberRequests ?? 0,
    defaultedCollectionCases: badges?.defaultedCollectionCases ?? 0,
  })

  React.useEffect(() => {
    let active = true

    const refreshBadges = async () => {
      try {
        const response = await fetch("/api/sidebar/badges", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok || !payload?.success || !active) {
          return
        }
        setLiveBadges({
          pendingLoanRequests: Number(payload.data?.pendingLoanRequests ?? 0),
          pendingMemberRequests: Number(payload.data?.pendingMemberRequests ?? 0),
          defaultedCollectionCases: Number(payload.data?.defaultedCollectionCases ?? 0),
        })
      } catch {
        // keep last known badge values
      }
    }

    const onRefresh = () => {
      void refreshBadges()
    }

    void refreshBadges()
    const interval = window.setInterval(onRefresh, 8000)
    window.addEventListener("saccoflow:badge-refresh", onRefresh)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("saccoflow:badge-refresh", onRefresh)
    }
  }, [])

  const navMain = navMainItems
    .map((item) => {
      const relabeled = {
        ...item,
        title: navTitleForLevel(languageLevel ?? "PLAIN", item.title, item.url),
      }
      if (item.url === "/dashboard/loans") {
        return { ...relabeled, badge: liveBadges.pendingLoanRequests }
      }
      if (item.url === "/dashboard/member-requests") {
        return { ...relabeled, badge: liveBadges.pendingMemberRequests }
      }
      if (item.url === "/dashboard/collections") {
        return { ...relabeled, badge: liveBadges.defaultedCollectionCases }
      }
      return relabeled
    })
    .filter((item) => hasRole(role, item.roles))
  const navSecondary = navSecondaryItems
    .map((item) => ({
      ...item,
      title: navTitleForLevel(languageLevel ?? "PLAIN", item.title, item.url),
    }))
    .filter((item) => hasRole(role, item.roles))
  const documents = quickAccessItems.filter((item) => hasRole(role, item.roles))
  const createActions = quickCreateItems.filter((item) => hasRole(role, item.roles))
  const workQueue = inboxItems.filter((item) => hasRole(role, item.roles))

  const navUser = {
    name: user.name,
    email: user.email,
    avatar: "/avatars/shadcn.jpg",
  }
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard">
                <span className="text-base font-semibold text-[#cc5500]">SACCOFlow</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {tenant ? (
            <SidebarMenuItem>
              <TenantSwitcher
                activeSaccoId={tenant.activeSaccoId}
                tenants={tenant.options}
              />
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          quickCreateItems={createActions}
          inboxItems={workQueue}
        />
        <NavDocuments items={documents} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
