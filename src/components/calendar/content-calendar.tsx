"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/social/platform-icon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Platform } from "@/types/database";

interface CalendarPost {
  id: string;
  status: string;
  scheduled_at: string;
  post_platforms: Array<{
    id: string;
    platform: Platform;
    caption: string | null;
    status: string;
  }>;
}

interface ContentCalendarProps {
  projectId: string;
}

export function ContentCalendar({ projectId }: ContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<Record<string, CalendarPost[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    const start = format(startOfMonth(currentDate), "yyyy-MM-dd'T'00:00:00");
    const end = format(endOfMonth(currentDate), "yyyy-MM-dd'T'23:59:59");

    try {
      const res = await fetch(
        `/api/posts/calendar?projectId=${projectId}&start=${start}&end=${end}`
      );
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, projectId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className="p-4">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayPosts = posts[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={dateKey}
              className={`min-h-[100px] border rounded-md p-1 ${
                isCurrentMonth ? "bg-background" : "bg-muted/30"
              } ${isToday ? "border-primary" : ""}`}
            >
              <div
                className={`text-xs font-medium mb-1 ${
                  isToday
                    ? "text-primary font-bold"
                    : isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {format(day, "d")}
              </div>

              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <div
                    key={post.id}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs truncate cursor-pointer hover:bg-muted/80"
                    title={
                      post.post_platforms?.[0]?.caption ||
                      `Post at ${format(new Date(post.scheduled_at), "HH:mm")}`
                    }
                  >
                    <div className="flex items-center gap-1">
                      {post.post_platforms?.map((pp) => (
                        <PlatformIcon
                          key={pp.id}
                          platform={pp.platform}
                          className="h-3 w-3 shrink-0"
                        />
                      ))}
                      <span className="truncate">
                        {format(new Date(post.scheduled_at), "HH:mm")}
                      </span>
                      <Badge
                        variant={
                          post.status === "published"
                            ? "default"
                            : post.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[9px] px-1 py-0 h-4 ml-auto"
                      >
                        {post.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {dayPosts.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{dayPosts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
