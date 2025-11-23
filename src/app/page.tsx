import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  // Redirect authenticated users to dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-chimera-navy/5 via-background to-chimera-teal/5">
      {/* Floating Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute left-[10%] top-[15%] h-64 w-64 animate-float rounded-none bg-chimera-teal/20 blur-2xl" />
        <div className="absolute right-[15%] top-[25%] h-80 w-80 animate-float-delayed rounded-none bg-chimera-purple/15 blur-3xl" />
        <div className="absolute bottom-[20%] left-[40%] h-72 w-72 animate-float rounded-none bg-chimera-lime/10 blur-2xl" />
      </div>

      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20">
        <div className="relative z-10 flex max-w-6xl flex-col items-center gap-16">
          {/* Logo in Brutal Glass Container */}
          <div className="brutal-glass w-full max-w-2xl p-10">
            <Image
              src="/chimera-wordmark.png"
              alt="Chimera"
              width={920}
              height={200}
              priority
              className="w-full"
            />
          </div>

          {/* Tagline */}
          <div className="max-w-4xl text-center">
            <h1 className="text-6xl font-black uppercase leading-tight tracking-tight text-foreground md:text-7xl lg:text-8xl">
              Lead Management
              <br />
              <span className="bg-gradient-to-r from-chimera-teal via-chimera-purple to-chimera-teal bg-clip-text text-transparent">
                Simplified
              </span>
            </h1>
            <p className="mt-8 text-xl font-bold uppercase tracking-wide text-foreground/70 md:text-2xl">
              Internal CRM for High-Performance Teams
            </p>
          </div>

          {/* CTA Button */}
          <Link
            href="/sign-in"
            className="brutal-glass-button px-12 py-5 text-2xl uppercase tracking-wider md:text-3xl"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="relative px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-20 text-center text-5xl font-black uppercase tracking-tight text-foreground md:text-6xl">
            Built for Speed
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="brutal-glass-teal group p-8">
              <div className="mb-6 flex h-20 w-20 items-center justify-center border-3 border-chimera-teal bg-chimera-teal/10">
                <span className="text-4xl font-black text-chimera-teal">01</span>
              </div>
              <h3 className="mb-4 text-3xl font-black uppercase tracking-tight text-foreground">
                Track Leads
              </h3>
              <p className="text-lg font-semibold text-foreground/70">
                Centralized pipeline management with real-time updates and intelligent routing.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="brutal-glass-purple group p-8">
              <div className="mb-6 flex h-20 w-20 items-center justify-center border-3 border-chimera-purple bg-chimera-purple/10">
                <span className="text-4xl font-black text-chimera-purple">02</span>
              </div>
              <h3 className="mb-4 text-3xl font-black uppercase tracking-tight text-foreground">
                Automate Workflows
              </h3>
              <p className="text-lg font-semibold text-foreground/70">
                Eliminate manual tasks with smart automation and custom triggers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="brutal-glass-lime group p-8">
              <div className="mb-6 flex h-20 w-20 items-center justify-center border-3 border-chimera-lime bg-chimera-lime/10">
                <span className="text-4xl font-black text-foreground">03</span>
              </div>
              <h3 className="mb-4 text-3xl font-black uppercase tracking-tight text-foreground">
                Analyze Performance
              </h3>
              <p className="text-lg font-semibold text-foreground/70">
                Actionable insights and metrics that drive revenue growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="brutal-glass grid gap-0 md:grid-cols-3">
            {/* Stat 1 */}
            <div className="border-b-3 border-r-0 border-foreground/10 p-12 text-center md:border-b-0 md:border-r-3">
              <div className="mb-4 text-5xl font-black text-chimera-teal">100%</div>
              <div className="text-sm font-bold uppercase tracking-wider text-foreground/60">
                Team Efficiency
              </div>
            </div>

            {/* Stat 2 */}
            <div className="border-b-3 border-r-0 border-foreground/10 p-12 text-center md:border-b-0 md:border-r-3">
              <div className="mb-4 text-5xl font-black text-chimera-purple">Real-Time</div>
              <div className="text-sm font-bold uppercase tracking-wider text-foreground/60">
                Data Updates
              </div>
            </div>

            {/* Stat 3 */}
            <div className="p-12 text-center">
              <div className="mb-4 text-5xl font-black text-chimera-lime">0</div>
              <div className="text-sm font-bold uppercase tracking-wider text-foreground/60">
                Manual Tasks
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t-3 border-foreground/10 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-4">
            <div className="brutal-glass p-2">
              <Image
                src="/chimera-badge-logo.png"
                alt="Chimera Logo"
                width={40}
                height={40}
              />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-foreground/60">
              Chimera Lead Management System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
