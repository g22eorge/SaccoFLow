"use client"

import {
  IconBell,
  IconCirclePlusFilled,
  type Icon,
} from "@tabler/icons-react"
import Link from "next/link"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  quickCreateItems,
  inboxItems,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    badge?: number
  }[]
  quickCreateItems: {
    title: string
    url: string
    icon?: Icon
  }[]
  inboxItems: {
    title: string
    detail?: string
    url: string
    icon?: Icon
  }[]
}) {
  const inboxCount = inboxItems.length

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-orange-600 dark:text-orange-500">Navigation</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="quick-create-trigger"
                  type="button"
                  className="flex min-w-8 items-center gap-2 rounded-md bg-[#cc5500] px-2 py-1.5 text-sm font-medium text-white duration-200 ease-linear hover:bg-[#b34a00]"
                >
                  <IconCirclePlusFilled className="size-4" />
                  <span>Create</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-lg">
                <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickCreateItems.map((item) => (
                  <DropdownMenuItem key={item.title} asChild>
                    <Link href={item.url}>
                      {item.icon ? <item.icon /> : null}
                      <span>{item.title}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="work-queue-trigger"
                  type="button"
                  className="flex min-w-8 items-center gap-2 rounded-md border border-orange-200 bg-background px-2 py-1.5 text-sm hover:bg-orange-50 hover:text-[#cc5500]"
                >
                  <IconBell className="size-4" />
                  <span>Inbox</span>
                  {inboxCount > 0 ? (
                    <span className="ml-auto rounded-full bg-[#cc5500] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {inboxCount}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 rounded-lg">
                <DropdownMenuLabel>Work Queue</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {inboxItems.length > 0 ? (
                  inboxItems.map((item) => (
                    <DropdownMenuItem key={item.title} asChild>
                      <Link href={item.url} className="flex items-start gap-2">
                        {item.icon ? <item.icon /> : null}
                        <span>
                          <span className="block font-medium">{item.title}</span>
                          {item.detail ? (
                            <span className="block text-xs text-muted-foreground">{item.detail}</span>
                          ) : null}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    <span className="text-xs text-muted-foreground">No pending alerts</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-orange-50 hover:text-[#cc5500] dark:hover:bg-orange-950 dark:hover:text-orange-400">
                <Link href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-auto rounded-full bg-[#cc5500] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
