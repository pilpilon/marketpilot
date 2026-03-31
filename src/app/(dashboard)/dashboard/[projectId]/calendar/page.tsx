import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ContentCalendar } from "@/components/calendar/content-calendar";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("calendar");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

      <ContentCalendar projectId={projectId} />
    </div>
  );
}
