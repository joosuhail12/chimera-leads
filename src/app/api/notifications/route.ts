import { NextResponse } from "next/server";

const demoNotifications = [
  {
    id: "notif-1",
    title: "New enterprise lead assigned",
    body: "Acme Robotics was routed to your pipeline.",
    category: "Pipeline",
    status: "unread",
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: "notif-2",
    title: "Application moved to review",
    body: "Nova AI entered the diligence stage.",
    category: "Applications",
    status: "unread",
    createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
  {
    id: "notif-3",
    title: "Meeting booked",
    body: "Discovery call with OmniStack confirmed for tomorrow.",
    category: "Meetings",
    status: "read",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

export async function GET() {
  return NextResponse.json({ notifications: demoNotifications });
}
