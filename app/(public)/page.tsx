import { PublicHomeClient } from "@/src/ui/components/public-home-page";

export default function PublicHomePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const rawNext = searchParams?.next;
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  return <PublicHomeClient nextUrl={nextUrl} />;
}
