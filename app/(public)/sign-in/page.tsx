import { redirect } from "next/navigation";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const rawNext = searchParams?.next;
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : undefined;

  if (nextUrl) {
    redirect(`/?next=${encodeURIComponent(nextUrl)}`);
  }

  redirect("/");
}
