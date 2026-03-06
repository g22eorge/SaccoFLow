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
  badges,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role: Role
  user: { name: string; email: string }
  badges?: {
    pendingLoanRequests?: number
    pendingMemberRequests?: number
  }
}) {
  const navMain = navMainItems
    .map((item) => {
      if (item.url === "/dashboard/loans") {
        return { ...item, badge: badges?.pendingLoanRequests ?? 0 }
      }
      if (item.url === "/dashboard/member-requests") {
        return { ...item, badge: badges?.pendingMemberRequests ?? 0 }
      }
      return item
    })
    .filter((item) => hasRole(role, item.roles))
  const navSecondary = navSecondaryItems.filter((item) => hasRole(role, item.roles))
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
